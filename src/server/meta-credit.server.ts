import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Json } from "@/integrations/supabase/types";
import { normalizeBalanceLink } from "@/lib/balance-link";
import { lowBalanceTestCents } from "@/lib/low-balance-test";
import {
  lowBalanceAlertStamp,
  lowBalanceAlreadyDelivered,
  lowBalanceSignal,
  shouldSendLowBalanceWhatsapp,
  whatsappNumber,
} from "@/lib/low-balance";
import { sendLowBalanceWhatsapp } from "@/server/evo.server";
import {
  classifyGraphPayment,
  hasCreditCard,
  mergeLedger,
  prepaidBalanceCents,
  readLedger,
  shouldUsePrepaidLedger,
  type LedgerEntry,
} from "@/lib/meta-balance-ledger";
import {
  availableBalanceCents,
  balanceFromAccount,
  type BalanceKind,
  type FundingSource,
  type MetaCreditView,
} from "@/lib/meta-credit";
import {
  listAdAccountEdge,
  readAdAccountNode,
  startSimpleFacebookLogin,
} from "@/server/meta.server";

type Role = "master" | "client_admin" | "client_user";

type AccountNode = {
  name?: string;
  account_id?: string;
  currency?: string;
  balance?: string | number | null;
  is_prepay_account?: boolean;
  funding_source_details?: FundingSource | FundingSource[] | null;
};

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

async function readNode(organizationId: string, accountId: string) {
  const attempts = [
    "name,account_id,currency,balance,is_prepay_account,funding_source_details",
    "name,account_id,currency,balance,is_prepay_account",
    "name,account_id,currency,balance",
  ];
  let last: unknown;
  for (const fields of attempts) {
    try {
      return (await readAdAccountNode(organizationId, accountId, fields)) as AccountNode;
    } catch (error) {
      last = error;
    }
  }
  throw last instanceof Error
    ? last
    : new Error("A Meta não respondeu como esperado. Tente de novo.");
}

const transactionFields =
  "id,time,status,payment_option,charge_type,is_funding_event,billing_reason,app_amount,provider_amount,tracking_id";
const activityFields = "event_type,event_time,extra_data,object_id,translated_event_type";

async function paymentRows(accountId: string, organizationId: string, businessId: string | null) {
  const transactions = await transactionRows(accountId, organizationId);
  if (transactions.some((item) => classifyGraphPayment(item)?.direction === "credit")) {
    return transactions;
  }
  return activityRows(accountId, organizationId, businessId);
}

async function transactionRows(accountId: string, organizationId: string) {
  const attempts = [{ limit: "100", fields: transactionFields }, { limit: "100" }];
  for (const params of attempts) {
    try {
      return await listAdAccountEdge(organizationId, accountId, "transactions", params);
    } catch (error) {
      console.error("meta_transactions", error instanceof Error ? error.name : "error");
    }
  }
  return [];
}

async function activityRows(accountId: string, organizationId: string, businessId: string | null) {
  const merged: Record<string, unknown>[] = [];
  const recent = { fields: activityFields, limit: "100" };
  const history = { fields: activityFields, limit: "100", since: "1514764800" };
  for (const params of [recent, history]) {
    try {
      merged.push(...(await listAdAccountEdge(organizationId, accountId, "activities", params)));
    } catch (error) {
      console.error("meta_activities", error instanceof Error ? error.name : "error");
    }
  }
  if (businessId && /^\d+$/.test(businessId) && !merged.some(hasCredit)) {
    try {
      merged.push(
        ...(await listAdAccountEdge(organizationId, accountId, "activities", {
          ...recent,
          business_id: businessId,
        })),
      );
    } catch (error) {
      console.error("meta_activities", error instanceof Error ? error.name : "error");
    }
  }
  return merged;
}

function hasCredit(item: Record<string, unknown>) {
  return classifyGraphPayment(item)?.direction === "credit";
}

