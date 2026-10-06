import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { ClientInvoice, ClientStatus, InvoiceStatus, ListedClient } from "@/lib/client-access";
import { masterDashboardFrom, type MasterDashboard } from "@/lib/master-dashboard";

type Draft = {
  legalName: string;
  document: string;
  responsibleName: string;
  responsibleEmail: string;
  whatsapp: string;
  sameFinancePhone: boolean;
  monthlyFee: string;
  dueDay: string;
  startsOn: string;
  endsOn: string;
  finePercent: string;
  interestPercent: string;
  asaasSubscriptionId: string;
};

function fail(message: string): never {
  throw new Error(message);
}

function digits(value: string) {
  return value.replace(/\D/g, "");
}

function emailOf(value: string, label: string) {
  const email = value.trim().toLowerCase();
  if (!email.includes("@") || email.length > 320) fail(`Informe um ${label} válido.`);
  return email;
}

function parseDate(value: string, label: string) {
  const match = value.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) fail(`Informe ${label} no formato DD/MM/AAAA.`);
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    fail(`${label} não é uma data válida.`);
  }
  return `${String(year).padStart(4, "0")}-${match[2]}-${match[1]}`;
}

function parseDraft(input: Draft) {
  const legalName = input.legalName.trim();
  const responsibleName = input.responsibleName.trim();
  const document = digits(input.document);
  const phone = digits(input.whatsapp);
  if (legalName.length < 2) fail("Informe a razão social.");
  if (document.length !== 11 && document.length !== 14) fail("Informe um CPF ou CNPJ válido.");
  if (responsibleName.length < 2) fail("Informe o responsável.");
  const responsibleEmail = emailOf(input.responsibleEmail, "e-mail do responsável");
  if (phone.length < 10 || phone.length > 11) fail("Informe o WhatsApp com DDD.");
  const feeDigits = digits(input.monthlyFee);
  if (!feeDigits) fail("Informe a mensalidade.");
  const dueDay = Number(digits(input.dueDay));
  if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 28) fail("O vencimento precisa ser um dia entre 1 e 28.");
  const startsOn = parseDate(input.startsOn, "o início do contrato");
  const endsOn = input.endsOn.trim() ? parseDate(input.endsOn, "o término do contrato") : null;
  if (endsOn && endsOn < startsOn) fail("O término do contrato não pode ser antes do início.");
  const finePercent = input.finePercent.trim() ? Number(digits(input.finePercent)) / 100 : 0;
  const interestPercent = input.interestPercent.trim() ? Number(digits(input.interestPercent)) / 100 : 0;
  if (!Number.isFinite(finePercent) || finePercent < 0 || finePercent > 100) fail("Informe a multa entre 0% e 100%.");
  if (!Number.isFinite(interestPercent) || interestPercent < 0 || interestPercent > 100) fail("Informe os juros entre 0% e 100%.");
  const asaasSubscriptionId = input.asaasSubscriptionId.trim();
  if (asaasSubscriptionId && !/^[A-Za-z0-9_]{1,64}$/.test(asaasSubscriptionId)) fail("A assinatura do Asaas é inválida.");
  const whatsapp = input.whatsapp.trim();
  return {
    legalName,
    document,
    responsibleName,
    responsibleEmail,
    whatsapp,
    financePhone: input.sameFinancePhone ? whatsapp : "não informado",
    monthlyFeeCents: Number(feeDigits),
    dueDay,
    startsOn,
    endsOn,
    finePercent,
    interestPercent,
    asaasSubscriptionId,
  };
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

function duplicateDocument(message: string, code?: string) {
  return code === "23505" || /duplicate|unique/i.test(message);
}

async function audit(actorId: string, organizationId: string, action: string) {
  await supabaseAdmin.from("audit_logs").insert({
    organization_id: organizationId,
    actor_id: actorId,
    action,
    entity_type: "organization",
    entity_id: organizationId,
    details: {},
  });
}

const manualPrefix = "nex-portfolio:";

