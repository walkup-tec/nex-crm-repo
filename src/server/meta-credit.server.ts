import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { normalizeBalanceLink } from "@/lib/balance-link";
import {
  lowBalanceAlertStamp,
  lowBalanceAlreadyDelivered,
  lowBalanceSignal,
  shouldSendLowBalanceWhatsapp,
  whatsappNumber,
} from "@/lib/low-balance";
import { sendLowBalanceWhatsapp } from "@/server/evo.server";
import {
  accountFigures,
  type BalanceKind,
  type FundingSource,
  type MetaCreditView,
} from "@/lib/meta-credit";
import { listAdAccountEdge, readAdAccountNode, startSimpleFacebookLogin } from "@/server/meta.server";

type Role = "master" | "client_admin" | "client_user";

function fail(message: string): never {
  throw new Error(message);
}

async function actorOf(userId: string) {
  const [
    { data: profile, error: profileError },
    { data: roles, error: roleError },
    { data: perms, error: permError },
  ] = await Promise.all([
    supabaseAdmin
      .from("profiles")
      .select("id, organization_id, is_blocked")
      .eq("id", userId)
      .maybeSingle(),
    supabaseAdmin.from("user_roles").select("role").eq("user_id", userId),
    supabaseAdmin
      .from("user_permissions")
      .select("can_view_meta_balance, can_add_meta_credit")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);
  if (profileError || roleError || permError) fail("Não foi possível confirmar o acesso.");
  if (!profile) fail("Seu perfil ainda não está ligado a um acesso.");
  if (profile.is_blocked) fail("Este acesso está bloqueado.");
  const role: Role | null = (roles ?? []).some((item) => item.role === "master")
    ? "master"
    : (roles ?? []).some((item) => item.role === "client_admin")
      ? "client_admin"
      : (roles ?? []).some((item) => item.role === "client_user")
        ? "client_user"
        : null;
  if (!role) fail("Você não pode consultar os créditos Meta.");
  if (!profile.organization_id) fail("Sua conta ainda não está ligada a uma empresa.");
  const canView =
    role !== "client_user" ||
    perms?.can_view_meta_balance === true ||
    perms?.can_add_meta_credit === true;
  const canAdd = role !== "client_user" || perms?.can_add_meta_credit === true;
  if (!canView) fail("Você não tem permissão para ver os créditos Meta.");
  return { organizationId: profile.organization_id, canAdd };
}

async function selectedAccount(organizationId: string) {
  const columns =
    "id, external_account_id, name, currency, portfolio_id, balance_url, prepaid_ledger";
  const query = await supabaseAdmin
    .from("meta_accounts")
    .select(columns)
    .eq("organization_id", organizationId)
    .eq("selected", true)
    .limit(1);
  if (query.error && /prepaid_ledger/i.test(query.error.message)) {
    const plain = await supabaseAdmin
      .from("meta_accounts")
      .select("id, external_account_id, name, currency, portfolio_id, balance_url")
      .eq("organization_id", organizationId)
      .eq("selected", true)
      .limit(1);
    if (plain.error) fail("Não foi possível ler a conta de anúncio.");
    const row = plain.data?.[0];
    return row ? { ...row, prepaid_ledger: null } : null;
  }
  if (query.error) fail("Não foi possível ler a conta de anúncio.");
  return query.data?.[0] ?? null;
}

async function rememberBalance(accountRowId: string, cents: number | null, kind: BalanceKind) {
  if ((kind !== "available" && kind !== "prepaid") || cents == null) return;
  await supabaseAdmin
    .from("meta_accounts")
    .update({
      balance_cents: cents,
      last_synced_at: new Date().toISOString(),
      sync_status: "synced",
    })
    .eq("id", accountRowId);
}

const fundingFields =
  "funding_source_details{type,amount,currency,display_amount,display_string,coupons{amount}}";

async function readFields(organizationId: string, accountId: string, fields: string) {
  try {
    return (await readAdAccountNode(organizationId, accountId, fields)) as Record<string, unknown>;
  } catch (error) {
    console.error("meta_account_fields", error instanceof Error ? error.name : "error");
    return null;
  }
}

async function readChargeThreshold(organizationId: string, accountId: string) {
  try {
    const rows = await listAdAccountEdge(organizationId, accountId, "adspaymentcycle", {
      fields: "threshold_amount,requested_threshold_amount",
      limit: "5",
    });
    for (const row of rows) {
      if (row.threshold_amount != null) return row.threshold_amount;
    }
    for (const row of rows) {
      if (row.requested_threshold_amount != null) return row.requested_threshold_amount;
    }
  } catch (error) {
    console.error("meta_payment_cycle", error instanceof Error ? error.name : "error");
  }
  return null;
}

async function readBalance(organizationId: string, accountId: string, accountRowId: string) {
  const [account, totalPrepay, prepayAccount, unbilled, fundingExpanded, fundingPlain, threshold] =
    await Promise.all([
      readFields(organizationId, accountId, "name,account_id,currency,balance,is_prepay_account"),
      readFields(organizationId, accountId, "total_prepay_balance"),
      readFields(organizationId, accountId, "prepay_account_balance"),
      readFields(organizationId, accountId, "current_unbilled_spend"),
      readFields(organizationId, accountId, fundingFields),
      readFields(organizationId, accountId, "funding_source_details"),
      readChargeThreshold(organizationId, accountId),
    ]);
  if (!account && !totalPrepay && !prepayAccount && !unbilled) {
    throw new Error("A Meta não respondeu como esperado. Tente de novo.");
  }
  const funding = fundingExpanded?.funding_source_details ?? fundingPlain?.funding_source_details;
  const figures = accountFigures({
    totalPrepay: totalPrepay?.total_prepay_balance,
    prepayAccount: prepayAccount?.prepay_account_balance,
    ...(funding != null ? { funding: funding as FundingSource | FundingSource[] } : {}),
    unbilled: unbilled?.current_unbilled_spend,
    balance: account?.balance,
    threshold,
  });
  const kind: BalanceKind = figures.availableCents != null ? "available" : "unknown";
  await rememberBalance(accountRowId, figures.availableCents, kind);
  const prepayFlag = account?.is_prepay_account;
  const prepay = typeof prepayFlag === "boolean" ? prepayFlag : null;
  return { figures, prepay };
}

function emptyView(canAdd: boolean): MetaCreditView {
  return {
    accountName: null,
    accountId: null,
    currency: "BRL",
    balanceCents: null,
    balanceKind: "unknown",
    chargeCents: null,
    thresholdCents: null,
    canAdd,
    syncedAt: null,
    prepay: null,
    balanceUrl: null,
  };
}

export async function getMetaCredit(userId: string): Promise<MetaCreditView> {
  const actor = await actorOf(userId);
  const account = await selectedAccount(actor.organizationId);
  if (!account) return emptyView(actor.canAdd);
  const { figures, prepay } = await readBalance(
    actor.organizationId,
    account.external_account_id,
    account.id,
  );
  return {
    accountName: account.name,
    accountId: account.external_account_id,
    currency: account.currency || "BRL",
    balanceCents: figures.availableCents,
    balanceKind: figures.availableCents != null ? "available" : "unknown",
    chargeCents: figures.chargeCents,
    thresholdCents: figures.thresholdCents,
    canAdd: actor.canAdd,
    syncedAt: new Date().toISOString(),
    prepay,
    balanceUrl: normalizeBalanceLink(account.balance_url ?? ""),
  };
}

export async function getClientBalanceAlert(userId: string) {
  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("organization_id, is_blocked")
    .eq("id", userId)
    .maybeSingle();
  if (profileError || !profile?.organization_id || profile.is_blocked) {
    return { low: false, cents: null };
  }
  const { data: roles, error: roleError } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  const admin = (roles ?? []).some((row) => row.role === "client_admin" || row.role === "master");
  const attendant = (roles ?? []).some((row) => row.role === "client_user");
  if (roleError || (!admin && !attendant)) return { low: false, cents: null };
  if (!admin && attendant) {
    const { data: perms, error: permError } = await supabaseAdmin
      .from("user_permissions")
      .select("can_view_meta_balance, can_add_meta_credit")
      .eq("user_id", userId)
      .maybeSingle();
    if (permError || (perms?.can_view_meta_balance !== true && perms?.can_add_meta_credit !== true)) {
      return { low: false, cents: null };
    }
  }
  const { data: accounts, error: accountError } = await supabaseAdmin
    .from("meta_accounts")
    .select("external_account_id, balance_cents, last_synced_at")
    .eq("organization_id", profile.organization_id)
    .eq("selected", true)
    .limit(1);
  if (accountError) return { low: false, cents: null };
  const account = accounts?.[0];
  const stored = account?.last_synced_at ? Number(account.balance_cents) : null;
  const cents = stored != null && Number.isFinite(stored) ? stored : null;
  const signal = lowBalanceSignal(cents);
  if (signal !== "unknown") await syncLowBalanceWhatsapp(profile.organization_id, signal === "low");
  return { low: signal === "low", cents };
}

async function syncLowBalanceWhatsapp(organizationId: string, low: boolean) {
  const org = await supabaseAdmin
    .from("organizations")
    .select(
      "responsible_name, responsible_phone, finance_phone, legal_name, meta_low_balance_alerted_at",
    )
    .eq("id", organizationId)
    .maybeSingle();
  if (org.error) {
    if (!/meta_low_balance_alerted_at/i.test(org.error.message)) {
      console.error("meta_low_balance", org.error.code ?? "error");
    }
    return;
  }
  const alreadySent = lowBalanceAlreadyDelivered(org.data?.meta_low_balance_alerted_at);
  if (!low) {
    if (!org.data?.meta_low_balance_alerted_at) return;
    const cleared = await supabaseAdmin
      .from("organizations")
      .update({ meta_low_balance_alerted_at: null })
      .eq("id", organizationId);
    if (cleared.error) console.error("meta_low_balance", cleared.error.code ?? "error");
    return;
  }
  if (!shouldSendLowBalanceWhatsapp(true, alreadySent)) return;
  const claim = supabaseAdmin
    .from("organizations")
    .update({ meta_low_balance_alerted_at: lowBalanceAlertStamp() })
    .eq("id", organizationId)
    .select("id");
  const claimed = org.data?.meta_low_balance_alerted_at
    ? await claim.eq("meta_low_balance_alerted_at", org.data.meta_low_balance_alerted_at)
    : await claim.is("meta_low_balance_alerted_at", null);
  if (claimed.error || !claimed.data?.length) {
    if (claimed.error) console.error("meta_low_balance", claimed.error.code ?? "error");
    return;
  }
  const phone = await alertPhone(
    organizationId,
    org.data?.responsible_phone,
    org.data?.finance_phone,
  );
  const sent = await sendLowBalanceWhatsapp(
    phone,
    org.data?.responsible_name?.trim() || org.data?.legal_name || "",
  );
  if (sent) return;
  const released = await supabaseAdmin
    .from("organizations")
    .update({ meta_low_balance_alerted_at: null })
    .eq("id", organizationId);
  if (released.error) console.error("meta_low_balance", released.error.code ?? "error");
}

async function alertPhone(
  organizationId: string,
  responsible: string | null | undefined,
  finance: string | null | undefined,
) {
  const direct = [responsible, finance].find((phone) => phone && whatsappNumber(phone));
  if (direct) return direct;
  const people = await supabaseAdmin
    .from("profiles")
    .select("whatsapp")
    .eq("organization_id", organizationId);
  if (people.error) return "";
  return (
    (people.data ?? []).find((row) => row.whatsapp && whatsappNumber(row.whatsapp))?.whatsapp ?? ""
  );
}

export async function startFacebookLogin(userId: string) {
  const actor = await actorOf(userId);
  if (!actor.canAdd) fail("Você não tem permissão para adicionar saldo.");
  return startSimpleFacebookLogin(userId, actor.organizationId);
}
