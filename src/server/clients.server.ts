import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { ClientDraft, ClientInvoice, ClientStatus, InvoiceStatus, ListedClient } from "@/lib/client-access";
import { assertCoraAmounts, chargeCents, contractDueDates, coraDelinquencyFine, coraPaymentTerms, noticeSchedule, promotionsOverlap } from "@/lib/billing-plan";
import { masterDashboardFrom, type MasterDashboard } from "@/lib/master-dashboard";
import { createCoraInvoice } from "@/server/cora.server";

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
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    fail(`${label} não é uma data válida.`);
  }
  return `${String(year).padStart(4, "0")}-${match[2]}-${match[1]}`;
}

function migrationMessage(message: string) {
  if (/client_promotions/i.test(message)) {
    return "A migração do histórico de promoções ainda não foi aplicada no Supabase.";
  }
  if (/ads_meta|ads_google/i.test(message)) {
    return "A migração das plataformas de anúncio ainda não foi aplicada no Supabase.";
  }
  if (/billing_provider|promo_enabled|delinquency_mode|billing_notices|schema cache|does not exist/i.test(message)) {
    return "A migração da cobrança Cora ainda não foi aplicada no Supabase.";
  }
  return message;
}

function parseDraft(input: ClientDraft) {
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
  if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 28)
    fail("O vencimento precisa ser um dia entre 1 e 28.");
  const billingProvider = input.billingProvider;
  if (billingProvider !== "asaas" && billingProvider !== "cora") fail("Escolha a cobrança pela Cora ou pelo Asaas.");
  if (!input.adsMeta && !input.adsGoogle) fail("Informe se o cliente usa Meta Ads, Google Ads ou os dois.");
  const startsOn = parseDate(input.startsOn, "o início do contrato");
  const endsOn = input.endsOn.trim() ? parseDate(input.endsOn, "o término do contrato") : null;
  if (billingProvider === "cora" && !endsOn) fail("Informe o término do contrato para gerar as cobranças da Cora.");
  if (endsOn && endsOn < startsOn) fail("O término do contrato não pode ser antes do início.");
  const finePercent = input.finePercent.trim() ? Number(digits(input.finePercent)) / 100 : 0;
  const interestPercent = input.interestPercent.trim()
    ? Number(digits(input.interestPercent)) / 100
    : 0;
  if (!Number.isFinite(finePercent) || finePercent < 0 || finePercent > 100)
    fail("Informe a multa entre 0% e 100%.");
  if (!Number.isFinite(interestPercent) || interestPercent < 0 || interestPercent > 100)
    fail("Informe os juros entre 0% e 100%.");
  const asaasSubscriptionId = billingProvider === "asaas" ? input.asaasSubscriptionId.trim() : "";
  if (asaasSubscriptionId && !/^[A-Za-z0-9_]{1,64}$/.test(asaasSubscriptionId))
    fail("A assinatura do Asaas é inválida.");
  const promoEnabled = billingProvider === "cora" && input.promoEnabled;
  const promoStartsOn = promoEnabled ? parseDate(input.promoStartsOn, "o início da promoção") : null;
  const promoEndsOn = promoEnabled ? parseDate(input.promoEndsOn, "o fim da promoção") : null;
  if (promoStartsOn && promoEndsOn && promoEndsOn < promoStartsOn) fail("O fim da promoção não pode ser antes do início.");
  if (promoStartsOn && endsOn && (promoStartsOn < startsOn || (promoEndsOn && promoEndsOn > endsOn))) {
    fail("A promoção precisa ficar dentro do contrato.");
  }
  const afterDigits = digits(input.afterPromoFee);
  const afterPromoCents = promoEnabled ? Number(afterDigits) : null;
  if (promoEnabled && !afterDigits) fail("Informe o valor cobrado depois da promoção.");
  const delinquencyMode = billingProvider === "cora" ? input.delinquencyMode : "";
  if (billingProvider === "cora" && delinquencyMode !== "rate" && delinquencyMode !== "amount") {
    fail("Escolha juros e multa ou um valor fixo para a inadimplência.");
  }
  const delinquencyAmountCents = delinquencyMode === "amount" ? Number(digits(input.delinquencyAmount)) : null;
  if (delinquencyMode === "amount" && (!delinquencyAmountCents || delinquencyAmountCents <= 0)) {
    fail("Informe o valor cobrado na inadimplência.");
  }
  const whatsapp = input.whatsapp.trim();
  return {
    legalName,
    document,
    responsibleName,
    responsibleEmail,
    whatsapp,
    financePhone: input.sameFinancePhone ? whatsapp : "não informado",
    billingProvider,
    adsMeta: input.adsMeta,
    adsGoogle: input.adsGoogle,
    monthlyFeeCents: Number(feeDigits),
    dueDay,
    startsOn,
    endsOn,
    finePercent,
    interestPercent,
    asaasSubscriptionId,
    promoEnabled,
    promoStartsOn,
    promoEndsOn,
    afterPromoCents,
    delinquencyMode: delinquencyMode === "rate" || delinquencyMode === "amount" ? delinquencyMode : null,
    delinquencyAmountCents,
  };
}

