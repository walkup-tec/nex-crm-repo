import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  accountDailyQuery,
  fillAccountDays,
  parseAccountDays,
  saoPauloDate,
  cleanCustomerId,
  customerClientQuery,
  googleAdsApiVersion,
  googleAdsFailure,
  missingGoogleAdsEnv,
  parseAccessibleCustomers,
  parseCustomerClients,
  refreshTokenBody,
  refreshTokenUsable,
  type GoogleAdsAccount,
  type GoogleAdsCampaign,
} from "@/lib/google-ads";

type Gate = { organizationId: string | null; master: boolean };

let cachedToken: { value: string; expiresAt: number } | null = null;

function fail(message: string): never {
  throw new Error(message);
}

function adsConfig() {
  const env = process.env;
  const missing = missingGoogleAdsEnv(env);
  if (missing.length) fail(`Faltam as variáveis ${missing.join(", ")}.`);
  const loginCustomerId = cleanCustomerId(env.GOOGLE_ADS_LOGIN_CUSTOMER_ID ?? "");
  if (!loginCustomerId) fail("GOOGLE_ADS_LOGIN_CUSTOMER_ID não é um identificador de conta válido.");
  const redirectUri = env.GOOGLE_ADS_REDIRECT_URI!.trim();
  if (!redirectUri.startsWith("https://")) fail("GOOGLE_ADS_REDIRECT_URI precisa ser um endereço https.");
  return {
    clientId: env.GOOGLE_ADS_CLIENT_ID!.trim(),
    clientSecret: env.GOOGLE_ADS_CLIENT_SECRET!.trim(),
    redirectUri,
    refreshToken: env.GOOGLE_ADS_REFRESH_TOKEN!.trim(),
    loginCustomerId,
    version: googleAdsApiVersion(env),
  };
}

function schemaFail(message: string): never {
  if (/google_ads_accounts/i.test(message)) fail("Falta aplicar a migração do Google Ads no Supabase.");
  fail("Não foi possível gravar a conta de anúncios do Google Ads.");
}

async function assertReader(userId: string, organizationId = ""): Promise<Gate> {
  const [{ data: profile, error: profileError }, { data: roles, error: roleError }] = await Promise.all([
    supabaseAdmin.from("profiles").select("organization_id, is_blocked").eq("id", userId).maybeSingle(),
    supabaseAdmin.from("user_roles").select("role").eq("user_id", userId),
  ]);
  if (profileError || roleError) fail("Não foi possível confirmar o acesso.");
  if (!profile || profile.is_blocked) fail("Este acesso está bloqueado.");
  const master = (roles ?? []).some((role) => role.role === "master");
  const ownOrganization = profile.organization_id ?? null;
  if (master) return { organizationId: organizationId || ownOrganization, master: true };
  if (!ownOrganization || (organizationId && organizationId !== ownOrganization)) fail("Você não pode consultar esta conta de anúncios.");
  return { organizationId: ownOrganization, master: false };
}

function callBudget() {
  return AbortSignal.timeout(20000);
}

async function googleFetch(url: string, init: RequestInit, signal: AbortSignal) {
  try {
    const response = await fetch(url, { ...init, signal });
    const body = await response.json().catch(() => ({}));
    return { ok: response.ok, status: response.status, body };
  } catch (error) {
    const name = error instanceof Error ? error.name : "error";
    console.error("google_ads_network", name);
    if (name === "TimeoutError" || name === "AbortError") fail("O Google Ads não respondeu. Tente de novo.");
    fail("Não foi possível consultar o Google Ads.");
  }
}

async function renewAccessToken(signal: AbortSignal) {
  const config = adsConfig();
  const result = await googleFetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: refreshTokenBody(config),
  }, signal);
  const body = result.body as { access_token?: string; expires_in?: number; scope?: string };
  if (!result.ok || !body.access_token) fail(googleAdsFailure(result.status, result.body));
  if (!refreshTokenUsable(body.scope)) fail("O refresh token configurado não tem o escopo do Google Ads.");
  cachedToken = {
    value: body.access_token,
    expiresAt: Date.now() + Math.max(60, body.expires_in || 3600) * 1000,
  };
  return cachedToken.value;
}

async function accessToken(signal: AbortSignal) {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;
  return renewAccessToken(signal);
}

async function adsFetch(path: string, init: { method: "GET" | "POST"; body?: unknown; loginCustomerId?: string }, signal: AbortSignal) {
  const config = adsConfig();
  const token = await accessToken(signal);
  const headers = new Headers({
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
  });
  if (init.loginCustomerId) headers.set("login-customer-id", init.loginCustomerId);
  if (init.body) headers.set("Content-Type", "application/json");
  const result = await googleFetch(`https://googleads.googleapis.com/${config.version}${path}`, {
    method: init.method,
    headers,
    body: init.body ? JSON.stringify(init.body) : undefined,
  }, signal);
  if (!result.ok) {
    console.error("google_ads", result.status);
    fail(googleAdsFailure(result.status, result.body));
  }
  return result.body;
}

