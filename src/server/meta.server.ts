import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { normalizeBalanceLink } from "@/lib/balance-link";
import type {
  MetaAccountView,
  MetaBusinessView,
  MetaCampaignRow,
  MetaConnectionView,
  MetaCampaignSnapshot,
  MetaDayPoint,
  MetaKpis,
  MetaPeriod,
  MetaResultSeries,
  MasterCampaignsView,
  MetaPerformanceView,
} from "@/lib/meta-access";

export type { MetaAccountView, MetaConnectionView };

const SCOPES = ["ads_read", "business_management"];

type GraphError = { code?: number; error_subcode?: number; type?: string; message?: string };
type GraphAccount = {
  id?: string;
  name?: string;
  account_id?: string;
  account_status?: number;
  currency?: string;
};

function fail(message: string): never {
  throw new Error(message);
}

function graphVersion() {
  const version = process.env["META_GRAPH_VERSION"] || "v23.0";
  return version.startsWith("v") ? version : `v${version}`;
}

function metaConfig() {
  const appId = process.env["META_APP_ID"];
  const appSecret = process.env["META_APP_SECRET"];
  const redirectUri =
    process.env["META_REDIRECT_URI"] || "https://app.nexmeta.com.br/auth/meta/callback";
  if (!appId || !appSecret) fail("A conexão com a Meta não está configurada no servidor.");
  return { appId, appSecret, redirectUri, version: graphVersion() };
}

function tokenKey() {
  const raw = process.env["META_TOKEN_KEY"];
  if (!raw) fail("A criptografia da conexão Meta não está configurada no servidor.");
  const decoded = Buffer.from(raw, "base64");
  if (decoded.length === 32) return decoded;
  return createHash("sha256").update(raw).digest();
}

function encryptToken(token: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", tokenKey(), iv);
  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

function decryptToken(payload: string) {
  const [iv, tag, data] = payload.split(".");
  if (!iv || !tag || !data) fail("A conexão Meta precisa ser refeita.");
  try {
    const decipher = createDecipheriv("aes-256-gcm", tokenKey(), Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(data, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch (error) {
    if (error instanceof Error && error.message.includes("configurada")) throw error;
    fail("A conexão Meta precisa ser refeita.");
  }
}

function missingSchema(message: string) {
  const text = message.toLowerCase();
  return (
    text.includes("meta_oauth_states") ||
    text.includes("meta_connections") ||
    text.includes("account_status") ||
    text.includes("selected") ||
    text.includes("connection_id") ||
    text.includes("balance_url")
  );
}

function schemaFail(message: string): never {
  if (missingSchema(message)) fail("Falta aplicar a migração da conexão Meta no Supabase.");
  fail("Não foi possível concluir a conexão com a Meta.");
}

function publicMetaError(error: GraphError | undefined, status: number) {
  const code = error?.code;
  console.error("meta_graph", { status, code, type: error?.type ?? null });
  if (status === 429 || code === 4 || code === 17 || code === 32 || code === 613) {
    return "A Meta limitou as consultas. Tente de novo em alguns minutos.";
  }
  if (code === 190) return "A conexão com a Meta expirou. Conecte novamente.";
  if (code === 10 || code === 200 || code === 294)
    return "A autorização não inclui a permissão para ler as contas de anúncio.";
  return "A Meta não respondeu como esperado. Tente de novo.";
}

type InsightAction = { action_type?: string; value?: string };
type GraphInsight = {
  spend?: string;
  impressions?: string;
  reach?: string;
  clicks?: string;
  ctr?: string;
  cpc?: string;
  cpm?: string;
  frequency?: string;
  actions?: InsightAction[];
  campaign_id?: string;
  date_start?: string;
};
type GraphCampaign = {
  id?: string;
  name?: string;
  effective_status?: string;
  insights?: { data?: GraphInsight[] };
};
type GraphBody = {
  error?: GraphError;
  access_token?: string;
  expires_in?: number;
  id?: string;
  data?: Array<GraphAccount & GraphCampaign & GraphInsight>;
  paging?: { next?: string };
};

async function graphFetch(url: URL): Promise<GraphBody> {
  let response: Response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(20000) });
  } catch (error) {
    console.error("meta_network", error instanceof Error ? error.name : "error");
    fail("Não foi possível falar com a Meta. Tente de novo.");
  }
  const body = (await response.json().catch(() => ({}))) as GraphBody;
  if (!response.ok || body.error) fail(publicMetaError(body.error, response.status));
  return body;
}

async function graphGet(
  version: string,
  path: string,
  token: string,
  params: Record<string, string>,
): Promise<GraphBody> {
  const url = new URL(`https://graph.facebook.com/${version}${path}`);
  url.searchParams.set("access_token", token);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return graphFetch(url);
}

async function assertOrgAccess(userId: string, organizationId: string) {
  const [{ data: profile, error: profileError }, { data: roles, error: roleError }] =
    await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("id, organization_id, is_blocked")
        .eq("id", userId)
        .maybeSingle(),
      supabaseAdmin.from("user_roles").select("role").eq("user_id", userId),
    ]);
  if (profileError) schemaFail(profileError.message);
  if (roleError) fail("Não foi possível confirmar o acesso.");
  if (!profile) fail("Seu perfil ainda não está ligado a um acesso.");
  if (profile.is_blocked) fail("Este acesso está bloqueado.");
  const isMaster = (roles ?? []).some((item) => item.role === "master");
  if (isMaster) return;
  const isClient = (roles ?? []).some((item) => item.role === "client_admin");
  if (isClient && profile.organization_id === organizationId) return;
  fail("Você não pode conectar a Meta desta conta.");
}

