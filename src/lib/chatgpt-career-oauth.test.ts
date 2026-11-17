import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { SignJWT } from "jose";
import {
  CAREER_MCP_OAUTH_ACCESS_TYP,
  CAREER_MCP_OAUTH_CODE_TYP,
  CAREER_MCP_OAUTH_SCOPE,
  careerAuthorizationServerMetadata,
  careerProtectedResourceMetadata,
  handleCareerOAuthAuthorizeGet,
  handleChatgptCareerOAuthMetadata,
  handleChatgptCareerOAuthRegister,
  handleChatgptCareerOAuthToken,
  isAllowedOAuthRedirectUri,
  verifyCareerMcpAccessToken,
} from "../server/chatgpt-career-oauth.server";
import { handleChatgptCareerMcpRequest } from "../server/chatgpt-career-mcp.server";
import { CAREER_MCP_PROTOCOL_VERSION } from "./chatgpt-career-mcp";

const INTEGRATION_SECRET = "nex-career-integration-secret";
const OAUTH_SIGNING = "nex-career-oauth-signing-secret-separate";
const APP = "https://app.nexmeta.com.br";
const MCP = `${APP}/api/integrations/chatgpt/career/mcp`;
const EMAIL = "walkup@walkuptec.com.br";

process.env["CHATGPT_INTEGRATION_SECRET"] = INTEGRATION_SECRET;
process.env["CAREER_MCP_OAUTH_SIGNING_SECRET"] = OAUTH_SIGNING;
process.env["APP_URL"] = APP;
process.env["CAREER_ALLOWED_EMAIL"] = EMAIL;

const tokenUrl = `${APP}/api/integrations/chatgpt/career/oauth/token`;
const metaUrl = `${APP}/api/integrations/chatgpt/career/oauth/metadata`;
const registerUrl = `${APP}/api/integrations/chatgpt/career/oauth/register`;
const redirectUri = "https://chatgpt.com/connector_platform_oauth_redirect";

function pkce() {
  const verifier = randomUUID().replace(/-/g, "") + randomUUID().replace(/-/g, "");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

async function mintCode(input: {
  clientId: string;
  redirectUri: string;
  challenge: string;
  email?: string;
  userId?: string;
}) {
  const key = new TextEncoder().encode(OAUTH_SIGNING);
  return new SignJWT({
    typ: CAREER_MCP_OAUTH_CODE_TYP,
    client_id: input.clientId,
    redirect_uri: input.redirectUri,
    code_challenge: input.challenge,
    code_challenge_method: "S256",
    resource: MCP,
    scope: CAREER_MCP_OAUTH_SCOPE,
    email: input.email ?? EMAIL,
    sub: input.userId ?? "user-walkup-1",
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(APP)
    .setAudience(MCP)
    .setIssuedAt()
    .setExpirationTime("5m")
    .setJti(randomUUID())
    .sign(key);
}

{
  const as = careerAuthorizationServerMetadata();
  assert.equal(as.issuer, APP);
  assert.ok(as.authorization_endpoint.endsWith("/oauth/authorize"));
  assert.ok(as.token_endpoint.endsWith("/oauth/token"));
  assert.deepEqual(as.code_challenge_methods_supported, ["S256"]);
  assert.ok(as.grant_types_supported.includes("authorization_code"));
  assert.ok(!as.grant_types_supported.includes("client_credentials"));

  const prm = careerProtectedResourceMetadata();
  assert.equal(prm.resource, MCP);
  assert.deepEqual(prm.authorization_servers, [APP]);
}

{
  const res = await handleChatgptCareerOAuthMetadata(new Request(metaUrl));
  assert.equal(res.status, 200);
  const body = (await res.json()) as {
    token_endpoint?: string;
    grant_types_supported?: string[];
    code_challenge_methods_supported?: string[];
  };
  assert.ok(body.token_endpoint?.endsWith("/oauth/token"));
  assert.ok(body.grant_types_supported?.includes("authorization_code"));
  assert.ok(!body.grant_types_supported?.includes("client_credentials"));
  assert.deepEqual(body.code_challenge_methods_supported, ["S256"]);
  assert.ok(!JSON.stringify(body).includes(INTEGRATION_SECRET));
  assert.ok(!JSON.stringify(body).includes(OAUTH_SIGNING));
}

assert.equal(isAllowedOAuthRedirectUri(redirectUri), true);
assert.equal(isAllowedOAuthRedirectUri("https://evil.example/callback"), false);

{
  const res = await handleChatgptCareerOAuthToken(
    new Request(tokenUrl, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: "grant_type=client_credentials&client_id=nex-career&client_secret=x",
    }),
  );
  assert.equal(res.status, 400);
  const body = (await res.json()) as { error?: string };
  assert.equal(body.error, "unsupported_grant_type");
}

{
  const { verifier, challenge } = pkce();
  const clientId = "nex-career-test-client";
  const code = await mintCode({ clientId, redirectUri, challenge });
  const res = await handleChatgptCareerOAuthToken(
    new Request(tokenUrl, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
        code_verifier: verifier,
        resource: MCP,
      }).toString(),
    }),
  );
  assert.equal(res.status, 200);
  const body = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    token_type?: string;
    scope?: string;
  };
  assert.equal(body.token_type, "bearer");
  assert.ok(body.access_token);
  assert.ok(body.refresh_token);
  assert.notEqual(body.access_token, INTEGRATION_SECRET);
  assert.ok(!body.access_token!.includes(INTEGRATION_SECRET));
  assert.ok(body.scope?.includes(CAREER_MCP_OAUTH_SCOPE));

  const verified = await verifyCareerMcpAccessToken(body.access_token!);
  assert.equal(verified.ok, true);
  if (verified.ok) {
    assert.equal(verified.claims.email, EMAIL);
    assert.equal(verified.claims.aud, MCP);
    assert.equal(verified.claims.iss, APP);
    assert.ok(verified.claims.exp > Math.floor(Date.now() / 1000));
    assert.ok(verified.claims.scope.includes(CAREER_MCP_OAUTH_SCOPE));
  }

  // MCP aceita JWT OAuth
  const mcpRes = await handleChatgptCareerMcpRequest(
    new Request(MCP, {
      method: "POST",
      headers: {
        authorization: `Bearer ${body.access_token}`,
        accept: "application/json, text/event-stream",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: CAREER_MCP_PROTOCOL_VERSION,
          capabilities: {},
          clientInfo: { name: "oauth-test", version: "1.0.0" },
        },
      }),
    }),
  );
  assert.equal(mcpRes.status, 200);

  // refresh_token
  const refreshRes = await handleChatgptCareerOAuthToken(
    new Request(tokenUrl, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: body.refresh_token!,
        client_id: clientId,
      }).toString(),
    }),
  );
  assert.equal(refreshRes.status, 200);
  const refreshed = (await refreshRes.json()) as { access_token?: string };
  assert.ok(refreshed.access_token);
  assert.notEqual(refreshed.access_token, body.access_token);
}

