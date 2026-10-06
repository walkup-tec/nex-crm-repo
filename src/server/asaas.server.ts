import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type AsaasContract = {
  monthlyFee: string;
  dueDay: string;
  startsOn: string;
  endsOn: string;
  finePercent: string;
  interestPercent: string;
  subscriptionId: string;
  note: string;
};

type Customer = { id?: string; email?: string | null; additionalEmails?: string | null; deleted?: boolean };
type Fee = { value?: number; type?: string };
type Subscription = {
  id?: string;
  status?: string;
  value?: number;
  nextDueDate?: string | null;
  dateCreated?: string | null;
  endDate?: string | null;
  fine?: Fee | null;
  interest?: Fee | null;
  deleted?: boolean;
};

function fail(message: string): never {
  throw new Error(message);
}

function money(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function percent(value: number) {
  return `${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

function dateBr(iso: string) {
  const [year, month, day] = iso.slice(0, 10).split("-");
  if (!year || !month || !day) fail("O Asaas devolveu uma data inválida.");
  return `${day}/${month}/${year}`;
}

function config() {
  const key = process.env["ASAAS_API_KEY"] || process.env["ASAAS_ACCESS_TOKEN"] || process.env["ASAAS_TOKEN"];
  if (!key?.trim()) fail("O Asaas ainda não está configurado no servidor.");
  const explicit = process.env["ASAAS_API_URL"] || process.env["ASAAS_BASE_URL"];
  const base = (explicit || (key.includes("_hmlg_") ? "https://api-sandbox.asaas.com/v3" : "https://api.asaas.com/v3")).replace(/\/$/, "");
  return { key: key.trim(), base };
}

async function asaasGet<T>(path: string, params: Record<string, string>) {
  const { key, base } = config();
  const url = new URL(`${base}${path}`);
  for (const [name, value] of Object.entries(params)) url.searchParams.set(name, value);
  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      access_token: key,
      "User-Agent": "NEX-Ads/1.0 (https://app.nexmeta.com.br)",
    },
    signal: AbortSignal.timeout(12000),
  });
  if (response.status === 401 || response.status === 403) fail("A chave do Asaas foi recusada.");
  if (!response.ok) fail("Não foi possível consultar o Asaas agora.");
  return (await response.json()) as T;
}

export function contractFromSubscription(subscription: Subscription): AsaasContract {
  if (!subscription.id) fail("A assinatura do Asaas não tem identificador.");
  if (typeof subscription.value !== "number" || !Number.isFinite(subscription.value)) fail("A assinatura do Asaas não tem valor.");
  if (!subscription.nextDueDate) fail("A assinatura do Asaas não tem vencimento.");
  if (!subscription.dateCreated) fail("A assinatura do Asaas não tem data de início.");
  const due = Number(subscription.nextDueDate.slice(8, 10));
  if (!Number.isInteger(due) || due < 1 || due > 31) fail("O vencimento do Asaas é inválido.");
  const notes: string[] = ["Assinatura localizada. O contrato foi preenchido."];
  let dueDay = due;
  if (due > 28) {
    dueDay = 28;
    notes.push(`O vencimento no Asaas é dia ${due}. O contrato guarda até o dia 28.`);
  }
  const fine = subscription.fine?.value;
  const interest = subscription.interest?.value;
  if (subscription.fine?.type === "FIXED") notes.push("A multa no Asaas é um valor fixo e não entrou no percentual.");
  return {
    monthlyFee: money(subscription.value),
    dueDay: String(dueDay),
    startsOn: dateBr(subscription.dateCreated),
    endsOn: subscription.endDate ? dateBr(subscription.endDate) : "",
    finePercent: subscription.fine?.type === "FIXED" || fine == null ? "" : percent(fine),
    interestPercent: interest == null ? "" : percent(interest),
    subscriptionId: subscription.id,
    note: notes.join(" "),
  };
}

function sameEmail(customer: Customer, email: string) {
  const extras = (customer.additionalEmails ?? "").split(",").map((item) => item.trim().toLowerCase());
  return customer.email?.trim().toLowerCase() === email || extras.includes(email);
}

async function requireMaster(userId: string) {
  const [{ data: profile, error: profileError }, { data: roles, error: roleError }] = await Promise.all([
    supabaseAdmin.from("profiles").select("id, is_blocked").eq("id", userId).maybeSingle(),
    supabaseAdmin.from("user_roles").select("role").eq("user_id", userId),
  ]);
  if (profileError) fail(profileError.message);
  if (roleError) fail(roleError.message);
  if (!profile) fail("Seu perfil ainda não está ligado a um acesso.");
  if (profile.is_blocked) fail("Este acesso está bloqueado.");
  if (!(roles ?? []).some((row) => row.role === "master")) fail("Só o Master administra clientes.");
}

export async function lookupAsaasSubscription(userId: string, emailInput: string) {
  await requireMaster(userId);
  const email = emailInput.trim().toLowerCase();
  if (!email.includes("@")) fail("Informe o e-mail para localizar a assinatura.");
  const customers = await asaasGet<{ data?: Customer[] }>("/customers", { email, limit: "20" });
  const matches = (customers.data ?? []).filter((customer) => customer.id && !customer.deleted && sameEmail(customer, email));
  if (!matches.length) fail("Nenhum assinante no Asaas com este e-mail.");
  const found: Subscription[] = [];
  for (const customer of matches) {
    const subscriptions = await asaasGet<{ data?: Subscription[] }>("/subscriptions", { customer: customer.id ?? "", limit: "50" });
    found.push(...(subscriptions.data ?? []).filter((item) => item.id && !item.deleted));
  }
  found.sort((left, right) => {
    const rank = (status: string | undefined) => (status === "ACTIVE" ? 0 : 1);
    return rank(left.status) - rank(right.status) || (right.dateCreated ?? "").localeCompare(left.dateCreated ?? "");
  });
  const subscription = found[0];
  if (!subscription) fail("Este e-mail está no Asaas, mas não há assinatura.");
  return contractFromSubscription(subscription);
}