function accountDigits(value: string) {
  const digits = value.trim().replace(/^act_/i, "");
  if (!/^\d+$/.test(digits)) fail("Escolha uma conta de anúncio válida.");
  return digits;
}

function statusLabel(status: number | undefined) {
  if (status === 1) return "Ativa";
  if (status === 2) return "Desativada";
  if (status === 3) return "Pagamento pendente";
  if (status === 7 || status === 8 || status === 9) return "Em análise";
  if (status === 100 || status === 101 || status === 202) return "Encerrada";
  return "Indisponível";
}

function toView(account: GraphAccount): MetaAccountView | null {
  const accountId = account.account_id || account.id?.replace(/^act_/i, "");
  if (!accountId || !/^\d+$/.test(accountId)) return null;
  return {
    id: account.id || `act_${accountId}`,
    accountId,
    name: account.name?.trim() || `Conta ${accountId}`,
    currency: account.currency ?? null,
    statusLabel: statusLabel(account.account_status),
  };
}

async function collectAdAccounts(version: string, token: string) {
  const found: MetaAccountView[] = [];
  let next: string | null = null;
  for (let page = 0; page < 5; page += 1) {
    const body: GraphBody = next
      ? await graphFetch(new URL(next))
      : await graphGet(version, "/me/adaccounts", token, {
          fields: "id,name,account_id,account_status,currency",
          limit: "50",
        });
    for (const item of body.data ?? []) {
      const view = toView(item);
      if (view && !found.some((account) => account.accountId === view.accountId)) found.push(view);
    }
    next = typeof body.paging?.next === "string" ? body.paging.next : null;
    if (!next) break;
  }
  return found;
}

async function connectionOf(organizationId: string) {
  const { data, error } = await supabaseAdmin
    .from("meta_connections")
    .select(
      "id, organization_id, status, connected_at, last_sync_at, last_error, access_token_encrypted, token_expires_at",
    )
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error) schemaFail(error.message);
  return data;
}

async function selectedAccount(organizationId: string) {
  const { data, error } = await supabaseAdmin
    .from("meta_accounts")
    .select("external_account_id, name, currency, portfolio_id, balance_url")
    .eq("organization_id", organizationId)
    .eq("selected", true)
    .limit(1);
  if (error) schemaFail(error.message);
  return data?.[0] ?? null;
}

export async function readAdAccountNode(organizationId: string, accountId: string, fields: string) {
  const digits = accountId.trim().replace(/^act_/i, "");
  if (!/^\d+$/.test(digits)) fail("Escolha uma conta de anúncio válida.");
  const { token } = await loadToken(organizationId);
  return graphGet(graphVersion(), `/act_${digits}`, token, { fields });
}

async function loadToken(organizationId: string) {
  const connection = await connectionOf(organizationId);
  if (!connection || connection.status === "disconnected" || !connection.access_token_encrypted) {
    fail("Conecte a Meta antes de consultar as contas de anúncio.");
  }
  if (connection.token_expires_at && new Date(connection.token_expires_at).getTime() < Date.now()) {
    await supabaseAdmin
      .from("meta_connections")
      .update({
        status: "error",
        last_error: "A conexão com a Meta expirou.",
        updated_at: new Date().toISOString(),
      })
      .eq("id", connection.id);
    fail("A conexão com a Meta expirou. Conecte novamente.");
  }
  return { connection, token: decryptToken(connection.access_token_encrypted) };
}