function financeLabel(invoices: ClientInvoice[]) {
  const current = invoices[0];
  if (!current) return "Sem cobrança";
  if (current.status === "paid") return "Em dia";
  if (current.status === "overdue") return "Em atraso";
  if (current.status === "cancelled") return "Cancelada";
  return "Em aberto";
}

export async function listClients(userId: string): Promise<ListedClient[]> {
  await requireMaster(userId);
  const [{ data: organizations, error: orgError }, { data: contracts, error: contractError }, { data: accounts, error: accountError }, { data: invoices, error: invoiceError }, { data: profiles, error: profileError }] =
    await Promise.all([
      supabaseAdmin.from("organizations").select("id, legal_name, document, responsible_name, responsible_email, responsible_phone, finance_phone, status").order("legal_name"),
      supabaseAdmin.from("contracts").select("organization_id, monthly_fee_cents, due_day, starts_on, ends_on, fine_percent, interest_percent_monthly, external_subscription_id"),
      supabaseAdmin.from("meta_accounts").select("organization_id, external_account_id, name, portfolio_id, balance_cents, sync_status, last_synced_at"),
      supabaseAdmin.from("invoices").select("organization_id, competence, due_date, total_amount_cents, status, paid_at").order("due_date", { ascending: false }),
      supabaseAdmin.from("profiles").select("id, email, organization_id"),
    ]);
  if (orgError) fail(orgError.message);
  if (contractError) fail(contractError.message);
  if (accountError) fail(accountError.message);
  if (invoiceError) fail(invoiceError.message);
  if (profileError) fail(profileError.message);

  const profileIds = (profiles ?? []).map((row) => row.id);
  const roles = profileIds.length
    ? await supabaseAdmin.from("user_roles").select("user_id, role").in("user_id", profileIds)
    : { data: [], error: null };
  if (roles.error) fail(roles.error.message);
  const adminIds = new Set((roles.data ?? []).filter((row) => row.role === "client_admin").map((row) => row.user_id));

  return (organizations ?? []).map((org) => {
    const contract = (contracts ?? []).find((row) => row.organization_id === org.id) ?? null;
    const orgAccounts = (accounts ?? []).filter((row) => row.organization_id === org.id);
    const manualAccounts = orgAccounts.filter((row) => row.sync_status === "manual" && !row.external_account_id.startsWith(manualPrefix));
    const portfolio =
      orgAccounts.find((row) => row.portfolio_id?.trim())?.portfolio_id?.trim() ||
      orgAccounts.find((row) => row.external_account_id.startsWith(manualPrefix))?.external_account_id.slice(manualPrefix.length) ||
      "";
    const orgInvoices: ClientInvoice[] = (invoices ?? [])
      .filter((row) => row.organization_id === org.id)
      .map((row) => ({
        competence: row.competence,
        dueDate: row.due_date,
        totalCents: Number(row.total_amount_cents),
        status: row.status as InvoiceStatus,
        paidAt: row.paid_at,
      }));
    const access = (profiles ?? []).find((row) => row.organization_id === org.id && adminIds.has(row.id)) ?? null;
    const balanceKnown = orgAccounts.some((row) => row.last_synced_at);
    const status = org.status as ClientStatus;
    return {
      id: org.id,
      legalName: org.legal_name,
      document: org.document,
      responsibleName: org.responsible_name,
      responsibleEmail: org.responsible_email,
      whatsapp: org.responsible_phone === "não informado" ? "" : org.responsible_phone,
      sameFinancePhone: org.finance_phone !== "não informado" && org.finance_phone === org.responsible_phone,
      status,
      balanceCents: orgAccounts.reduce((sum, row) => sum + Number(row.balance_cents), 0),
      balanceKnown,
      financeLabel: financeLabel(orgInvoices),
      monthlyFeeCents: contract ? Number(contract.monthly_fee_cents) : null,
      dueDay: contract?.due_day ?? null,
      startsOn: contract?.starts_on ?? null,
      endsOn: contract?.ends_on ?? null,
      finePercent: contract ? Number(contract.fine_percent) : null,
      interestPercent: contract ? Number(contract.interest_percent_monthly) : null,
      asaasSubscriptionId: contract?.external_subscription_id ?? "",
      portfolioId: portfolio,
      adAccountIds: manualAccounts.map((row) => row.external_account_id),
      metaAccounts: orgAccounts
        .filter((row) => !row.external_account_id.startsWith(manualPrefix))
        .map((row) => ({ id: row.external_account_id, name: row.name })),
      accessEmail: access?.email ?? "",
      accessUserId: access?.id ?? null,
      invoices: orgInvoices,
    };
  });
}

