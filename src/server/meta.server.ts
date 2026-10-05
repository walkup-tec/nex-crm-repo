import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { MetaAccountView, MetaConnectionView } from "@/lib/meta-access";

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
  const redirectUri = process.env["META_REDIRECT_URI"] || "https://app.nexmeta.com.br/auth/meta/callback";
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
    return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
  } catch (error) {
    if (error instanceof Error && error.message.includes("configurada")) throw error;
    fail("A conexão Meta precisa ser refeita.");
  }
}

function missingSchema(message: string) {
  const text = message.toLowerCase();
  return text.includes("meta_oauth_states") || text.includes("meta_connections") || text.includes("account_status") || text.includes("selected") || text.includes("connection_id");
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
  if (code === 10 || code === 200 || code === 294) return "A autorização não inclui a permissão para ler as contas de anúncio.";
  return "A Meta não respondeu como esperado. Tente de novo.";
}

type GraphBody = {
  error?: GraphError;
  access_token?: string;
  expires_in?: number;
  id?: string;
  data?: GraphAccount[];
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

async function graphGet(version: string, path: string, token: string, params: Record<string, string>): Promise<GraphBody> {
  const url = new URL(`https://graph.facebook.com/${version}${path}`);
  url.searchParams.set("access_token", token);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return graphFetch(url);
}

async function assertOrgAccess(userId: string, organizationId: string) {
  const [{ data: profile, error: profileError }, { data: roles, error: roleError }] = await Promise.all([
    supabaseAdmin.from("profiles").select("id, organization_id, is_blocked").eq("id", userId).maybeSingle(),
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
  if (!/^\d+$/.test(digits)) fail("Informe o ID numérico da conta de anúncio.");
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
      : await graphGet(version, "/me/adaccounts", token, { fields: "id,name,account_id,account_status,currency", limit: "50" });
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
    .select("id, organization_id, status, connected_at, last_sync_at, last_error, access_token_encrypted, token_expires_at")
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error) schemaFail(error.message);
  return data;
}

async function selectedAccount(organizationId: string) {
  const { data, error } = await supabaseAdmin
    .from("meta_accounts")
    .select("external_account_id, name")
    .eq("organization_id", organizationId)
    .eq("selected", true)
    .limit(1);
  if (error) schemaFail(error.message);
  return data?.[0] ?? null;
}

async function loadToken(organizationId: string) {
  const connection = await connectionOf(organizationId);
  if (!connection || connection.status === "disconnected" || !connection.access_token_encrypted) {
    fail("Conecte a Meta antes de consultar as contas de anúncio.");
  }
  if (connection.token_expires_at && new Date(connection.token_expires_at).getTime() < Date.now()) {
    await supabaseAdmin.from("meta_connections").update({ status: "error", last_error: "A conexão com a Meta expirou.", updated_at: new Date().toISOString() }).eq("id", connection.id);
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
      return { token: longLived.access_token, expiresIn: longLived.expires_in, version: config.version };
    }
  } catch (error) {
    console.error("meta_extend", error instanceof Error ? error.name : "error");
  }
  return { token: shortLived.access_token, expiresIn: shortLived.expires_in, version: config.version };
}

export async function completeMetaOAuth(
  userId: string,
  input: { code?: string; state?: string; error?: string; errorReason?: string },
) {
  if (input.error === "access_denied" || input.errorReason === "user_denied") fail("A autorização da Meta foi cancelada.");
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
  if (new Date(row.expires_at).getTime() < Date.now()) fail("Esta conexão da Meta expirou. Comece de novo.");

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
  const me = await graphGet(exchanged.version, "/me", exchanged.token, { fields: "id" });
  const now = new Date().toISOString();
  const expiresAt = exchanged.expiresIn ? new Date(Date.now() + exchanged.expiresIn * 1000).toISOString() : null;
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
  const { error: saveError } = await supabaseAdmin.from("meta_connections").upsert(payload, { onConflict: "organization_id" });
  if (saveError) schemaFail(saveError.message);
  return { organizationId: row.organization_id };
}

export async function getMetaConnection(userId: string, organizationId: string): Promise<MetaConnectionView> {
  await assertOrgAccess(userId, organizationId);
  const [connection, selected] = await Promise.all([connectionOf(organizationId), selectedAccount(organizationId)]);
  const storedStatus = connection?.status;
  const status = storedStatus === "connected" || storedStatus === "error" || storedStatus === "disconnected" || storedStatus === "pending" ? storedStatus : "missing";
  const base: MetaConnectionView = {
    status,
    connectedAt: connection?.connected_at ?? null,
    lastSyncAt: connection?.last_sync_at ?? null,
    lastError: connection?.last_error ?? null,
    selectedAccountId: selected?.external_account_id ?? null,
    selectedAccountName: selected?.name ?? null,
    accounts: [],
  };
  if (base.status !== "connected" || !connection?.access_token_encrypted) return base;
  try {
    const { token } = await loadToken(organizationId);
    base.accounts = await collectAdAccounts(graphVersion(), token);
    if (base.accounts.length === 0) base.lastError = "Nenhuma conta de anúncio foi autorizada nesta conexão.";
    return base;
  } catch (error) {
    const message = error instanceof Error ? error.message : "A Meta não respondeu como esperado.";
    base.status = "error";
    base.lastError = message;
    return base;
  }
}

async function rememberAccounts(organizationId: string, connectionId: string, accounts: MetaAccountView[]) {
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
  await supabaseAdmin.from("meta_connections").update({ last_sync_at: now, updated_at: now, last_error: null, status: "connected" }).eq("id", connectionId);
}

export async function syncMetaAccounts(userId: string, organizationId: string) {
  await assertOrgAccess(userId, organizationId);
  const { connection, token } = await loadToken(organizationId);
  const accounts = await collectAdAccounts(graphVersion(), token);
  await rememberAccounts(organizationId, connection.id, accounts);
  return getMetaConnection(userId, organizationId);
}

export async function selectMetaAdAccount(userId: string, organizationId: string, accountId: string) {
  await assertOrgAccess(userId, organizationId);
  const digits = accountDigits(accountId);
  const { connection, token } = await loadToken(organizationId);
  const accounts = await collectAdAccounts(graphVersion(), token);
  const match = accounts.find((account) => account.accountId === digits);
  if (!match) fail("Essa conta de anúncios não está autorizada nesta conexão Meta.");
  await rememberAccounts(organizationId, connection.id, accounts);
  const { error: clearError } = await supabaseAdmin.from("meta_accounts").update({ selected: false }).eq("organization_id", organizationId);
  if (clearError) schemaFail(clearError.message);
  const { error } = await supabaseAdmin
    .from("meta_accounts")
    .update({ selected: true, name: match.name, account_status: match.statusLabel, currency: match.currency || "BRL" })
    .eq("organization_id", organizationId)
    .eq("external_account_id", digits);
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

export async function readSelectedInsights(userId: string, organizationId: string, datePreset = "last_30d") {
  await assertOrgAccess(userId, organizationId);
  const selected = await selectedAccount(organizationId);
  if (!selected) fail("Informe o ID da conta de anúncio que o NEX deve acompanhar.");
  const { token } = await loadToken(organizationId);
  const body = await graphGet(graphVersion(), `/act_${selected.external_account_id}/insights`, token, {
    fields: "spend,impressions,reach,clicks,ctr,cpc,cpm",
    date_preset: datePreset,
  });
  return { accountId: selected.external_account_id, rows: body.data ?? [] };
}