export async function startMetaConnect(userId: string, organizationId: string) {
  await assertOrgAccess(userId, organizationId);
  const config = metaConfig();
  const state = randomBytes(32).toString("base64url");
  const now = new Date().toISOString();
  await supabaseAdmin.from("meta_oauth_states").delete().lt("expires_at", now);
  const { error } = await supabaseAdmin.from("meta_oauth_states").insert({
    state,
    user_id: userId,
    organization_id: organizationId,
    expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  });
  if (error) schemaFail(error.message);
  const url = new URL(`https://www.facebook.com/${config.version}/dialog/oauth`);
  url.searchParams.set("client_id", config.appId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", SCOPES.join(","));
  url.searchParams.set("display", "popup");
  return { url: url.toString() };
}

export async function startSimpleFacebookLogin(userId: string, organizationId: string) {
  const config = metaConfig();
  const state = `login.${randomBytes(32).toString("base64url")}`;
  const now = new Date().toISOString();
  await supabaseAdmin.from("meta_oauth_states").delete().lt("expires_at", now);
  const { error } = await supabaseAdmin.from("meta_oauth_states").insert({
    state,
    user_id: userId,
    organization_id: organizationId,
    expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  });
  if (error) schemaFail(error.message);
  const url = new URL(`https://www.facebook.com/${config.version}/dialog/oauth`);
  url.searchParams.set("client_id", config.appId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "public_profile");
  url.searchParams.set("display", "popup");
  return { url: url.toString() };
}

async function exchangeCode(code: string) {
  const config = metaConfig();
  const url = new URL(`https://graph.facebook.com/${config.version}/oauth/access_token`);
  url.searchParams.set("client_id", config.appId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("client_secret", config.appSecret);
  url.searchParams.set("code", code);
  const shortLived = await graphFetch(url);
  if (!shortLived.access_token) fail("A Meta não entregou a autorização.");
  const extended = new URL(`https://graph.facebook.com/${config.version}/oauth/access_token`);
  extended.searchParams.set("grant_type", "fb_exchange_token");
  extended.searchParams.set("client_id", config.appId);
  extended.searchParams.set("client_secret", config.appSecret);
  extended.searchParams.set("fb_exchange_token", shortLived.access_token);
  try {
    const longLived = await graphFetch(extended);
    if (longLived.access_token) {
      return {
        token: longLived.access_token,
        expiresIn: longLived.expires_in,
        version: config.version,
      };
    }
  } catch (error) {
    console.error("meta_extend", error instanceof Error ? error.name : "error");
  }
  return {
    token: shortLived.access_token,
    expiresIn: shortLived.expires_in,
    version: config.version,
  };
}

export async function completeMetaOAuth(
  userId: string,
  input: { code?: string; state?: string; error?: string; errorReason?: string },
) {
  if (input.error === "access_denied" || input.errorReason === "user_denied")
    fail("A autorização da Meta foi cancelada.");
  if (input.error) fail("A Meta não concluiu a autorização.");
  if (!input.code || !input.state) fail("A autorização da Meta voltou incompleta.");

  const { data: row, error } = await supabaseAdmin
    .from("meta_oauth_states")
    .select("id, user_id, organization_id, expires_at, used_at")
    .eq("state", input.state)
    .maybeSingle();
  if (error) schemaFail(error.message);
  if (!row || row.user_id !== userId) fail("Esta conexão da Meta não é válida. Comece de novo.");
  if (row.used_at) fail("Esta conexão da Meta já foi utilizada.");
  if (new Date(row.expires_at).getTime() < Date.now())
    fail("Esta conexão da Meta expirou. Comece de novo.");

  const { data: consumed, error: consumeError } = await supabaseAdmin
    .from("meta_oauth_states")
    .update({ used_at: new Date().toISOString() })
    .eq("id", row.id)
    .is("used_at", null)
    .select("id")
    .maybeSingle();
  if (consumeError) schemaFail(consumeError.message);
  if (!consumed) fail("Esta conexão da Meta já foi utilizada.");

  const exchanged = await exchangeCode(input.code);
  if (input.state.startsWith("login.")) {
    return { organizationId: row.organization_id, purpose: "login" as const };
  }
  const me = await graphGet(exchanged.version, "/me", exchanged.token, { fields: "id" });
  const now = new Date().toISOString();
  const expiresAt = exchanged.expiresIn
    ? new Date(Date.now() + exchanged.expiresIn * 1000).toISOString()
    : null;
  const payload = {
    organization_id: row.organization_id,
    connected_by: userId,
    meta_user_id: me.id ?? null,
    access_token_encrypted: encryptToken(exchanged.token),
    token_expires_at: expiresAt,
    status: "connected",
    connected_at: now,
    updated_at: now,
    last_error: null,
  };
  const { error: saveError } = await supabaseAdmin
    .from("meta_connections")
    .upsert(payload, { onConflict: "organization_id" });
  if (saveError) schemaFail(saveError.message);
  return { organizationId: row.organization_id, purpose: "connect" as const };
}

export async function getMetaConnection(
  userId: string,
  organizationId: string,
): Promise<MetaConnectionView> {
  await assertOrgAccess(userId, organizationId);
  const [connection, selected] = await Promise.all([
    connectionOf(organizationId),
    selectedAccount(organizationId),
  ]);
  const storedStatus = connection?.status;
  const status =
    storedStatus === "connected" ||
    storedStatus === "error" ||
    storedStatus === "disconnected" ||
    storedStatus === "pending"
      ? storedStatus
      : "missing";
  const base: MetaConnectionView = {
    status,
    connectedAt: connection?.connected_at ?? null,
    lastSyncAt: connection?.last_sync_at ?? null,
    lastError: connection?.last_error ?? null,
    selectedAccountId: selected?.external_account_id ?? null,
    selectedAccountName: selected?.name ?? null,
    selectedPortfolioId: selected?.portfolio_id ?? null,
    balanceUrl: normalizeBalanceLink(selected?.balance_url ?? ""),
    accounts: [],
  };
  return base;
}

async function rememberAccounts(
  organizationId: string,
  connectionId: string,
  accounts: MetaAccountView[],
) {
  const now = new Date().toISOString();
  for (const account of accounts) {
    const { error } = await supabaseAdmin.from("meta_accounts").upsert(
      {
        organization_id: organizationId,
        external_account_id: account.accountId,
        name: account.name,
        currency: account.currency || "BRL",
        account_status: account.statusLabel,
        connection_id: connectionId,
        sync_status: "synced",
        last_synced_at: now,
      },
      { onConflict: "organization_id,external_account_id" },
    );
    if (error) schemaFail(error.message);
  }
  await supabaseAdmin
    .from("meta_connections")
    .update({ last_sync_at: now, updated_at: now, last_error: null, status: "connected" })
    .eq("id", connectionId);
}

export async function syncMetaAccounts(userId: string, organizationId: string) {
  await assertOrgAccess(userId, organizationId);
  const { connection, token } = await loadToken(organizationId);
  const accounts = await collectAdAccounts(graphVersion(), token);
  await rememberAccounts(organizationId, connection.id, accounts);
  return getMetaConnection(userId, organizationId);
}

async function collectPages(
  version: string,
  token: string,
  path: string,
  params: Record<string, string>,
) {
  const rows: NonNullable<GraphBody["data"]> = [];
  let next: string | null = null;
  for (let page = 0; page < 5; page += 1) {
    const body: GraphBody = next
      ? await graphFetch(new URL(next))
      : await graphGet(version, path, token, params);
    rows.push(...(body.data ?? []));
    next = typeof body.paging?.next === "string" ? body.paging.next : null;
    if (!next) break;
  }
  return rows;
}

function businessDigits(value: string) {
  const digits = value.trim();
  if (!/^\d+$/.test(digits)) fail("Escolha um portfólio válido.");
  return digits;
}

export async function listMetaBusinesses(
  userId: string,
  organizationId: string,
): Promise<MetaBusinessView[]> {
  await assertOrgAccess(userId, organizationId);
  const { token } = await loadToken(organizationId);
  const rows = await collectPages(graphVersion(), token, "/me/businesses", {
    fields: "id,name",
    limit: "50",
  });
  const found: MetaBusinessView[] = [];
  for (const row of rows) {
    if (!row.id || !/^\d+$/.test(row.id) || found.some((item) => item.id === row.id)) continue;
    found.push({ id: row.id, name: row.name?.trim() || `Portfólio ${row.id}` });
  }
  return found;
}

export async function listBusinessAdAccounts(
  userId: string,
  organizationId: string,
  businessId: string,
) {
  await assertOrgAccess(userId, organizationId);
  const portfolioId = businessDigits(businessId);
  const { token } = await loadToken(organizationId);
  const version = graphVersion();
  const businesses = await listMetaBusinesses(userId, organizationId);
  if (!businesses.some((item) => item.id === portfolioId))
    fail("Esse portfólio não está disponível nesta conexão.");
  const fields = "id,name,account_id,account_status,currency";
  const params = { fields, limit: "50" };
  const [owned, clients] = await Promise.all([
    collectPages(version, token, `/${portfolioId}/owned_ad_accounts`, params).catch(
      (error: unknown) => error,
    ),
    collectPages(version, token, `/${portfolioId}/client_ad_accounts`, params).catch(
      (error: unknown) => error,
    ),
  ]);
  const rows = [...(Array.isArray(owned) ? owned : []), ...(Array.isArray(clients) ? clients : [])];
  if (rows.length === 0 && (owned instanceof Error || clients instanceof Error)) {
    throw owned instanceof Error ? owned : clients;
  }
  const found: MetaAccountView[] = [];
  for (const row of rows) {
    const view = toView(row);
    if (view && !found.some((account) => account.accountId === view.accountId)) found.push(view);
  }
  return found;
}

export async function selectMetaAdAccount(
  userId: string,
  organizationId: string,
  accountId: string,
  businessId: string,
  balanceUrl: string,
) {
  await assertOrgAccess(userId, organizationId);
  const digits = accountDigits(accountId);
  const portfolioId = businessDigits(businessId);
  const link = normalizeBalanceLink(balanceUrl);
  if (!link) fail("Informe o link de saldo da Meta para esta conta de anúncio.");
  const { connection } = await loadToken(organizationId);
  const accounts = await listBusinessAdAccounts(userId, organizationId, portfolioId);
  const match = accounts.find((account) => account.accountId === digits);
  if (!match) fail("Essa conta de anúncios não está disponível neste portfólio.");
  const now = new Date().toISOString();
  const { error: clearError } = await supabaseAdmin
    .from("meta_accounts")
    .update({ selected: false })
    .eq("organization_id", organizationId);
  if (clearError) schemaFail(clearError.message);
  const { error } = await supabaseAdmin.from("meta_accounts").upsert(
    {
      organization_id: organizationId,
      external_account_id: digits,
      name: match.name,
      currency: match.currency || "BRL",
      account_status: match.statusLabel,
      connection_id: connection.id,
      portfolio_id: portfolioId,
      balance_url: link,
      selected: true,
      sync_status: "synced",
      last_synced_at: now,
    },
    { onConflict: "organization_id,external_account_id" },
  );
  if (error) schemaFail(error.message);
  return getMetaConnection(userId, organizationId);
}

export async function disconnectMeta(userId: string, organizationId: string) {
  await assertOrgAccess(userId, organizationId);
  const now = new Date().toISOString();
  const { error } = await supabaseAdmin
    .from("meta_connections")
    .update({
      status: "disconnected",
      access_token_encrypted: null,
      token_expires_at: null,
      last_error: null,
      updated_at: now,
    })
    .eq("organization_id", organizationId);
  if (error) schemaFail(error.message);
  return getMetaConnection(userId, organizationId);
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;

function saoPauloToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function periodOf(input: { period?: string; since?: string; until?: string }): MetaPeriod {
  if (!input.period || input.period === "total") return { mode: "total" };
  if (input.period !== "custom") fail("Escolha Total ou um período personalizado.");
  const since = input.since ?? "";
  const until = input.until ?? "";
  if (!DAY.test(since) || !DAY.test(until)) fail("Escolha o início e o fim do período.");
  if (since > until) fail("O período personalizado precisa começar antes de terminar.");
  if (until > saoPauloToday()) fail("O período personalizado não pode terminar no futuro.");
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(until);
  if (!match) fail("Escolha o início e o fim do período.");
  const oldest = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  oldest.setUTCMonth(oldest.getUTCMonth() - 37);
  const limit = oldest.toISOString().slice(0, 10);
  if (since < limit) fail("A Meta só devolve até 37 meses nesse período.");
  return { mode: "custom", since, until };
}

function insightQuery(period: MetaPeriod) {
  if (period.mode === "total") return { date_preset: "maximum" };
  return { time_range: JSON.stringify({ since: period.since, until: period.until }) };
}

function campaignInsightField(period: MetaPeriod) {
  const metrics = "impressions,reach,clicks,spend,actions";
  if (period.mode === "total") return `insights.date_preset(maximum){${metrics}}`;
  return `insights.time_range({"since":"${period.since}","until":"${period.until}"}){${metrics}}`;
}

function amount(value: unknown) {
  const parsed =
    typeof value === "string" || typeof value === "number" ? Number(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : 0;
}

function actionLabel(type: string | undefined) {
  const labels: Record<string, string> = {
    link_click: "Cliques no link",
    lead: "Leads",
    purchase: "Compras",
    omni_purchase: "Compras",
    messaging_conversation_started_7d: "Conversas",
    post_engagement: "Engajamentos",
    page_engagement: "Engajamentos",
    landing_page_view: "Visualizações da página",
    video_view: "Visualizações de vídeo",
    complete_registration: "Cadastros",
    contact: "Contatos",
    add_to_cart: "Adições ao carrinho",
    initiate_checkout: "Inícios de checkout",
  };
  if (!type) return "Resultados";
  if (type.includes("messaging_conversation") || type.includes("messaging_first_reply"))
    return "Conversas";
  return labels[type] ?? "Resultados";
}

const resultGroups = [
  ["onsite_conversion.messaging_conversation_started_7d", "messaging_conversation_started_7d"],
  ["onsite_conversion.messaging_first_reply", "messaging_first_reply"],
  ["onsite_conversion.lead_grouped", "lead", "offsite_conversion.fb_pixel_lead"],
  ["omni_purchase", "purchase", "offsite_conversion.fb_pixel_purchase"],
  ["complete_registration"],
  ["landing_page_view"],
  ["link_click"],
];

function metricsOf(insight: GraphInsight | undefined) {
  const reach = amount(insight?.reach);
  const impressions = amount(insight?.impressions);
  const clicks = amount(insight?.clicks);
  const spend = amount(insight?.spend);
  const ctr = insight?.ctr
    ? amount(insight.ctr)
    : impressions > 0
      ? (clicks / impressions) * 100
      : null;
  const cpc = insight?.cpc ? amount(insight.cpc) : clicks > 0 ? spend / clicks : null;
  for (const group of resultGroups) {
    for (const type of group) {
      const found = insight?.actions?.find((entry) => entry.action_type === type);
      const value = amount(found?.value);
      if (found && value > 0) {
        return {
          reach,
          impressions,
          clicks,
          spend,
          ctr,
          cpc,
          results: value,
          resultLabel: actionLabel(type),
          resultActionTypes: group,
        };
      }
    }
  }
  let results = clicks;
  let resultLabel = "Cliques";
  let resultActionTypes: string[] = [];
  let bestValue = 0;
  for (const action of insight?.actions ?? []) {
    const value = amount(action.value);
    if (value > bestValue) {
      bestValue = value;
      results = value;
      resultLabel = actionLabel(action.action_type);
      resultActionTypes = action.action_type ? [action.action_type] : [];
    }
  }
  return { reach, impressions, clicks, spend, ctr, cpc, results, resultLabel, resultActionTypes };
}

function optionalAmount(value: string | undefined) {
  if (value == null || value === "") return null;
  const parsed = amount(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function kpisFrom(stats: ReturnType<typeof metricsOf>, insight?: GraphInsight): MetaKpis {
  const metaCpm = optionalAmount(insight?.cpm);
  const metaFrequency = optionalAmount(insight?.frequency);
  const cpm = metaCpm ?? (stats.impressions > 0 ? (stats.spend / stats.impressions) * 1000 : null);
  const frequency = metaFrequency ?? (stats.reach > 0 ? stats.impressions / stats.reach : null);
  return {
    reach: stats.reach,
    impressions: stats.impressions,
    clicks: stats.clicks,
    results: stats.results,
    resultLabel: stats.resultLabel,
    spend: stats.spend,
    cpc: stats.cpc,
    ctr: stats.ctr,
    cpm: cpm != null && Number.isFinite(cpm) ? cpm : null,
    frequency: frequency != null && Number.isFinite(frequency) ? frequency : null,
  };
}

function countResults(actions: InsightAction[] | undefined, types: string[], clicks: number) {
  if (types.length === 0) return clicks;
  for (const type of types) {
    const found = actions?.find((entry) => entry.action_type === type);
    if (found) return amount(found.value);
  }
  return 0;
}

function campaignStatus(raw: string | undefined): {
  label: string;
  group: MetaCampaignRow["statusGroup"];
} {
  if (raw === "ACTIVE") return { label: "Ativa", group: "Ativa" };
  if (raw === "PAUSED" || raw === "CAMPAIGN_PAUSED" || raw === "ADSET_PAUSED")
    return { label: "Inativa", group: "Inativa" };
  if (raw === "ARCHIVED" || raw === "DELETED") return { label: "Encerrada", group: "Encerrada" };
  if (raw === "PENDING_REVIEW" || raw === "IN_PROCESS" || raw === "WITH_ISSUES")
    return { label: "Em análise", group: "Outro" };
  return { label: "Indisponível", group: "Outro" };
}

async function collectCampaigns(
  version: string,
  token: string,
  accountId: string,
  period: MetaPeriod,
) {
  const rows: MetaCampaignRow[] = [];
  const actionTypes = new Map<string, string[]>();
  let next: string | null = null;
  const fields = `id,name,effective_status,${campaignInsightField(period)}`;
  for (let page = 0; page < 5; page += 1) {
    const body: GraphBody = next
      ? await graphFetch(new URL(next))
      : await graphGet(version, `/act_${accountId}/campaigns`, token, { fields, limit: "100" });
    for (const item of body.data ?? []) {
      if (!item.id || !/^\d+$/.test(item.id)) continue;
      const stats = metricsOf(item.insights?.data?.[0]);
      const status = campaignStatus(item.effective_status);
      rows.push({
        id: item.id,
        name: item.name?.trim() || `Campanha ${item.id}`,
        status: status.label,
        statusGroup: status.group,
        reach: stats.reach,
        impressions: stats.impressions,
        clicks: stats.clicks,
        results: stats.results,
        resultLabel: stats.resultLabel,
        spend: stats.spend,
        cpc: stats.cpc,
        ctr: stats.ctr,
      });
      actionTypes.set(item.id, stats.resultActionTypes);
    }
    next = typeof body.paging?.next === "string" ? body.paging.next : null;
    if (!next) break;
  }
  return { rows, actionTypes };
}

function nextDay(iso: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return iso;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function daysFrom(start: string, end: string) {
  const days: string[] = [];
  let cursor = start;
  while (cursor <= end && days.length < 1200) {
    days.push(cursor);
    cursor = nextDay(cursor);
  }
  return days;
}

const emptySeries: MetaResultSeries = { campaigns: [], points: [] };

function shiftMonths(iso: string, months: number) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return iso;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  date.setUTCMonth(date.getUTCMonth() + months);
  return date.toISOString().slice(0, 10);
}

function dailyRanges(period: MetaPeriod) {
  const until = period.mode === "custom" ? period.until : saoPauloToday();
  const since = period.mode === "custom" ? period.since : shiftMonths(until, -37);
  const ranges: { since: string; until: string }[] = [];
  let cursor = since;
  while (cursor <= until && ranges.length < 16) {
    let end = cursor;
    for (let step = 1; step < 90 && nextDay(end) <= until; step += 1) end = nextDay(end);
    ranges.push({ since: cursor, until: end });
    cursor = nextDay(end);
  }
  return ranges;
}

function dailyResult(actions: InsightAction[] | undefined, types: string[], clicks: unknown) {
  if (types.length === 0) return amount(clicks);
  for (const type of types) {
    const found = actions?.find((entry) => entry.action_type === type);
    if (found) return amount(found.value);
  }
  return 0;
}

function shiftDays(iso: string, days: number) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return iso;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function previousWindow(period: MetaPeriod) {
  if (period.mode !== "custom") return null;
  const length = daysFrom(period.since, period.until).length;
  if (length === 0) return null;
  const until = shiftDays(period.since, -1);
  return { since: shiftDays(until, -(length - 1)), until };
}

async function collectDaily(
  version: string,
  token: string,
  accountId: string,
  period: MetaPeriod,
  campaigns: MetaCampaignRow[],
  actionTypes: Map<string, string[]>,
): Promise<{ series: MetaResultSeries; days: MetaDayPoint[] }> {
  if (campaigns.length === 0) return { series: emptySeries, days: [] };
  const known = new Set(campaigns.map((row) => row.id));
  const totals = new Map<string, Map<string, MetaDayPoint>>();
  const covered = new Set<string>();
  const ranges = dailyRanges(period);
  const readRange = async (range: { since: string; until: string }) => {
    const found: MetaDayPoint[] = [];
    let next: string | null = null;
    for (let page = 0; page < 20; page += 1) {
      const body: GraphBody = next
        ? await graphFetch(new URL(next))
        : await graphGet(version, `/act_${accountId}/insights`, token, {
            level: "campaign",
            fields: "campaign_id,spend,impressions,clicks,actions,date_start",
            time_increment: "1",
            limit: "500",
            use_unified_attribution_setting: "true",
            time_range: JSON.stringify(range),
          });
      for (const item of body.data ?? []) {
        const row = item as GraphInsight;
        if (
          !row.campaign_id ||
          !row.date_start ||
          !known.has(row.campaign_id) ||
          !/^\d{4}-\d{2}-\d{2}$/.test(row.date_start)
        )
          continue;
        found.push({
          date: row.date_start,
          campaignId: row.campaign_id,
          spend: amount(row.spend),
          impressions: amount(row.impressions),
          clicks: amount(row.clicks),
          results: dailyResult(row.actions, actionTypes.get(row.campaign_id) ?? [], row.clicks),
        });
      }
      next = typeof body.paging?.next === "string" ? body.paging.next : null;
      if (!next) break;
    }
    return found;
  };
  for (let index = 0; index < ranges.length; index += 4) {
    const batch = await Promise.all(
      ranges.slice(index, index + 4).map(async (range) => {
        try {
          return { range, rows: await readRange(range) };
        } catch (error) {
          console.error("meta_daily_range", error instanceof Error ? error.name : "error");
          return { range, rows: null };
        }
      }),
    );
    for (const item of batch) {
      if (!item.rows) continue;
      for (const date of daysFrom(item.range.since, item.range.until)) covered.add(date);
      for (const row of item.rows) {
        const byCampaign = totals.get(row.date) ?? new Map<string, MetaDayPoint>();
        const current = byCampaign.get(row.campaignId);
        byCampaign.set(
          row.campaignId,
          current
            ? {
                ...current,
                spend: current.spend + row.spend,
                impressions: current.impressions + row.impressions,
                clicks: current.clicks + row.clicks,
                results: current.results + row.results,
              }
            : row,
        );
        totals.set(row.date, byCampaign);
      }
    }
  }
  const coveredDates = [...covered].sort();
  const first = coveredDates[0];
  const last = coveredDates[coveredDates.length - 1];
  const dates =
    period.mode === "custom"
      ? daysFrom(period.since, period.until).filter((date) => covered.has(date))
      : first && last
        ? daysFrom(first, last).filter((date) => covered.has(date))
        : [];
  const days: MetaDayPoint[] = [];
  for (const date of dates) {
    const byCampaign = totals.get(date);
    for (const row of campaigns) {
      const point = byCampaign?.get(row.id);
      days.push(
        point ?? { date, campaignId: row.id, spend: 0, impressions: 0, clicks: 0, results: 0 },
      );
    }
  }
  return {
    series: {
      campaigns: campaigns.map((row) => ({
        id: row.id,
        name: row.name,
        resultLabel: row.resultLabel,
      })),
      points: dates.map((date) => {
        const byCampaign = totals.get(date);
        const values: Record<string, number> = {};
        for (const row of campaigns) values[row.id] = byCampaign?.get(row.id)?.results ?? 0;
        return { date, values };
      }),
    },
    days,
  };
}

async function collectPrevious(
  version: string,
  token: string,
  accountId: string,
  period: MetaPeriod,
  campaigns: MetaCampaignRow[],
  actionTypes: Map<string, string[]>,
  accountTypes: string[],
  accountLabel: string,
): Promise<{
  previous: MetaKpis | null;
  previousCampaigns: MetaCampaignSnapshot[];
  previousReady: boolean;
}> {
  const window = previousWindow(period);
  if (!window) return { previous: null, previousCampaigns: [], previousReady: false };
  const range = JSON.stringify(window);
  const accountInsight = await graphGet(version, `/act_${accountId}/insights`, token, {
    fields: "spend,impressions,reach,clicks,ctr,cpc,cpm,frequency,actions",
    time_range: range,
  });
  const snapshots: MetaCampaignSnapshot[] = [];
  let next: string | null = null;
  for (let page = 0; page < 5; page += 1) {
    const body: GraphBody = next
      ? await graphFetch(new URL(next))
      : await graphGet(version, `/act_${accountId}/insights`, token, {
          level: "campaign",
          fields: "campaign_id,spend,impressions,reach,clicks,actions",
          time_range: range,
          limit: "500",
        });
    for (const item of body.data ?? []) {
      const row = item as GraphInsight;
      if (!row.campaign_id) continue;
      snapshots.push({
        id: row.campaign_id,
        spend: amount(row.spend),
        impressions: amount(row.impressions),
        reach: amount(row.reach),
        clicks: amount(row.clicks),
        results: countResults(
          row.actions,
          actionTypes.get(row.campaign_id) ?? accountTypes,
          amount(row.clicks),
        ),
      });
    }
    next = typeof body.paging?.next === "string" ? body.paging.next : null;
    if (!next) break;
  }
  const known = new Set(campaigns.map((row) => row.id));
  const comparable = snapshots.filter((row) => known.has(row.id));
  const stats = metricsOf(accountInsight.data?.[0]);
  const previous = kpisFrom(
    {
      ...stats,
      results: comparable.reduce((sum, row) => sum + row.results, 0),
      resultLabel: accountLabel,
      resultActionTypes: accountTypes,
    },
    accountInsight.data?.[0],
  );
  return { previous, previousCampaigns: comparable, previousReady: true };
}

async function viewerContext(userId: string) {
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
      .select("can_view_campaigns")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);
  if (profileError) schemaFail(profileError.message);
  if (roleError || permError) fail("Não foi possível confirmar o acesso.");
  if (!profile) fail("Seu perfil ainda não está ligado a um acesso.");
  if (profile.is_blocked) fail("Este acesso está bloqueado.");
  const role = (roles ?? []).some((item) => item.role === "master")
    ? "master"
    : (roles ?? []).some((item) => item.role === "client_admin")
      ? "client_admin"
      : "client_user";
  return {
    role,
    organizationId: profile.organization_id,
    canConnect: role === "master" || role === "client_admin",
    canView: role !== "client_user" || perms?.can_view_campaigns !== false,
  } as const;
}

function performanceBase(
  actor: {
    role: MetaPerformanceView["role"];
    organizationId: string | null;
    canConnect: boolean;
    canView: boolean;
  },
  period: MetaPeriod,
): MetaPerformanceView {
  return {
    organizationId: actor.organizationId,
    role: actor.role,
    canConnect: actor.canConnect,
    canView: actor.canView,
    connectionStatus: "missing",
    lastError: null,
    accountId: null,
    accountName: null,
    currency: "BRL",
    period,
    kpis: null,
    previous: null,
    previousReady: false,
    previousCampaigns: [],
    campaigns: [],
    series: emptySeries,
    days: [],
  };
}

export async function listMasterCampaigns(
  userId: string,
  input: { period?: string; since?: string; until?: string },
): Promise<MasterCampaignsView> {
  const period = periodOf(input);
  const actor = await viewerContext(userId);
  if (actor.role !== "master") fail("Só o Master consulta as campanhas de todos os clientes.");
  const { data: connections, error } = await supabaseAdmin
    .from("meta_connections")
    .select("organization_id")
    .eq("status", "connected");
  if (error) schemaFail(error.message);
  const organizationIds = [
    ...new Set(
      (connections ?? [])
        .map((row) => row.organization_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  if (organizationIds.length === 0) return { period, campaigns: [], clients: [], notices: [] };
  const { data: organizations, error: orgError } = await supabaseAdmin
    .from("organizations")
    .select("id, legal_name")
    .in("id", organizationIds);
  if (orgError) schemaFail(orgError.message);
  const names = new Map((organizations ?? []).map((org) => [org.id, org.legal_name]));
  const version = graphVersion();
  const campaigns: MasterCampaignsView["campaigns"] = [];
  const notices: string[] = [];
  const clients: MasterCampaignsView["clients"] = [];

  const readOne = async (organizationId: string) => {
    const clientName = names.get(organizationId) ?? "Cliente";
    clients.push({ id: organizationId, name: clientName });
    try {
      const selected = await selectedAccount(organizationId);
      if (!selected) {
        notices.push(`${clientName} ainda não tem uma conta de anúncio selecionada.`);
        return;
      }
      const { token } = await loadToken(organizationId);
      const collected = await collectCampaigns(
        version,
        token,
        selected.external_account_id,
        period,
      );
      for (const row of collected.rows) {
        campaigns.push({
          ...row,
          organizationId,
          clientName,
          accountName: selected.name?.trim() || "Conta de anúncio",
          currency: selected.currency || "BRL",
        });
      }
    } catch (readError) {
      const message =
        readError instanceof Error ? readError.message : "A Meta não respondeu como esperado.";
      if (/não está configurada/.test(message)) throw readError;
      notices.push(
        `${clientName}: ${/access_token|client_secret|EAA[A-Za-z0-9]/.test(message) ? "A Meta não respondeu como esperado." : message}`,
      );
    }
  };

  for (let index = 0; index < organizationIds.length; index += 3) {
    await Promise.all(
      organizationIds.slice(index, index + 3).map((organizationId) => readOne(organizationId)),
    );
  }
  clients.sort((left, right) => left.name.localeCompare(right.name, "pt-BR"));
  campaigns.sort(
    (left, right) =>
      left.clientName.localeCompare(right.clientName, "pt-BR") ||
      left.name.localeCompare(right.name, "pt-BR"),
  );
  return { period, campaigns, clients, notices };
}

export async function getMetaPerformance(
  userId: string,
  input: { organizationId?: string; period?: string; since?: string; until?: string },
): Promise<MetaPerformanceView> {
  const period = periodOf(input);
  const actor = await viewerContext(userId);
  let organizationId = actor.organizationId;
  if (actor.role === "master") {
    if (input.organizationId) {
      await assertOrgAccess(userId, input.organizationId);
      organizationId = input.organizationId;
    } else {
      const { data, error } = await supabaseAdmin
        .from("meta_connections")
        .select("organization_id")
        .eq("status", "connected")
        .order("connected_at", { ascending: false })
        .limit(1);
      if (error) schemaFail(error.message);
      organizationId = data?.[0]?.organization_id ?? null;
    }
  } else if (input.organizationId && input.organizationId !== actor.organizationId) {
    fail("Você não pode consultar esta conta.");
  }

  const view = performanceBase({ ...actor, organizationId }, period);
  if (!view.canView) {
    view.lastError = "Você não tem permissão para ver as campanhas.";
    return view;
  }
  if (!organizationId) return view;

  const [connection, selected] = await Promise.all([
    connectionOf(organizationId),
    selectedAccount(organizationId),
  ]);
  const storedStatus = connection?.status;
  view.connectionStatus =
    storedStatus === "connected" ||
    storedStatus === "error" ||
    storedStatus === "disconnected" ||
    storedStatus === "pending"
      ? storedStatus
      : "missing";
  view.lastError = connection?.last_error ?? null;
  view.accountId = selected?.external_account_id ?? null;
  view.accountName = selected?.name ?? null;
  view.currency = selected?.currency || "BRL";
  if (view.connectionStatus !== "connected" || !connection?.access_token_encrypted || !selected)
    return view;

  try {
    const { token } = await loadToken(organizationId);
    const version = graphVersion();
    const insight = await graphGet(
      version,
      `/act_${selected.external_account_id}/insights`,
      token,
      {
        fields: "spend,impressions,reach,clicks,ctr,cpc,cpm,frequency,actions",
        ...insightQuery(period),
      },
    );
    const stats = metricsOf(insight.data?.[0]);
    view.kpis = kpisFrom(stats, insight.data?.[0]);
    const collected = await collectCampaigns(version, token, selected.external_account_id, period);
    view.campaigns = collected.rows;
    if (view.kpis && collected.rows.length > 0) {
      const labels = new Set(collected.rows.map((row) => row.resultLabel));
      view.kpis.results = collected.rows.reduce((sum, row) => sum + row.results, 0);
      view.kpis.resultLabel = labels.size === 1 ? ([...labels][0] ?? "Resultados") : "Resultados";
    }
    try {
      const timeline = await collectDaily(
        version,
        token,
        selected.external_account_id,
        period,
        collected.rows,
        collected.actionTypes,
      );
      view.series = timeline.series;
      view.days = timeline.days;
    } catch (seriesError) {
      console.error("meta_daily", seriesError instanceof Error ? seriesError.name : "error");
      view.series = emptySeries;
      view.days = [];
    }
    try {
      const compared = await collectPrevious(
        version,
        token,
        selected.external_account_id,
        period,
        collected.rows,
        collected.actionTypes,
        stats.resultActionTypes,
        view.kpis?.resultLabel ?? stats.resultLabel,
      );
      view.previous = compared.previous;
      view.previousCampaigns = compared.previousCampaigns;
      view.previousReady = compared.previousReady;
    } catch (previousError) {
      console.error("meta_previous", previousError instanceof Error ? previousError.name : "error");
      view.previous = null;
      view.previousCampaigns = [];
      view.previousReady = false;
    }
    view.lastError = null;
    return view;
  } catch (error) {
    view.connectionStatus = "error";
    const message = error instanceof Error ? error.message : "A Meta não respondeu como esperado.";
    view.lastError = /access_token|client_secret|EAA[A-Za-z0-9]/.test(message)
      ? "A Meta não respondeu como esperado. Tente de novo."
      : message;
    view.kpis = null;
    view.previous = null;
    view.previousReady = false;
    view.previousCampaigns = [];
    view.campaigns = [];
    view.series = emptySeries;
    view.days = [];
    return view;
  }
}
