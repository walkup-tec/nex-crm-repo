import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { normalizeBalanceLink } from "@/lib/balance-link";
import {
  centsFromMetaAmount,
  classifyPrepaidRow,
  hasManualTopUp,
  prepaidAvailableCents,
  type LedgerEntry,
} from "@/lib/meta-balance-ledger";
import {
  isLowMetaBalance,
  lowBalanceAlertStamp,
  lowBalanceAlreadyDelivered,
  lowBalanceSignal,
  shouldSendLowBalanceWhatsapp,
  whatsappNumber,
} from "@/lib/low-balance";
import { sendLowBalanceWhatsapp } from "@/server/evo.server";
import { agendaMenuForMmsMaster } from "@/lib/google-calendar";
import { formatMetaFieldRead, type MetaFieldReport } from "@/lib/meta-balance-debug";
import { moneyCents, type MetaCreditView } from "@/lib/meta-credit";
import {
  debugMetaRead,
  listAdAccountEdge,
  readAdAccountNode,
  startSimpleFacebookLogin,
} from "@/server/meta.server";

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
  return { organizationId: profile.organization_id, canAdd, role };
}

async function mmsMaster(organizationId: string, role: Role) {
  const { data, error } = await supabaseAdmin
    .from("organizations")
    .select("legal_name")
    .eq("id", organizationId)
    .maybeSingle();
  if (error || !data) return false;
  return agendaMenuForMmsMaster(data.legal_name ?? "", role);
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

async function rememberBalance(
  accountRowId: string,
  cents: number | null,
  entries: LedgerEntry[],
  manualCredit: boolean,
) {
  const update: { prepaid_ledger: { entries: LedgerEntry[]; manualCredit: boolean }; last_synced_at: string; sync_status: string; balance_cents?: number } = {
    prepaid_ledger: { entries, manualCredit },
    last_synced_at: new Date().toISOString(),
    sync_status: "synced",
  };
  if (cents != null) update.balance_cents = cents;
  const { error } = await supabaseAdmin.from("meta_accounts").update(update).eq("id", accountRowId);
  if (error && /prepaid_ledger/i.test(error.message) && cents != null) {
    await supabaseAdmin
      .from("meta_accounts")
      .update({
        balance_cents: cents,
        last_synced_at: update.last_synced_at,
        sync_status: "synced",
      })
      .eq("id", accountRowId);
  }
}

const transactionFields =
  "id,time,status,payment_option,charge_type,is_funding_event,billing_reason,app_amount,provider_amount,tracking_id";
const datedTransactionFields = `${transactionFields},billing_end_time,billing_start_time`;

function rowHasAmount(item: unknown) {
  if (!item || typeof item !== "object" || Array.isArray(item)) return false;
  const record = item as { app_amount?: unknown; provider_amount?: unknown; amount?: unknown };
  return (
    centsFromMetaAmount(record.app_amount) != null ||
    centsFromMetaAmount(record.provider_amount) != null ||
    centsFromMetaAmount(record.amount) != null
  );
}

async function transactionRows(organizationId: string, accountId: string) {
  const attempts = [
    { limit: "100", fields: datedTransactionFields },
    { limit: "100", fields: transactionFields },
    { limit: "100" },
  ];
  // Keep the first page whose rows carry a parseable amount. Classification
  // decides later which rows are prepaid credits/debits, so gating only on a
  // full classify would throw away a valid payload whenever the manual top-up
  // or a prepaid charge used an enum value we do not yet recognize.
  for (const params of attempts) {
    try {
      const rows = await listAdAccountEdge(organizationId, accountId, "transactions", params);
      if (rows.some((item) => classifyPrepaidRow(item) || rowHasAmount(item))) return rows;
    } catch (error) {
      console.error("meta_transactions", error instanceof Error ? error.name : "error");
    }
  }
  return [];
}

async function paymentRows(organizationId: string, accountId: string) {
  return transactionRows(organizationId, accountId);
}

async function readFields(organizationId: string, accountId: string, fields: string) {
  try {
    return (await readAdAccountNode(organizationId, accountId, fields)) as Record<string, unknown>;
  } catch (error) {
    console.error("meta_account_fields", error instanceof Error ? error.name : "error");
    return null;
  }
}

async function readBalance(organizationId: string, accountId: string, accountRowId: string) {
  const [account, rows] = await Promise.all([
    readFields(organizationId, accountId, "name,account_id,currency,balance,is_prepay_account"),
    paymentRows(organizationId, accountId),
  ]);
  if (!account && rows.length === 0) {
    throw new Error("A Meta não respondeu como esperado. Tente de novo.");
  }
  const entries = rows.flatMap((item) => {
    const entry = classifyPrepaidRow(item);
    return entry ? [entry] : [];
  });
  const availableCents = prepaidAvailableCents(entries);
  const chargeCents = moneyCents(account?.balance);
  await rememberBalance(accountRowId, availableCents, entries, hasManualTopUp(entries));
  const prepayFlag = account?.is_prepay_account;
  const prepay = typeof prepayFlag === "boolean" ? prepayFlag : null;
  return { availableCents, chargeCents, prepay };
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
    canDebug: false,
    fieldReads: null,
    syncedAt: null,
    prepay: null,
    balanceUrl: null,
  };
}