{
  // PKCE inválido
  const { challenge } = pkce();
  const clientId = "nex-career-test-client";
  const code = await mintCode({ clientId, redirectUri, challenge });
  const res = await handleChatgptCareerOAuthToken(
    new Request(tokenUrl, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
        code_verifier: "wrong-verifier-value-not-matching-challenge",
      }).toString(),
    }),
  );
  assert.equal(res.status, 400);
}

{
  // e-mail não autorizado no code
  const { verifier, challenge } = pkce();
  const clientId = "nex-career-test-client";
  const code = await mintCode({
    clientId,
    redirectUri,
    challenge,
    email: "outro@example.com",
  });
  const res = await handleChatgptCareerOAuthToken(
    new Request(tokenUrl, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
        code_verifier: verifier,
      }).toString(),
    }),
  );
  assert.equal(res.status, 403);
}

{
  // Access token forjado com typ errado / sem escopo
  const key = new TextEncoder().encode(OAUTH_SIGNING);
  const bad = await new SignJWT({
    typ: CAREER_MCP_OAUTH_ACCESS_TYP,
    scope: "openid",
    email: EMAIL,
    client_id: "x",
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(APP)
    .setAudience(MCP)
    .setSubject("user-1")
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(key);
  const verified = await verifyCareerMcpAccessToken(bad);
  assert.equal(verified.ok, false);
}

{
  // DCR
  const res = await handleChatgptCareerOAuthRegister(
    new Request(registerUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        client_name: "ChatGPT",
        redirect_uris: [redirectUri],
        token_endpoint_auth_method: "none",
        grant_types: ["authorization_code"],
        response_types: ["code"],
      }),
    }),
  );
  assert.equal(res.status, 201);
  const body = (await res.json()) as { client_id?: string; token_endpoint_auth_method?: string };
  assert.ok(body.client_id?.startsWith("nex-career-"));
  assert.equal(body.token_endpoint_auth_method, "none");
}

{
  // Authorize GET exige PKCE S256
  const url = new URL(`${APP}/api/integrations/chatgpt/career/oauth/authorize`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", "test");
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("code_challenge", "abc");
  url.searchParams.set("code_challenge_method", "plain");
  const res = await handleCareerOAuthAuthorizeGet(new Request(url));
  assert.equal(res.status, 400);
}

{
  // MCP ainda aceita Bearer de integração
  const res = await handleChatgptCareerMcpRequest(
    new Request(MCP, {
      method: "POST",
      headers: {
        authorization: `Bearer ${INTEGRATION_SECRET}`,
        accept: "application/json, text/event-stream",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 2,
        method: "initialize",
        params: {
          protocolVersion: CAREER_MCP_PROTOCOL_VERSION,
          capabilities: {},
          clientInfo: { name: "bearer-test", version: "1.0.0" },
        },
      }),
    }),
  );
  assert.equal(res.status, 200);
  const challenge = await handleChatgptCareerMcpRequest(
    new Request(MCP, {
      method: "POST",
      headers: { accept: "application/json, text/event-stream", "content-type": "application/json" },
      body: "{}",
    }),
  );
  assert.equal(challenge.status, 401);
  assert.ok(challenge.headers.get("www-authenticate")?.includes("resource_metadata"));
  assert.ok(challenge.headers.get("www-authenticate")?.includes("/.well-known/oauth-protected-resource"));
}

console.log("chatgpt-career-oauth.test.ts: ok");