async function requireMaster(userId: string) {
  const [{ data: profile, error: profileError }, { data: roles, error: roleError }] =
    await Promise.all([
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

async function loadOrganizations() {
  const full = await supabaseAdmin
    .from("organizations")
    .select(
      "id, legal_name, document, responsible_name, responsible_email, responsible_phone, finance_phone, status, ads_meta, ads_google",
    )
    .order("legal_name");
  if (!full.error || !/ads_meta|ads_google/i.test(full.error.message)) return full;
  const basic = await supabaseAdmin
    .from("organizations")
    .select(
      "id, legal_name, document, responsible_name, responsible_email, responsible_phone, finance_phone, status",
    )
    .order("legal_name");
  return {
    data: (basic.data ?? []).map((row) => ({ ...row, ads_meta: true, ads_google: false })),
    error: basic.error,
  };
}

type PromotionRow = {
  id: string;
  organization_id: string;
  starts_on: string;
  ends_on: string;
  amount_cents: number;
  nominal_cents: number;
};

async function loadPromotions() {
  const result = await supabaseAdmin
    .from("client_promotions")
    .select("id, organization_id, starts_on, ends_on, amount_cents, nominal_cents")
    .order("starts_on");
  if (!result.error || !/client_promotions|schema cache|does not exist/i.test(result.error.message)) return result;
  return { data: [] as PromotionRow[], error: null };
}

function promotionsOf(
  organizationId: string,
  contract: {
    promo_enabled?: boolean | null;
    promo_starts_on?: string | null;
    promo_ends_on?: string | null;
    monthly_fee_cents?: number | null;
    after_promo_cents?: number | null;
  } | null,
  rows: PromotionRow[] | null,
) {
  const stored = (rows ?? [])
    .filter((row) => row.organization_id === organizationId)
    .map((row) => ({
      id: row.id,
      startsOn: row.starts_on,
      endsOn: row.ends_on,
      amountCents: Number(row.amount_cents),
      nominalCents: Number(row.nominal_cents),
    }));
  if (stored.length) return stored;
  if (!contract?.promo_enabled || !contract.promo_starts_on || !contract.promo_ends_on || contract.after_promo_cents == null) {
    return [];
  }
  return [
    {
      id: `contract:${organizationId}`,
      startsOn: contract.promo_starts_on,
      endsOn: contract.promo_ends_on,
      amountCents: Number(contract.monthly_fee_cents),
      nominalCents: Number(contract.after_promo_cents),
    },
  ];
}

export async function listClients(userId: string): Promise<ListedClient[]> {
  await requireMaster(userId);
  const [
    { data: organizations, error: orgError },
    { data: contracts, error: contractError },
    { data: accounts, error: accountError },
    { data: invoices, error: invoiceError },
    { data: profiles, error: profileError },
    { data: promotionRows, error: promotionError },
  ] = await Promise.all([
    loadOrganizations(),
    loadContracts(),
    supabaseAdmin
      .from("meta_accounts")
      .select(
        "organization_id, external_account_id, name, portfolio_id, balance_cents, balance_url, selected, sync_status, last_synced_at",
      ),
    supabaseAdmin
      .from("invoices")
      .select("organization_id, competence, due_date, total_amount_cents, status, paid_at")
      .order("due_date", { ascending: false }),
    supabaseAdmin.from("profiles").select("id, email, organization_id"),
    loadPromotions(),
  ]);
  if (orgError) fail(orgError.message);
  if (contractError) fail(contractError.message);
  if (accountError) fail(accountError.message);
  if (invoiceError) fail(invoiceError.message);
  if (profileError) fail(profileError.message);
  if (promotionError) fail(promotionError.message);

  const profileIds = (profiles ?? []).map((row) => row.id);
  const roles = profileIds.length
    ? await supabaseAdmin.from("user_roles").select("user_id, role").in("user_id", profileIds)
    : { data: [], error: null };
  if (roles.error) fail(roles.error.message);
  const adminIds = new Set(
    (roles.data ?? []).filter((row) => row.role === "client_admin").map((row) => row.user_id),
  );

  return (organizations ?? []).map((org) => {
    const contract = (contracts ?? []).find((row) => row.organization_id === org.id) ?? null;
    const orgAccounts = (accounts ?? []).filter((row) => row.organization_id === org.id);
    const manualAccounts = orgAccounts.filter(
      (row) => row.sync_status === "manual" && !row.external_account_id.startsWith(manualPrefix),
    );
    const portfolio =
      orgAccounts.find((row) => row.portfolio_id?.trim())?.portfolio_id?.trim() ||
      orgAccounts
        .find((row) => row.external_account_id.startsWith(manualPrefix))
        ?.external_account_id.slice(manualPrefix.length) ||
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
    const access =
      (profiles ?? []).find((row) => row.organization_id === org.id && adminIds.has(row.id)) ??
      null;
    const balanceKnown = orgAccounts.some((row) => row.last_synced_at);
    const status = org.status as ClientStatus;
    return {
      id: org.id,
      legalName: org.legal_name,
      document: org.document,
      responsibleName: org.responsible_name,
      responsibleEmail: org.responsible_email,
      whatsapp: org.responsible_phone === "não informado" ? "" : org.responsible_phone,
      sameFinancePhone:
        org.finance_phone !== "não informado" && org.finance_phone === org.responsible_phone,
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
      billingProvider: contract?.billing_provider === "cora" || contract?.billing_provider === "asaas" ? contract.billing_provider : "",
      adsMeta: org.ads_meta !== false,
      adsGoogle: org.ads_google === true,
      promoEnabled: contract?.promo_enabled === true,
      promoStartsOn: contract?.promo_starts_on ?? null,
      promoEndsOn: contract?.promo_ends_on ?? null,
      afterPromoCents: contract?.after_promo_cents == null ? null : Number(contract.after_promo_cents),
      promotions: promotionsOf(org.id, contract, promotionRows),
      delinquencyMode: contract?.delinquency_mode === "rate" || contract?.delinquency_mode === "amount" ? contract.delinquency_mode : "",
      delinquencyAmountCents: contract?.delinquency_amount_cents == null ? null : Number(contract.delinquency_amount_cents),
      portfolioId: portfolio,
      balanceUrl: orgAccounts.find((row) => row.selected)?.balance_url?.trim() || "",
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

const contractColumns =
  "organization_id, monthly_fee_cents, due_day, starts_on, ends_on, fine_percent, interest_percent_monthly, external_subscription_id, billing_provider, promo_enabled, promo_starts_on, promo_ends_on, after_promo_cents, delinquency_mode, delinquency_amount_cents";

async function loadContracts() {
  const full = await supabaseAdmin.from("contracts").select(contractColumns);
  if (!full.error) return full;
  if (!/billing_provider|promo_|delinquency_|schema cache|does not exist/i.test(full.error.message)) return full;
  const basic = await supabaseAdmin
    .from("contracts")
    .select("organization_id, monthly_fee_cents, due_day, starts_on, ends_on, fine_percent, interest_percent_monthly, external_subscription_id");
  return {
    data: (basic.data ?? []).map((row) => ({
      ...row,
      billing_provider: null,
      promo_enabled: false,
      promo_starts_on: null,
      promo_ends_on: null,
      after_promo_cents: null,
      delinquency_mode: null,
      delinquency_amount_cents: null,
    })),
    error: basic.error,
  };
}

async function saveContract(organizationId: string, parsed: ReturnType<typeof parseDraft>) {
  const { error } = await supabaseAdmin.from("contracts").upsert(
    {
      organization_id: organizationId,
      monthly_fee_cents: parsed.monthlyFeeCents,
      due_day: parsed.dueDay,
      starts_on: parsed.startsOn,
      ends_on: parsed.endsOn,
      fine_percent: parsed.finePercent,
      interest_percent_monthly: parsed.interestPercent,
      external_subscription_id: parsed.asaasSubscriptionId || null,
      billing_provider: parsed.billingProvider,
      promo_enabled: parsed.promoEnabled,
      promo_starts_on: parsed.promoStartsOn,
      promo_ends_on: parsed.promoEndsOn,
      after_promo_cents: parsed.afterPromoCents,
      delinquency_mode: parsed.delinquencyMode,
      delinquency_amount_cents: parsed.delinquencyAmountCents,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "organization_id" },
  );
  if (error) fail(migrationMessage(error.message));
  await rememberPromotion(organizationId, parsed);
}

async function rememberPromotion(organizationId: string, parsed: ReturnType<typeof parseDraft>) {
  if (!parsed.promoEnabled || !parsed.promoStartsOn || !parsed.promoEndsOn || parsed.afterPromoCents == null) return;
  const existing = await supabaseAdmin
    .from("client_promotions")
    .select("id, starts_on")
    .eq("organization_id", organizationId);
  if (existing.error) {
    if (/client_promotions|schema cache|does not exist/i.test(existing.error.message)) return;
    fail(migrationMessage(existing.error.message));
  }
  const same = (existing.data ?? []).find((row) => row.starts_on === parsed.promoStartsOn);
  const payload = {
    ends_on: parsed.promoEndsOn,
    amount_cents: parsed.monthlyFeeCents,
    nominal_cents: parsed.afterPromoCents,
  };
  const saved = same
    ? await supabaseAdmin.from("client_promotions").update(payload).eq("id", same.id)
    : await supabaseAdmin.from("client_promotions").insert({
        organization_id: organizationId,
        starts_on: parsed.promoStartsOn,
        ...payload,
      });
  if (saved.error) fail(migrationMessage(saved.error.message));
}

async function issueCoraCharges(organizationId: string, parsed: ReturnType<typeof parseDraft>) {
  if (parsed.billingProvider !== "cora" || !parsed.endsOn || !parsed.delinquencyMode) return;
  const existing = await supabaseAdmin.from("invoices").select("id").eq("organization_id", organizationId).limit(1);
  if (existing.error) fail(migrationMessage(existing.error.message));
  if ((existing.data ?? []).length) return;
  const today = new Date().toISOString().slice(0, 10);
  const dues = contractDueDates(parsed.startsOn, parsed.endsOn, parsed.dueDay, today);
  if (!dues.length) fail("Não há vencimento futuro até o término do contrato.");
  const promo =
    parsed.promoEnabled && parsed.promoStartsOn && parsed.promoEndsOn && parsed.afterPromoCents != null
      ? { startsOn: parsed.promoStartsOn, endsOn: parsed.promoEndsOn, afterCents: parsed.afterPromoCents }
      : null;
  const amounts = dues.map((due) => chargeCents(due, parsed.monthlyFeeCents, promo));
  const amountError = assertCoraAmounts(amounts);
  if (amountError) fail(amountError);
  const fines =
    parsed.delinquencyMode === "amount"
      ? amounts.map((amount) => coraDelinquencyFine(amount, parsed.delinquencyAmountCents ?? 0))
      : amounts.map(() => 0);
  if (fines.some((fine) => fine < 0)) {
    fail("O valor da inadimplência precisa ser igual ou maior que cada mensalidade gerada.");
  }
  const contract = await supabaseAdmin.from("contracts").select("id").eq("organization_id", organizationId).maybeSingle();
  if (contract.error || !contract.data) fail(migrationMessage(contract.error?.message || "Não foi possível localizar o contrato."));
  for (let index = 0; index < dues.length; index += 1) {
    const due = dues[index] ?? "";
    const amount = amounts[index] ?? 0;
    const created = await createCoraInvoice({
      code: `${organizationId}:${due}`,
      name: parsed.legalName,
      email: parsed.responsibleEmail,
      document: parsed.document,
      amountCents: amount,
      paymentTerms: coraPaymentTerms(due, parsed.delinquencyMode, parsed.finePercent, parsed.interestPercent, fines[index] ?? 0),
    });
    const inserted = await supabaseAdmin.from("invoices").insert({
      organization_id: organizationId,
      contract_id: contract.data.id,
      competence: due,
      due_date: due,
      base_amount_cents: amount,
      total_amount_cents: amount,
      status: "pending",
      external_charge_id: created.id,
      invoice_url: created.url || null,
      pix_code: created.pixCode || null,
    });
    if (inserted.error) fail(migrationMessage(inserted.error.message));
    const notices = noticeSchedule(due).map((item) => ({
      organization_id: organizationId,
      due_date: due,
      kind: item.kind,
      send_on: item.sendOn,
      status: "pending",
      body: "",
    }));
    const savedNotices = await supabaseAdmin.from("billing_notices").insert(notices);
    if (savedNotices.error) fail(migrationMessage(savedNotices.error.message));
  }
}

export async function createClient(userId: string, input: ClientDraft) {
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
      ads_meta: parsed.adsMeta,
      ads_google: parsed.adsGoogle,
      status: "active",
    })
    .select("id")
    .single();
  if (orgError || !org)
    fail(
      orgError && duplicateDocument(orgError.message, orgError.code)
        ? "Já existe um cliente com este CPF ou CNPJ."
        : migrationMessage(orgError?.message || "Não foi possível criar o cliente."),
    );
  try {
    await saveContract(org.id, parsed);
    await issueCoraCharges(org.id, parsed);
    await audit(userId, org.id, "client.create");
  } catch (error) {
    await supabaseAdmin.from("organizations").delete().eq("id", org.id);
    throw error;
  }
  return { id: org.id };
}

export async function updateClient(userId: string, id: string, input: ClientDraft) {
  await requireMaster(userId);
  const parsed = parseDraft(input);
  const { data: current, error: currentError } = await supabaseAdmin
    .from("organizations")
    .select("id")
    .eq("id", id)
    .maybeSingle();
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
      ads_meta: parsed.adsMeta,
      ads_google: parsed.adsGoogle,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error)
    fail(
      duplicateDocument(error.message, error.code)
        ? "Já existe um cliente com este CPF ou CNPJ."
        : migrationMessage(error.message),
    );
  await saveContract(id, parsed);
  await issueCoraCharges(id, parsed);
  await audit(userId, id, "client.update");
  return { id };
}

async function promotionList(organizationId: string) {
  const { data, error } = await supabaseAdmin
    .from("client_promotions")
    .select("id, starts_on, ends_on, amount_cents, nominal_cents")
    .eq("organization_id", organizationId)
    .order("starts_on");
  if (error) fail(migrationMessage(error.message));
  return (data ?? []).map((row) => ({
    id: row.id,
    startsOn: row.starts_on,
    endsOn: row.ends_on,
    amountCents: Number(row.amount_cents),
    nominalCents: Number(row.nominal_cents),
  }));
}

export async function addClientPromotion(
  userId: string,
  input: { id: string; amount: string; startsOn: string; endsOn: string },
) {
  await requireMaster(userId);
  const amountCents = Number(digits(input.amount));
  if (!amountCents || amountCents < 500) fail("A mensalidade promocional precisa ser de pelo menos R$ 5,00.");
  const startsOn = parseDate(input.startsOn, "o início da promoção");
  const endsOn = parseDate(input.endsOn, "o fim da promoção");
  if (endsOn < startsOn) fail("O fim da promoção não pode ser antes do início.");
  const { data: contract, error } = await supabaseAdmin
    .from("contracts")
    .select("id, starts_on, ends_on, monthly_fee_cents, promo_enabled, promo_starts_on, promo_ends_on, after_promo_cents")
    .eq("organization_id", input.id)
    .maybeSingle();
  if (error) fail(migrationMessage(error.message));
  if (!contract) fail("Este cliente ainda não tem contrato.");
  if (startsOn < contract.starts_on || (contract.ends_on && endsOn > contract.ends_on)) {
    fail("A promoção precisa ficar dentro do contrato.");
  }
  const nominalCents =
    contract.after_promo_cents != null ? Number(contract.after_promo_cents) : Number(contract.monthly_fee_cents);
  let current = await promotionList(input.id);
  if (
    !current.length &&
    contract.promo_enabled &&
    contract.promo_starts_on &&
    contract.promo_ends_on &&
    contract.after_promo_cents != null
  ) {
    const seeded = await supabaseAdmin.from("client_promotions").insert({
      organization_id: input.id,
      starts_on: contract.promo_starts_on,
      ends_on: contract.promo_ends_on,
      amount_cents: contract.monthly_fee_cents,
      nominal_cents: contract.after_promo_cents,
    });
    if (seeded.error) fail(migrationMessage(seeded.error.message));
    current = await promotionList(input.id);
  }
  if (promotionsOverlap([...current, { startsOn, endsOn }])) {
    fail("Essa promoção cruza outra promoção já registrada.");
  }
  const inserted = await supabaseAdmin.from("client_promotions").insert({
    organization_id: input.id,
    starts_on: startsOn,
    ends_on: endsOn,
    amount_cents: amountCents,
    nominal_cents: nominalCents,
  });
  if (inserted.error) fail(migrationMessage(inserted.error.message));
  if (!contract.promo_enabled) {
    const updated = await supabaseAdmin
      .from("contracts")
      .update({
        promo_enabled: true,
        promo_starts_on: startsOn,
        promo_ends_on: endsOn,
        monthly_fee_cents: amountCents,
        after_promo_cents: nominalCents,
        updated_at: new Date().toISOString(),
      })
      .eq("id", contract.id);
    if (updated.error) fail(migrationMessage(updated.error.message));
  }
  await audit(userId, input.id, "client.promotion");
  return { promotions: await promotionList(input.id) };
}

export async function updateClientPromotionEnd(
  userId: string,
  input: { id: string; promotionId: string; endsOn: string },
) {
  await requireMaster(userId);
  const endsOn = parseDate(input.endsOn, "o fim da promoção");
  const { data: contract, error } = await supabaseAdmin
    .from("contracts")
    .select("id, starts_on, ends_on, monthly_fee_cents, after_promo_cents, promo_starts_on")
    .eq("organization_id", input.id)
    .maybeSingle();
  if (error) fail(migrationMessage(error.message));
  if (!contract) fail("Este cliente ainda não tem contrato.");
  if (endsOn < contract.starts_on || (contract.ends_on && endsOn > contract.ends_on)) {
    fail("A promoção precisa ficar dentro do contrato.");
  }
  if (input.promotionId.startsWith("contract:")) {
    if (!contract.promo_starts_on || endsOn < contract.promo_starts_on) {
      fail("O fim da promoção não pode ser antes do início.");
    }
    const updated = await supabaseAdmin
      .from("contracts")
      .update({ promo_ends_on: endsOn, updated_at: new Date().toISOString() })
      .eq("id", contract.id);
    if (updated.error) fail(migrationMessage(updated.error.message));
    await audit(userId, input.id, "client.promotion_end");
    const stored = await promotionList(input.id);
    if (stored.length) return { promotions: stored };
    return {
      promotions: [
        {
          id: input.promotionId,
          startsOn: contract.promo_starts_on,
          endsOn,
          amountCents: Number(contract.monthly_fee_cents),
          nominalCents: Number(contract.after_promo_cents ?? contract.monthly_fee_cents),
        },
      ],
    };
  }
  const current = await promotionList(input.id);
  const target = current.find((row) => row.id === input.promotionId);
  if (!target) fail("Promoção não encontrada.");
  if (endsOn < target.startsOn) fail("O fim da promoção não pode ser antes do início.");
  if (promotionsOverlap(current.map((row) => (row.id === target.id ? { ...row, endsOn } : row)))) {
    fail("Essa promoção cruza outra promoção já registrada.");
  }
  const saved = await supabaseAdmin.from("client_promotions").update({ ends_on: endsOn }).eq("id", target.id);
  if (saved.error) fail(migrationMessage(saved.error.message));
  if (contract.promo_starts_on === target.startsOn) {
    const updated = await supabaseAdmin
      .from("contracts")
      .update({ promo_ends_on: endsOn, updated_at: new Date().toISOString() })
      .eq("id", contract.id);
    if (updated.error) fail(migrationMessage(updated.error.message));
  }
  await audit(userId, input.id, "client.promotion_end");
  return { promotions: await promotionList(input.id) };
}

export async function updateContractEnd(userId: string, input: { id: string; endsOn: string }) {
  await requireMaster(userId);
  const endsOn = parseDate(input.endsOn, "o término do contrato");
  const { data: contract, error } = await supabaseAdmin
    .from("contracts")
    .select("id, starts_on, promo_enabled, promo_ends_on")
    .eq("organization_id", input.id)
    .maybeSingle();
  if (error) fail(migrationMessage(error.message));
  if (!contract) fail("Este cliente ainda não tem contrato.");
  if (endsOn < contract.starts_on) fail("O término do contrato não pode ser antes do início.");
  if (contract.promo_enabled && contract.promo_ends_on && contract.promo_ends_on > endsOn) {
    fail("O fim da promoção precisa ficar dentro do contrato.");
  }
  const { error: updateError } = await supabaseAdmin
    .from("contracts")
    .update({ ends_on: endsOn, updated_at: new Date().toISOString() })
    .eq("id", contract.id);
  if (updateError) fail(migrationMessage(updateError.message));
  await audit(userId, input.id, "client.contract_end");
  return { endsOn };
}

export async function updateContractSchedule(
  userId: string,
  input: { id: string; dueDay: string; promoEndsOn: string },
) {
  await requireMaster(userId);
  const dueDay = Number(digits(input.dueDay));
  if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 28) {
    fail("O vencimento precisa ser um dia entre 1 e 28.");
  }
  const { data: contract, error } = await supabaseAdmin
    .from("contracts")
    .select("id, starts_on, ends_on, promo_enabled, promo_starts_on, promo_ends_on")
    .eq("organization_id", input.id)
    .maybeSingle();
  if (error) fail(migrationMessage(error.message));
  if (!contract) fail("Este cliente ainda não tem contrato.");
  let promoEndsOn = contract.promo_ends_on;
  if (contract.promo_enabled && input.promoEndsOn.trim()) {
    promoEndsOn = parseDate(input.promoEndsOn, "o fim da promoção");
    if (contract.promo_starts_on && promoEndsOn < contract.promo_starts_on) {
      fail("O fim da promoção não pode ser antes do início.");
    }
    if (promoEndsOn < contract.starts_on || (contract.ends_on && promoEndsOn > contract.ends_on)) {
      fail("O fim da promoção precisa ficar dentro do contrato.");
    }
  }
  const { error: updateError } = await supabaseAdmin
    .from("contracts")
    .update({
      due_day: dueDay,
      promo_ends_on: promoEndsOn,
      updated_at: new Date().toISOString(),
    })
    .eq("id", contract.id);
  if (updateError) fail(migrationMessage(updateError.message));
  await audit(userId, input.id, "client.schedule");
  return { dueDay, promoEndsOn };
}

export async function setClientStatus(userId: string, id: string, active: boolean) {
  await requireMaster(userId);
  const { data: current, error: currentError } = await supabaseAdmin
    .from("organizations")
    .select("id, status")
    .eq("id", id)
    .maybeSingle();
  if (currentError) fail(currentError.message);
  if (!current) fail("Cliente não encontrado.");
  const status: ClientStatus = active ? "active" : "disabled";
  const { error } = await supabaseAdmin
    .from("organizations")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) fail(error.message);
  await audit(userId, id, active ? "client.activate" : "client.deactivate");
}

export async function openClientSupport(userId: string, id: string) {
  await requireMaster(userId);
  const { data, error } = await supabaseAdmin
    .from("organizations")
    .select("id, legal_name")
    .eq("id", id)
    .maybeSingle();
  if (error) fail(error.message);
  if (!data) fail("Cliente não encontrado.");
  await audit(userId, id, "client.support");
  return { id: data.id, legalName: data.legal_name };
}