async function search(customerId: string, loginCustomerId: string, query: string, signal: AbortSignal) {
  const pages: unknown[] = [];
  let pageToken = "";
  for (let page = 0; page < 4; page += 1) {
    const body = await adsFetch(`/customers/${customerId}/googleAds:search`, {
      method: "POST",
      loginCustomerId,
      body: { query, pageToken: pageToken || undefined },
    }, signal);
    pages.push(body);
    const next = body && typeof body === "object" ? (body as { nextPageToken?: string }).nextPageToken : "";
    if (!next) break;
    pageToken = next;
  }
  return pages;
}

export async function listGoogleAdsAccounts(userId: string) {
  const gate = await assertReader(userId);
  if (!gate.master) fail("Somente o Master escolhe a conta de anúncios do Google Ads.");
  const config = adsConfig();
  const signal = callBudget();
  const accessible = parseAccessibleCustomers(await adsFetch("/customers:listAccessibleCustomers", { method: "GET" }, signal));
  if (!accessible.includes(config.loginCustomerId)) fail("A conta administradora não está entre as contas autorizadas neste projeto.");
  const pages = await search(config.loginCustomerId, config.loginCustomerId, customerClientQuery(), signal);
  return pages.flatMap((page) => parseCustomerClients(page));
}

export async function selectGoogleAdsAccount(userId: string, organizationId: string, customerId: string) {
  const gate = await assertReader(userId, organizationId);
  if (!gate.master || !gate.organizationId) fail("Somente o Master escolhe a conta de anúncios do Google Ads.");
  const accounts = await listGoogleAdsAccounts(userId);
  const match = accounts.find((account) => account.customerId === cleanCustomerId(customerId));
  if (!match) fail("Essa conta de anúncios não está vinculada à conta administradora.");
  const config = adsConfig();
  const now = new Date().toISOString();
  const cleared = await supabaseAdmin.from("google_ads_accounts").update({ selected: false, updated_at: now }).eq("organization_id", gate.organizationId);
  if (cleared.error) schemaFail(cleared.error.message);
  const saved = await supabaseAdmin.from("google_ads_accounts").upsert(
    {
      organization_id: gate.organizationId,
      customer_id: match.customerId,
      login_customer_id: config.loginCustomerId,
      name: match.name,
      currency: match.currency,
      account_status: match.status,
      selected: true,
      updated_at: now,
    },
    { onConflict: "organization_id,customer_id" },
  );
  if (saved.error) schemaFail(saved.error.message);
  const flagged = await supabaseAdmin.from("organizations").update({ ads_google: true }).eq("id", gate.organizationId);
  if (flagged.error) console.error("google_ads_flag");
  return selectedAccount(gate.organizationId);
}

async function selectedAccount(organizationId: string) {
  const { data, error } = await supabaseAdmin
    .from("google_ads_accounts")
    .select("customer_id, login_customer_id, name, currency, account_status")
    .eq("organization_id", organizationId)
    .eq("selected", true)
    .maybeSingle();
  if (error) schemaFail(error.message);
  if (!data?.customer_id) return null;
  return {
    customerId: data.customer_id,
    loginCustomerId: data.login_customer_id,
    name: data.name || `Conta ${data.customer_id}`,
    currency: data.currency || "BRL",
    status: data.account_status || "",
  };
}

export async function googleAdsSelection(userId: string, organizationId = "") {
  const gate = await assertReader(userId, organizationId);
  if (!gate.organizationId) return { linked: false as const, account: null, campaigns: [] as GoogleAdsCampaign[] };
  const account = await selectedAccount(gate.organizationId);
  return { linked: Boolean(account), account, campaigns: [] as GoogleAdsCampaign[] };
}

export async function readGoogleAdsCampaigns(userId: string, organizationId = "") {
  const gate = await assertReader(userId, organizationId);
  if (!gate.organizationId) return { linked: false as const, account: null, campaigns: [] as GoogleAdsCampaign[], period: "Últimos 30 dias" };
  const account = await selectedAccount(gate.organizationId);
  if (!account) return { linked: false as const, account: null, campaigns: [] as GoogleAdsCampaign[], days: [] as ReturnType<typeof parseAccountDays>, period: "Este mês" };
  const pages = await search(account.customerId, account.loginCustomerId, accountDailyQuery(), callBudget());
  const days = fillAccountDays(pages.flatMap((page) => parseAccountDays(page)), saoPauloDate());
  return { linked: true as const, account, campaigns: [] as GoogleAdsCampaign[], days, period: "Este mês" };
}

export type { GoogleAdsAccount };
