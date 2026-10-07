import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { normalizeBalanceLink } from "@/lib/balance-link";
import {
  balanceFromAccount,
  type BalanceKind,
  type FundingSource,
  type MetaCreditView,
} from "@/lib/meta-credit";
import { readAdAccountNode } from "@/server/meta.server";

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
  const { data, error } = await supabaseAdmin
    .from("meta_accounts")
    .select("id, external_account_id, name, currency, portfolio_id, balance_url")
    .eq("organization_id", organizationId)
    .eq("selected", true)
    .limit(1);
  if (error) fail("Não foi possível ler a conta de anúncio.");
  return data?.[0] ?? null;
}

async function rememberBalance(accountRowId: string, cents: number | null, kind: BalanceKind) {
  if (kind !== "available" || cents == null) return;
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

async function readBalance(organizationId: string, accountId: string, accountRowId: string) {
  const node = await readNode(organizationId, accountId);
  const reading = balanceFromAccount({
    ...(node.balance !== undefined ? { balance: node.balance } : {}),
    ...(node.funding_source_details !== undefined ? { funding: node.funding_source_details } : {}),
  });
  await rememberBalance(accountRowId, reading.cents, reading.kind);
  const prepay = typeof node.is_prepay_account === "boolean" ? node.is_prepay_account : null;
  return { reading, prepay };
}

function facebookLoginConfig() {
  const raw = process.env["META_APP_ID"]?.trim() ?? "";
  const facebookAppId = /^\d{5,32}$/.test(raw) ? raw : null;
  const versionRaw = (process.env["META_GRAPH_VERSION"] || "v23.0").trim();
  const version = versionRaw.startsWith("v") ? versionRaw : `v${versionRaw}`;
  const facebookSdkVersion = /^v\d+\.\d+$/.test(version) ? version : "v23.0";
  return { facebookAppId, facebookSdkVersion };
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
    ...facebookLoginConfig(),
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
  );
  return {
    accountName: account.name,
    accountId: account.external_account_id,
    currency: account.currency || "BRL",
    balanceCents: reading.cents,
    balanceKind: reading.kind,
    canAdd: actor.canAdd,
    syncedAt: new Date().toISOString(),
    prepay,
    balanceUrl: normalizeBalanceLink(account.balance_url ?? ""),
    ...facebookLoginConfig(),
  };
}
