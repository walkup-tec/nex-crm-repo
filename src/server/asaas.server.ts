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

export function asaasConfigured() {
  const key = process.env["ASAAS_API_KEY"] || process.env["ASAAS_ACCESS_TOKEN"] || process.env["ASAAS_TOKEN"];
  return Boolean(key?.trim());
}

function asaasError(text: string) {
  try {
    const body = JSON.parse(text) as { errors?: { description?: string }[] };
    const description = (body.errors ?? []).map((item) => item.description?.trim() ?? "").filter(Boolean).join(" ");
    if (!description || /\$aact|access_token|ASAAS_API_KEY/i.test(description)) return "";
    return description.slice(0, 180);
  } catch {
    return "";
  }
}

async function asaasRequest<T>(method: "GET" | "POST" | "PUT" | "DELETE", path: string, params: Record<string, string>, body?: unknown): Promise<T> {
  const { key, base } = config();
  const url = new URL(`${base}${path}`);
  for (const [name, value] of Object.entries(params)) url.searchParams.set(name, value);
  const response = await fetch(url, {
    method,
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      access_token: key,
      "User-Agent": "NEX-Ads/1.0 (https://app.nexmeta.com.br)",
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(12000),
  });
  const text = await response.text();
  if (response.status === 401 || response.status === 403) fail("A chave do Asaas foi recusada.");
  if (!response.ok) fail(asaasError(text) || asaasFailure(method));
  return (text ? JSON.parse(text) : {}) as T;
}

function asaasFailure(method: "GET" | "POST" | "PUT" | "DELETE") {
  if (method === "GET") return "Não foi possível consultar o Asaas agora.";
  if (method === "POST") return "Não foi possível gerar o Pix do valor nominal no Asaas.";
  if (method === "DELETE") return "Não foi possível excluir a cobrança vencida no Asaas.";
  return "Não foi possível atualizar a cobrança no Asaas.";
}

async function asaasGet<T>(path: string, params: Record<string, string>) {
  return asaasRequest<T>("GET", path, params);
}

export type AsaasPayment = {
  id?: string;
  customer?: string;
  billingType?: string;
  value?: number;
  originalValue?: number | null;
  interestValue?: number | null;
  dueDate?: string | null;
  status?: string;
  paymentDate?: string | null;
  clientPaymentDate?: string | null;
  invoiceUrl?: string | null;
  deleted?: boolean;
  fine?: { value?: number; type?: string } | null;
  interest?: { value?: number } | null;
};

function externalId(value: string, label: string) {
  const id = value.trim();
  if (!/^[A-Za-z0-9_]{1,64}$/.test(id)) fail(`${label} do Asaas é inválido.`);
  return id;
}

export async function listSubscriptionPayments(subscriptionId: string): Promise<AsaasPayment[]> {
  const id = externalId(subscriptionId, "A assinatura");
  const all: AsaasPayment[] = [];
  let offset = 0;
  for (let page = 0; page < 5; page += 1) {
    const result = await asaasGet<{ data?: AsaasPayment[]; hasMore?: boolean }>("/payments", {
      subscription: id,
      limit: "100",
      offset: String(offset),
    });
    all.push(...(result.data ?? []).filter((item) => item.id && !item.deleted));
    if (!result.hasMore) break;
    offset += 100;
  }
  return all;
}

export async function getPayment(paymentId: string) {
  const id = externalId(paymentId, "A cobrança");
  return asaasRequest<AsaasPayment>("GET", `/payments/${id}`, {});
}

export async function waivePaymentPenalties(paymentId: string, input: { waiveFine: boolean; waiveInterest: boolean; nominal: number | null }) {
  const id = externalId(paymentId, "A cobrança");
  const current = await getPayment(id);
  if (!current.billingType || !current.dueDate || typeof current.value !== "number") fail("A cobrança do Asaas está incompleta.");
  const body: {
    billingType: string;
    value: number;
    dueDate: string;
    fine?: { value: number; type: "PERCENTAGE" };
    interest?: { value: number };
  } = {
    billingType: current.billingType,
    value: input.nominal ?? current.value,
    dueDate: current.dueDate.slice(0, 10),
  };
  if (input.waiveFine) body.fine = { value: 0, type: "PERCENTAGE" };
  if (input.waiveInterest) body.interest = { value: 0 };
  return asaasRequest<AsaasPayment>("PUT", `/payments/${id}`, {}, body);
}

export async function createNominalPix(input: { customer: string; value: number; dueDate: string; description: string; externalReference: string }) {
  return asaasRequest<AsaasPayment>("POST", "/payments", {}, {
    customer: input.customer,
    billingType: "PIX",
    value: input.value,
    dueDate: input.dueDate,
    description: input.description,
    externalReference: input.externalReference,
    fine: { value: 0, type: "PERCENTAGE" },
    interest: { value: 0 },
  });
}

export async function deletePayment(paymentId: string) {
  const id = externalId(paymentId, "A cobrança");
  try {
    await asaasRequest<AsaasPayment>("DELETE", `/payments/${id}`, {});
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (/não encontrad|não existe|já foi removid|deleted/i.test(message)) return;
    throw error;
  }
}

export async function readPaymentPix(paymentId: string): Promise<{ payload: string; image: string } | null> {
  const id = externalId(paymentId, "A cobrança");
  try {
    const data = await asaasRequest<{ payload?: string; encodedImage?: string }>("GET", `/payments/${id}/pixQrCode`, {});
    if (!data.payload) return null;
    return { payload: data.payload, image: data.encodedImage ?? "" };
  } catch (error) {
    if (error instanceof Error && error.message === "Não foi possível consultar o Asaas agora.") return null;
    throw error;
  }
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