async function prepaidLedger(
  organizationId: string,
  accountId: string,
  accountRowId: string,
  businessId: string | null,
  stored: Json | null,
) {
  let rows: Record<string, unknown>[];
  try {
    rows = await paymentRows(accountId, organizationId, businessId);
  } catch (error) {
    console.error("meta_activities", error instanceof Error ? error.name : "error");
    return null;
  }
  const incoming = rows.flatMap((item) => {
    const entry = classifyGraphPayment(item);
    return entry ? [entry] : [];
  });
  if (!incoming.some((entry) => entry.direction === "credit")) return null;
  const entries = mergeLedger(readLedger(stored), incoming);
  const { error } = await supabaseAdmin
    .from("meta_accounts")
    .update({ prepaid_ledger: { entries } })
    .eq("id", accountRowId)
    .eq("organization_id", organizationId);
  if (error) console.error("meta_prepaid_ledger", error.code ?? "error");
  return { cents: prepaidBalanceCents(entries), credits: creditCount(entries) };
}

function creditCount(entries: LedgerEntry[]) {
  return entries.filter((entry) => entry.direction === "credit").length;
}

async function readBalance(
  organizationId: string,
  accountId: string,
  accountRowId: string,
  businessId: string | null,
  storedLedger: Json | null,
) {
  const node = await readNode(organizationId, accountId);
  const funding = node.funding_source_details;
  const reading = balanceFromAccount({
    ...(node.balance !== undefined ? { balance: node.balance } : {}),
    ...(funding !== undefined ? { funding } : {}),
  });
  const storedCents = funding === undefined ? null : availableBalanceCents(funding);
  const hasCard = hasCreditCard(funding);
  let result = reading;
  if (
    shouldUsePrepaidLedger({
      hasCard,
      displayedCents: reading.cents,
      storedCents,
      creditCount: 1,
    })
  ) {
    const ledger = await prepaidLedger(
      organizationId,
      accountId,
      accountRowId,
      businessId,
      storedLedger,
    );
    if (
      ledger &&
      shouldUsePrepaidLedger({
        hasCard,
        displayedCents: reading.cents,
        storedCents,
        creditCount: ledger.credits,
      })
    ) {
      result = { cents: ledger.cents, kind: "prepaid" };
    }
  }
  await rememberBalance(accountRowId, result.cents, result.kind);
  const prepay = typeof node.is_prepay_account === "boolean" ? node.is_prepay_account : null;
  return { reading: result, prepay };
}

function emptyView(canAdd: boolean): MetaCreditView {
  return {
    accountName: null,
    accountId: null,
    currency: "BRL",
    balanceCents: null,
    balanceKind: "unknown",
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
  const { reading, prepay } = await readBalance(
    actor.organizationId,
    account.external_account_id,
    account.id,
    account.portfolio_id,
    account.prepaid_ledger,
  );
  const testCents = lowBalanceTestCents(account.external_account_id);
  return {
    accountName: account.name,
    accountId: account.external_account_id,
    currency: account.currency || "BRL",
    balanceCents: testCents ?? reading.cents,
    balanceKind: testCents == null ? reading.kind : "available",
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
  const client = (roles ?? []).some(
    (row) => row.role === "client_admin" || row.role === "client_user",
  );
  if (roleError || !client) return { low: false, cents: null };
  const { data: accounts, error: accountError } = await supabaseAdmin
    .from("meta_accounts")
    .select("external_account_id, balance_cents, last_synced_at")
    .eq("organization_id", profile.organization_id)
    .eq("selected", true)
    .limit(1);
  if (accountError) return { low: false, cents: null };
  const account = accounts?.[0];
  const forced = lowBalanceTestCents(account?.external_account_id);
  const stored = account?.last_synced_at ? Number(account.balance_cents) : null;
  const cents = forced ?? (stored != null && Number.isFinite(stored) ? stored : null);
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