export async function getMetaCredit(userId: string): Promise<MetaCreditView> {
  const actor = await actorOf(userId);
  const canDebug = await mmsMaster(actor.organizationId, actor.role);
  const account = await selectedAccount(actor.organizationId);
  if (!account) return { ...emptyView(actor.canAdd), canDebug };
  const { availableCents, chargeCents, prepay } = await readBalance(
    actor.organizationId,
    account.external_account_id,
    account.id,
  );
  return {
    accountName: account.name,
    accountId: account.external_account_id,
    currency: account.currency || "BRL",
    balanceCents: availableCents,
    balanceKind: availableCents != null ? "prepaid" : "unknown",
    chargeCents,
    thresholdCents: null,
    canAdd: actor.canAdd,
    canDebug,
    fieldReads: canDebug
      ? await readMetaFields(actor.organizationId, account.external_account_id)
      : null,
    syncedAt: new Date().toISOString(),
    prepay,
    balanceUrl: normalizeBalanceLink(account.balance_url ?? ""),
  };
}

const metaReads = [
  ["Saldo disponível · total_prepay_balance", "total_prepay_balance", ""],
  ["Saldo disponível · prepay_account_balance", "prepay_account_balance", ""],
  [
    "Saldo disponível · funding_source_details",
    "funding_source_details{type,amount,currency,display_amount,display_string,coupons{amount}}",
    "",
  ],
  ["Será cobrado · current_unbilled_spend", "current_unbilled_spend", ""],
  ["Será cobrado · balance", "balance", ""],
  [
    "A Meta cobra ao chegar a · adspaymentcycle",
    "threshold_amount,requested_threshold_amount",
    "adspaymentcycle",
  ],
] as const;

async function readMetaFields(organizationId: string, accountId: string): Promise<MetaFieldReport[]> {
  return Promise.all(
    metaReads.map(async ([name, field, edge]) => {
      try {
        const read = await debugMetaRead(organizationId, accountId, field, edge);
        return formatMetaFieldRead({
          name,
          field,
          ok: read.ok,
          status: read.status,
          code: read.code,
          body: read.body,
        });
      } catch {
        return { name, text: "Meta recusou\nA leitura deste campo não voltou." };
      }
    }),
  );
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
    .select("external_account_id, balance_cents, last_synced_at, prepaid_ledger")
    .eq("organization_id", profile.organization_id)
    .eq("selected", true)
    .limit(1);
  if (accountError) {
    if (/prepaid_ledger/i.test(accountError.message)) return { low: false, cents: null };
    return { low: false, cents: null };
  }
  const account = accounts?.[0];
  const stored = account?.last_synced_at ? Number(account.balance_cents) : null;
  const cents = stored != null && Number.isFinite(stored) ? stored : null;
  const ledger = account?.prepaid_ledger;
  const manualCredit =
    !!ledger &&
    typeof ledger === "object" &&
    !Array.isArray(ledger) &&
    (ledger as { manualCredit?: unknown }).manualCredit === true;
  if (!manualCredit) return { low: false, cents };
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
