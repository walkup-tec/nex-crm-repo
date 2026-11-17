/**
 * OAuth 2.1 (authorization_code + PKCE S256) para ChatGPT Web → MCP Career.
 * Credenciais e tokens OAuth são separados de CHATGPT_INTEGRATION_SECRET (Bearer REST/MCP direto).
 * Só emite tokens para walkup@walkuptec.com.br (ou CAREER_ALLOWED_EMAIL).
 */
import { createHash, randomUUID } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { createClient } from "@supabase/supabase-js";
import { CAREER_ALLOWED_EMAIL, normalizeEmail } from "@/lib/career-access";
import { secretsMatch } from "@/lib/chatgpt-integration";

export const CAREER_MCP_OAUTH_SCOPE = "career";
export const CAREER_MCP_OAUTH_CODE_TYP = "nex-career-oauth-code";
export const CAREER_MCP_OAUTH_ACCESS_TYP = "nex-career-oauth-access";
export const CAREER_MCP_OAUTH_REFRESH_TYP = "nex-career-oauth-refresh";

function json(status: number, body: unknown, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...extraHeaders,
    },
  });
}

function html(status: number, body: string) {
  return new Response(body, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

export function careerAppOrigin(request?: Request) {
  const fromEnv = process.env["APP_URL"]?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  if (request) return new URL(request.url).origin;
  return "https://app.nexmeta.com.br";
}

export function careerMcpResourceUrl(request?: Request) {
  return `${careerAppOrigin(request)}/api/integrations/chatgpt/career/mcp`;
}

export function careerOAuthIssuer(request?: Request) {
  return careerAppOrigin(request);
}

function allowedEmail() {
  return normalizeEmail(process.env["CAREER_ALLOWED_EMAIL"]?.trim() || CAREER_ALLOWED_EMAIL);
}

function oauthSigningSecret() {
  return process.env["CAREER_MCP_OAUTH_SIGNING_SECRET"]?.trim() ?? "";
}

function oauthSigningKey() {
  const secret = oauthSigningSecret();
  if (!secret) return null;
  return new TextEncoder().encode(secret);
}

function redirectAllowlist() {
  const extras = (process.env["CAREER_MCP_OAUTH_REDIRECT_URIS"] ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return [
    "https://chatgpt.com/connector_platform_oauth_redirect",
    "https://chatgpt.com/connector/oauth/",
    "https://chat.openai.com/connector_platform_oauth_redirect",
    "https://chat.openai.com/connector/oauth/",
    ...extras,
  ];
}

export function isAllowedOAuthRedirectUri(uri: string) {
  const value = uri.trim();
  if (!value) return false;
  for (const allowed of redirectAllowlist()) {
    if (allowed.endsWith("/") && value.startsWith(allowed)) return true;
    if (value === allowed) return true;
  }
  return false;
}

function sha256Base64Url(value: string) {
  return createHash("sha256").update(value).digest("base64url");
}

export function careerProtectedResourceMetadata(request?: Request) {
  const origin = careerAppOrigin(request);
  const resource = careerMcpResourceUrl(request);
  return {
    resource,
    authorization_servers: [careerOAuthIssuer(request)],
    scopes_supported: [CAREER_MCP_OAUTH_SCOPE, "openid", "email", "offline_access"],
    bearer_methods_supported: ["header"],
    resource_documentation: `${origin}/api/integrations/chatgpt/career/openapi`,
  };
}

export function careerAuthorizationServerMetadata(request?: Request) {
  const issuer = careerOAuthIssuer(request);
  const base = `${issuer}/api/integrations/chatgpt/career/oauth`;
  return {
    issuer,
    authorization_endpoint: `${base}/authorize`,
    token_endpoint: `${base}/token`,
    registration_endpoint: `${base}/register`,
    authorization_response_iss_parameter_supported: true,
    client_id_metadata_document_supported: true,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none", "client_secret_post", "client_secret_basic"],
    scopes_supported: [CAREER_MCP_OAUTH_SCOPE, "openid", "email", "offline_access"],
    subject_types_supported: ["public"],
  };
}

export function handleCareerProtectedResourceMetadata(request: Request) {
  return json(200, careerProtectedResourceMetadata(request));
}

export function handleCareerAuthorizationServerMetadata(request: Request) {
  return json(200, careerAuthorizationServerMetadata(request));
}

/** Compat: metadata legado sob /oauth/metadata → AS metadata. */
export function handleChatgptCareerOAuthMetadata(request: Request) {
  return handleCareerAuthorizationServerMetadata(request);
}

type AuthorizeQuery = {
  response_type: string;
  client_id: string;
  redirect_uri: string;
  state: string;
  code_challenge: string;
  code_challenge_method: string;
  scope: string;
  resource: string;
  error?: string;
};

function parseAuthorizeQuery(url: URL): AuthorizeQuery | { error: string; description: string } {
  const response_type = url.searchParams.get("response_type")?.trim() ?? "";
  const client_id = url.searchParams.get("client_id")?.trim() ?? "";
  const redirect_uri = url.searchParams.get("redirect_uri")?.trim() ?? "";
  const state = url.searchParams.get("state")?.trim() ?? "";
  const code_challenge = url.searchParams.get("code_challenge")?.trim() ?? "";
  const code_challenge_method = url.searchParams.get("code_challenge_method")?.trim() ?? "";
  const scope = url.searchParams.get("scope")?.trim() || CAREER_MCP_OAUTH_SCOPE;
  const resource = url.searchParams.get("resource")?.trim() || careerMcpResourceUrl();

  if (response_type !== "code") {
    return { error: "unsupported_response_type", description: "Use response_type=code." };
  }
  if (!client_id) return { error: "invalid_request", description: "client_id obrigatório." };
  if (!redirect_uri || !isAllowedOAuthRedirectUri(redirect_uri)) {
    return { error: "invalid_request", description: "redirect_uri não permitido." };
  }
  if (!code_challenge || code_challenge_method !== "S256") {
    return { error: "invalid_request", description: "PKCE S256 obrigatório." };
  }
  const expectedResource = careerMcpResourceUrl();
  if (resource !== expectedResource && resource !== careerAppOrigin()) {
    return { error: "invalid_target", description: "resource inválido para o MCP Career." };
  }
  return {
    response_type,
    client_id,
    redirect_uri,
    state,
    code_challenge,
    code_challenge_method,
    scope,
    resource: resource === careerAppOrigin() ? expectedResource : resource,
  };
}

function authorizeFormHtml(query: AuthorizeQuery, message = "") {
  const params = new URLSearchParams({
    response_type: query.response_type,
    client_id: query.client_id,
    redirect_uri: query.redirect_uri,
    state: query.state,
    code_challenge: query.code_challenge,
    code_challenge_method: query.code_challenge_method,
    scope: query.scope,
    resource: query.resource,
  });
  const err = message
    ? `<p style="color:#b91c1c;margin:0 0 12px">${message.replace(/[<>&]/g, "")}</p>`
    : "";
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>NEX Career — Autorizar ChatGPT</title>
<style>
body{font-family:ui-sans-serif,system-ui,sans-serif;background:#0b1220;color:#e2e8f0;margin:0;min-height:100vh;display:grid;place-items:center}
form{width:min(420px,92vw);background:#111827;border:1px solid #1f2937;border-radius:16px;padding:24px;box-shadow:0 20px 50px rgba(0,0,0,.35)}
h1{font-size:1.15rem;margin:0 0 8px}p{color:#94a3b8;font-size:.92rem;line-height:1.45}
label{display:block;font-size:.8rem;margin:14px 0 6px;color:#cbd5e1}
input{width:100%;box-sizing:border-box;border-radius:10px;border:1px solid #334155;background:#0f172a;color:#f8fafc;padding:10px 12px}
button{margin-top:18px;width:100%;border:0;border-radius:10px;padding:12px;background:#2563eb;color:white;font-weight:600;cursor:pointer}
small{display:block;margin-top:12px;color:#64748b;font-size:.75rem}
</style></head><body>
<form method="post" action="/api/integrations/chatgpt/career/oauth/authorize?${params.toString()}">
<h1>Autorizar NEX Career Intelligence</h1>
<p>Acesso exclusivo Walkup. Informe a conta autorizada para liberar o MCP no ChatGPT.</p>
${err}
<label for="email">E-mail</label>
<input id="email" name="email" type="email" autocomplete="username" required />
<label for="password">Senha</label>
<input id="password" name="password" type="password" autocomplete="current-password" required />
<button type="submit">Autorizar</button>
<small>Escopo: ${CAREER_MCP_OAUTH_SCOPE}. Tokens OAuth são distintos do Bearer de integração REST.</small>
</form></body></html>`;
}

async function issueAuthorizationCode(input: {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  resource: string;
  scope: string;
  email: string;
  userId: string;
}) {
  const key = oauthSigningKey();
  if (!key) throw new Error("CAREER_MCP_OAUTH_SIGNING_SECRET ausente.");
  const issuer = careerOAuthIssuer();
  return new SignJWT({
    typ: CAREER_MCP_OAUTH_CODE_TYP,
    client_id: input.clientId,
    redirect_uri: input.redirectUri,
    code_challenge: input.codeChallenge,
    code_challenge_method: "S256",
    resource: input.resource,
    scope: input.scope,
    email: input.email,
    sub: input.userId,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(issuer)
    .setAudience(input.resource)
    .setIssuedAt()
    .setExpirationTime("5m")
    .setJti(randomUUID())
    .sign(key);
}

async function issueAccessToken(input: {
  resource: string;
  scope: string;
  email: string;
  userId: string;
  clientId: string;
}) {
  const key = oauthSigningKey();
  if (!key) throw new Error("CAREER_MCP_OAUTH_SIGNING_SECRET ausente.");
  const issuer = careerOAuthIssuer();
  return new SignJWT({
    typ: CAREER_MCP_OAUTH_ACCESS_TYP,
    scope: input.scope,
    email: input.email,
    client_id: input.clientId,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(issuer)
    .setAudience(input.resource)
    .setSubject(input.userId)
    .setIssuedAt()
    .setExpirationTime("1h")
    .setJti(randomUUID())
    .sign(key);
}

async function issueRefreshToken(input: {
  resource: string;
  scope: string;
  email: string;
  userId: string;
  clientId: string;
}) {
  const key = oauthSigningKey();
  if (!key) throw new Error("CAREER_MCP_OAUTH_SIGNING_SECRET ausente.");
  const issuer = careerOAuthIssuer();
  return new SignJWT({
    typ: CAREER_MCP_OAUTH_REFRESH_TYP,
    scope: input.scope,
    email: input.email,
    client_id: input.clientId,
    resource: input.resource,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(issuer)
    .setAudience(input.resource)
    .setSubject(input.userId)
    .setIssuedAt()
    .setExpirationTime("30d")
    .setJti(randomUUID())
    .sign(key);
}

export type CareerMcpAccessClaims = {
  email: string;
  scope: string;
  sub: string;
  aud: string;
  iss: string;
  exp: number;
};

export async function verifyCareerMcpAccessToken(
  token: string,
  request?: Request,
): Promise<{ ok: true; claims: CareerMcpAccessClaims } | { ok: false; message: string }> {
  const key = oauthSigningKey();
  if (!key) return { ok: false, message: "OAuth Career não configurado." };
  try {
    const { payload } = await jwtVerify(token, key, {
      issuer: careerOAuthIssuer(request),
      audience: careerMcpResourceUrl(request),
    });
    if (payload["typ"] !== CAREER_MCP_OAUTH_ACCESS_TYP) {
      return { ok: false, message: "Tipo de token inválido." };
    }
    const email = normalizeEmail(String(payload["email"] ?? ""));
    const scope = String(payload["scope"] ?? "");
    const sub = String(payload.sub ?? "");
    const aud = Array.isArray(payload.aud) ? String(payload.aud[0] ?? "") : String(payload.aud ?? "");
    const iss = String(payload.iss ?? "");
    const exp = Number(payload.exp ?? 0);
    if (!email || email !== allowedEmail()) {
      return { ok: false, message: "E-mail do token não autorizado." };
    }
    if (!scope.split(/\s+/).includes(CAREER_MCP_OAUTH_SCOPE)) {
      return { ok: false, message: "Escopo do token insuficiente." };
    }
    if (!sub || !aud || !iss || !Number.isFinite(exp)) {
      return { ok: false, message: "Claims obrigatórias ausentes." };
    }
    return {
      ok: true,
      claims: { email, scope, sub, aud, iss, exp },
    };
  } catch {
    return { ok: false, message: "Token OAuth inválido ou expirado." };
  }
}

/** True se o Bearer for o segredo de integração (REST / MCP direto). */
export function isChatgptIntegrationBearer(token: string) {
  const current = process.env["CHATGPT_INTEGRATION_SECRET"]?.trim() ?? "";
  const previous = process.env["CHATGPT_INTEGRATION_SECRET_PREVIOUS"]?.trim() ?? "";
  if (!token || !current) return false;
  return secretsMatch(token, current) || (previous ? secretsMatch(token, previous) : false);
}

export async function handleCareerOAuthAuthorizeGet(request: Request) {
  if (!oauthSigningKey()) {
    return html(503, "<p>CAREER_MCP_OAUTH_SIGNING_SECRET não configurado no servidor.</p>");
  }
  const parsed = parseAuthorizeQuery(new URL(request.url));
  if ("error" in parsed && "description" in parsed) {
    return html(400, `<p>${parsed.description}</p>`);
  }
  return html(200, authorizeFormHtml(parsed as AuthorizeQuery));
}

export async function handleCareerOAuthAuthorizePost(request: Request) {
  if (!oauthSigningKey()) {
    return html(503, "<p>CAREER_MCP_OAUTH_SIGNING_SECRET não configurado no servidor.</p>");
  }
  const url = new URL(request.url);
  const parsed = parseAuthorizeQuery(url);
  if ("error" in parsed && "description" in parsed) {
    return html(400, `<p>${parsed.description}</p>`);
  }
  const query = parsed as AuthorizeQuery;
  const form = await request.formData();
  const email = normalizeEmail(String(form.get("email") ?? ""));
  const password = String(form.get("password") ?? "");
  if (!email || !password) {
    return html(400, authorizeFormHtml(query, "Informe e-mail e senha."));
  }
  if (email !== allowedEmail()) {
    return html(403, authorizeFormHtml(query, "Esta conta não tem acesso ao módulo Candidatura."));
  }

  const supabaseUrl = process.env["SUPABASE_URL"]?.trim();
  const publishable = process.env["SUPABASE_PUBLISHABLE_KEY"]?.trim();
  if (!supabaseUrl || !publishable) {
    return html(503, authorizeFormHtml(query, "Supabase não configurado no servidor."));
  }

  const supabase = createClient(supabaseUrl, publishable, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user?.id) {
    return html(401, authorizeFormHtml(query, "Não foi possível autenticar. Confira e-mail e senha."));
  }
  if (normalizeEmail(data.user.email ?? "") !== allowedEmail()) {
    return html(403, authorizeFormHtml(query, "Esta conta não tem acesso ao módulo Candidatura."));
  }

  try {
    const code = await issueAuthorizationCode({
      clientId: query.client_id,
      redirectUri: query.redirect_uri,
      codeChallenge: query.code_challenge,
      resource: query.resource,
      scope: query.scope.includes(CAREER_MCP_OAUTH_SCOPE)
        ? query.scope
        : `${query.scope} ${CAREER_MCP_OAUTH_SCOPE}`.trim(),
      email: allowedEmail(),
      userId: data.user.id,
    });
    const redirect = new URL(query.redirect_uri);
    redirect.searchParams.set("code", code);
    if (query.state) redirect.searchParams.set("state", query.state);
    redirect.searchParams.set("iss", careerOAuthIssuer(request));
    return Response.redirect(redirect.toString(), 302);
  } catch {
    return html(500, authorizeFormHtml(query, "Falha ao emitir código de autorização."));
  }
}

export async function handleChatgptCareerOAuthAuthorize(request: Request) {
  if (request.method.toUpperCase() === "POST") return handleCareerOAuthAuthorizePost(request);
  return handleCareerOAuthAuthorizeGet(request);
}

export async function handleChatgptCareerOAuthRegister(request: Request) {
  // DCR mínimo: aceita registro público e devolve client_id (PKCE, auth method none).
  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return json(400, { error: "invalid_client_metadata" });
  }
  const redirectUris = Array.isArray(body.redirect_uris)
    ? body.redirect_uris.map((item) => String(item))
    : [];
  if (!redirectUris.length || !redirectUris.every((uri) => isAllowedOAuthRedirectUri(uri))) {
    return json(400, { error: "invalid_redirect_uri" });
  }
  const clientId = `nex-career-${randomUUID()}`;
  return json(201, {
    client_id: clientId,
    client_id_issued_at: Math.floor(Date.now() / 1000),
    redirect_uris: redirectUris,
    token_endpoint_auth_method: "none",
    grant_types: ["authorization_code"],
    response_types: ["code"],
    client_name: typeof body.client_name === "string" ? body.client_name : "ChatGPT",
  });
}

export async function handleChatgptCareerOAuthToken(request: Request): Promise<Response> {
  if (!oauthSigningKey()) {
    return json(500, {
      error: "server_error",
      error_description: "CAREER_MCP_OAUTH_SIGNING_SECRET não configurado.",
    });
  }

  let form: URLSearchParams;
  try {
    form = new URLSearchParams(await request.text());
  } catch {
    return json(400, { error: "invalid_request", error_description: "Corpo inválido." });
  }

  const grant = (form.get("grant_type") ?? "").trim();
  const clientId = (form.get("client_id") ?? "").trim();
  const resource = (form.get("resource") ?? "").trim() || careerMcpResourceUrl(request);
  const key = oauthSigningKey();
  if (!key) {
    return json(500, { error: "server_error", error_description: "Assinatura OAuth indisponível." });
  }

  if (grant === "refresh_token") {
    const refreshToken = (form.get("refresh_token") ?? "").trim();
    if (!refreshToken || !clientId) {
      return json(400, { error: "invalid_request", error_description: "refresh_token e client_id obrigatórios." });
    }
    try {
      const { payload } = await jwtVerify(refreshToken, key, {
        issuer: careerOAuthIssuer(request),
        audience: careerMcpResourceUrl(request),
      });
      if (payload["typ"] !== CAREER_MCP_OAUTH_REFRESH_TYP) {
        return json(400, { error: "invalid_grant", error_description: "refresh_token inválido." });
      }
      if (String(payload["client_id"] ?? "") !== clientId) {
        return json(400, { error: "invalid_grant", error_description: "client_id não confere." });
      }
      const email = normalizeEmail(String(payload["email"] ?? ""));
      const sub = String(payload.sub ?? "");
      const scope = String(payload["scope"] ?? CAREER_MCP_OAUTH_SCOPE);
      const tokenResource = String(payload["resource"] ?? careerMcpResourceUrl(request));
      if (email !== allowedEmail() || !sub) {
        return json(403, { error: "access_denied", error_description: "Usuário não autorizado." });
      }
      const accessToken = await issueAccessToken({
        resource: tokenResource,
        scope,
        email,
        userId: sub,
        clientId,
      });
      const nextRefresh = await issueRefreshToken({
        resource: tokenResource,
        scope,
        email,
        userId: sub,
        clientId,
      });
      return json(200, {
        access_token: accessToken,
        refresh_token: nextRefresh,
        token_type: "bearer",
        expires_in: 3600,
        scope,
      });
    } catch {
      return json(400, { error: "invalid_grant", error_description: "refresh_token inválido ou expirado." });
    }
  }

  if (grant !== "authorization_code") {
    return json(400, {
      error: "unsupported_grant_type",
      error_description: "Use grant_type=authorization_code ou refresh_token.",
    });
  }

  const code = (form.get("code") ?? "").trim();
  const redirectUri = (form.get("redirect_uri") ?? "").trim();
  const codeVerifier = (form.get("code_verifier") ?? "").trim();

  if (!code || !redirectUri || !clientId || !codeVerifier) {
    return json(400, { error: "invalid_request", error_description: "Parâmetros obrigatórios ausentes." });
  }
  if (!isAllowedOAuthRedirectUri(redirectUri)) {
    return json(400, { error: "invalid_request", error_description: "redirect_uri inválido." });
  }

  try {
    const { payload } = await jwtVerify(code, key, {
      issuer: careerOAuthIssuer(request),
      audience: careerMcpResourceUrl(request),
    });
    if (payload["typ"] !== CAREER_MCP_OAUTH_CODE_TYP) {
      return json(400, { error: "invalid_grant", error_description: "Código inválido." });
    }
    if (String(payload["client_id"] ?? "") !== clientId) {
      return json(400, { error: "invalid_grant", error_description: "client_id não confere." });
    }
    if (String(payload["redirect_uri"] ?? "") !== redirectUri) {
      return json(400, { error: "invalid_grant", error_description: "redirect_uri não confere." });
    }
    const challenge = String(payload["code_challenge"] ?? "");
    if (!challenge || sha256Base64Url(codeVerifier) !== challenge) {
      return json(400, { error: "invalid_grant", error_description: "PKCE inválido." });
    }
    const codeResource = String(payload["resource"] ?? "");
    if (resource !== codeResource && resource !== careerMcpResourceUrl(request)) {
      return json(400, { error: "invalid_target", error_description: "resource inválido." });
    }
    const email = normalizeEmail(String(payload["email"] ?? ""));
    const sub = String(payload.sub ?? "");
    const scope = String(payload["scope"] ?? CAREER_MCP_OAUTH_SCOPE);
    if (email !== allowedEmail() || !sub) {
      return json(403, { error: "access_denied", error_description: "Usuário não autorizado." });
    }

    const tokenResource = codeResource || careerMcpResourceUrl(request);
    const accessToken = await issueAccessToken({
      resource: tokenResource,
      scope,
      email,
      userId: sub,
      clientId,
    });
    const refreshToken = await issueRefreshToken({
      resource: tokenResource,
      scope,
      email,
      userId: sub,
      clientId,
    });

    return json(200, {
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: "bearer",
      expires_in: 3600,
      scope,
    });
  } catch {
    return json(400, { error: "invalid_grant", error_description: "Código inválido ou expirado." });
  }
}