export async function masterDashboard(userId: string): Promise<MasterDashboard> {
  return masterDashboardFrom(await listClients(userId));
}

async function saveContract(
  organizationId: string,
  parsed: ReturnType<typeof parseDraft>,
) {
  const { error } = await supabaseAdmin.from("contracts").upsert(
    {
      organization_id: organizationId,
      monthly_fee_cents: parsed.monthlyFeeCents,
      due_day: parsed.dueDay,
      starts_on: parsed.startsOn,
      ends_on: parsed.endsOn,
      fine_percent: parsed.finePercent,
      interest_percent_monthly: parsed.interestPercent,
      ...(parsed.asaasSubscriptionId ? { external_subscription_id: parsed.asaasSubscriptionId } : {}),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "organization_id" },
  );
  if (error) fail(error.message);
}

export async function createClient(userId: string, input: Draft) {
  await requireMaster(userId);
  const parsed = parseDraft(input);
  const { data: org, error: orgError } = await supabaseAdmin
    .from("organizations")
    .insert({
      legal_name: parsed.legalName,
      document: parsed.document,
      responsible_name: parsed.responsibleName,
      responsible_email: parsed.responsibleEmail,
      responsible_phone: parsed.whatsapp,
      finance_phone: parsed.financePhone,
      status: "active",
    })
    .select("id")
    .single();
  if (orgError || !org) fail(orgError && duplicateDocument(orgError.message, orgError.code) ? "Já existe um cliente com este CPF ou CNPJ." : orgError?.message || "Não foi possível criar o cliente.");
  try {
    await saveContract(org.id, parsed);
    await audit(userId, org.id, "client.create");
  } catch (error) {
    await supabaseAdmin.from("organizations").delete().eq("id", org.id);
    throw error;
  }
  return { id: org.id };
}

export async function updateClient(userId: string, id: string, input: Draft) {
  await requireMaster(userId);
  const parsed = parseDraft(input);
  const { data: current, error: currentError } = await supabaseAdmin.from("organizations").select("id").eq("id", id).maybeSingle();
  if (currentError) fail(currentError.message);
  if (!current) fail("Cliente não encontrado.");
  const { error } = await supabaseAdmin
    .from("organizations")
    .update({
      legal_name: parsed.legalName,
      document: parsed.document,
      responsible_name: parsed.responsibleName,
      responsible_email: parsed.responsibleEmail,
      responsible_phone: parsed.whatsapp,
      finance_phone: parsed.financePhone,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) fail(duplicateDocument(error.message, error.code) ? "Já existe um cliente com este CPF ou CNPJ." : error.message);
  await saveContract(id, parsed);
  await audit(userId, id, "client.update");
  return { id };
}

export async function setClientStatus(userId: string, id: string, active: boolean) {
  await requireMaster(userId);
  const { data: current, error: currentError } = await supabaseAdmin.from("organizations").select("id, status").eq("id", id).maybeSingle();
  if (currentError) fail(currentError.message);
  if (!current) fail("Cliente não encontrado.");
  const status: ClientStatus = active ? "active" : "disabled";
  const { error } = await supabaseAdmin.from("organizations").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) fail(error.message);
  await audit(userId, id, active ? "client.activate" : "client.deactivate");
}

export async function openClientSupport(userId: string, id: string) {
  await requireMaster(userId);
  const { data, error } = await supabaseAdmin.from("organizations").select("id, legal_name").eq("id", id).maybeSingle();
  if (error) fail(error.message);
  if (!data) fail("Cliente não encontrado.");
  await audit(userId, id, "client.support");
  return { id: data.id, legalName: data.legal_name };
}
