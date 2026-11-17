import assert from "node:assert/strict";
import {
  CAREER_MCP_PROTOCOL_VERSION,
  CAREER_MCP_SERVER_INFO,
  careerMcpTools,
  findCareerMcpTool,
  listCareerMcpToolNames,
} from "./chatgpt-career-mcp";
import { authenticateChatgptIntegration } from "../server/chatgpt-integration.server";
import { handleChatgptCareerMcpRequest } from "../server/chatgpt-career-mcp.server";

const SECRET = "nex-career-mcp-test-secret";
process.env["CHATGPT_INTEGRATION_SECRET"] = SECRET;
process.env["CAREER_MCP_OAUTH_SIGNING_SECRET"] = "nex-career-oauth-signing-for-mcp-tests";
process.env["APP_URL"] = "https://app.nexmeta.com.br";

assert.ok(careerMcpTools.length >= 10);
assert.ok(listCareerMcpToolNames().includes("career_health"));
assert.ok(listCareerMcpToolNames().includes("career_companies_discover"));
assert.ok(listCareerMcpToolNames().includes("career_jobs_search"));
assert.ok(listCareerMcpToolNames().includes("career_applications_prepare"));
assert.ok(listCareerMcpToolNames().includes("career_history"));
assert.equal(findCareerMcpTool("career_send_application"), null);
assert.ok(!listCareerMcpToolNames().some((name) => /send|dispatch|auto_send/i.test(name)));

const mcpUrl = "https://app.nexmeta.com.br/api/integrations/chatgpt/career/mcp";

function mcpRequest(init: RequestInit & { auth?: boolean | string } = {}) {
  const { auth, headers: initHeaders, ...rest } = init;
  const headers = new Headers(initHeaders);
  if (!headers.has("accept")) headers.set("accept", "application/json, text/event-stream");
  if (!headers.has("content-type") && rest.body) headers.set("content-type", "application/json");
  if (auth === true) headers.set("authorization", `Bearer ${SECRET}`);
  if (typeof auth === "string") headers.set("authorization", `Bearer ${auth}`);
  return new Request(mcpUrl, { ...rest, headers });
}

// Auth: sem Bearer
{
  const res = await handleChatgptCareerMcpRequest(mcpRequest({ method: "POST", body: "{}" }));
  assert.equal(res.status, 401);
  const body = (await res.json()) as { error?: string };
  assert.equal(body.error, "unauthorized");
  assert.ok(!JSON.stringify(body).toLowerCase().includes("secret"));
  assert.ok(res.headers.get("www-authenticate")?.includes("resource_metadata"));
}

// Auth: Bearer inválido
{
  const res = await handleChatgptCareerMcpRequest(
    mcpRequest({ method: "POST", auth: "wrong-token", body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} }) }),
  );
  assert.equal(res.status, 401);
}

// Auth helper alinhado
assert.equal(authenticateChatgptIntegration(mcpRequest({ method: "POST" })).status, 401);
assert.equal(
  authenticateChatgptIntegration(mcpRequest({ method: "POST", auth: true })),
  null,
);

// Initialize MCP
{
  const res = await handleChatgptCareerMcpRequest(
    mcpRequest({
      method: "POST",
      auth: true,
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: CAREER_MCP_PROTOCOL_VERSION,
          capabilities: {},
          clientInfo: { name: "nex-career-mcp-test", version: "1.0.0" },
        },
      }),
    }),
  );
  assert.equal(res.status, 200);
  assert.ok(res.headers.get("mcp-session-id"));
  const body = (await res.json()) as {
    jsonrpc: string;
    id: number;
    result: {
      protocolVersion: string;
      capabilities: { tools?: unknown };
      serverInfo: { name: string };
      instructions?: string;
    };
  };
  assert.equal(body.jsonrpc, "2.0");
  assert.equal(body.id, 1);
  assert.equal(body.result.protocolVersion, CAREER_MCP_PROTOCOL_VERSION);
  assert.equal(body.result.serverInfo.name, CAREER_MCP_SERVER_INFO.name);
  assert.ok(body.result.capabilities.tools);
  assert.ok((body.result.instructions ?? "").includes("nunca envie candidaturas"));
  assert.ok(!JSON.stringify(body).includes(SECRET));
}

// notifications/initialized → 202
{
  const res = await handleChatgptCareerMcpRequest(
    mcpRequest({
      method: "POST",
      auth: true,
      body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
    }),
  );
  assert.equal(res.status, 202);
}

const expectedTools = [
  "career_health",
  "career_companies_discover",
  "career_companies_import",
  "career_companies_list",
  "career_companies_get",
  "career_companies_enrich",
  "career_jobs_search",
  "career_jobs_list",
  "career_jobs_get",
  "career_applications_prepare",
  "career_applications_list",
  "career_history",
  "career_execution_get",
];

// tools/list
{
  const res = await handleChatgptCareerMcpRequest(
    mcpRequest({
      method: "POST",
      auth: true,
      headers: { "mcp-protocol-version": CAREER_MCP_PROTOCOL_VERSION },
      body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list" }),
    }),
  );
  assert.equal(res.status, 200);
  const body = (await res.json()) as {
    result: { tools: Array<{ name: string; inputSchema?: { type?: string } }> };
  };
  const names = body.result.tools.map((tool) => tool.name).sort();
  assert.deepEqual(names, [...expectedTools].sort());
  assert.equal(body.result.tools.length, 13);
  for (const tool of body.result.tools) {
    assert.equal(tool.inputSchema?.type, "object");
  }
}

// tools/call leitura (sem criar registros) — publishable como stand-in de service role
{
  const env = await import("node:fs").then((fs) =>
    Object.fromEntries(
      fs
        .readFileSync(".env", "utf8")
        .split(/\r?\n/)
        .filter((line) => line && !line.startsWith("#") && line.includes("="))
        .map((line) => {
          const i = line.indexOf("=");
          return [line.slice(0, i), line.slice(i + 1).replace(/^"|"$/g, "")];
        }),
    ),
  );
  process.env.SUPABASE_URL = env.SUPABASE_URL;
  process.env.SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_PUBLISHABLE_KEY;

  const healthRes = await handleChatgptCareerMcpRequest(
    mcpRequest({
      method: "POST",
      auth: true,
      headers: { "mcp-protocol-version": CAREER_MCP_PROTOCOL_VERSION },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 10,
        method: "tools/call",
        params: { name: "career_health", arguments: {} },
      }),
    }),
  );
  assert.equal(healthRes.status, 200);
  const healthBody = (await healthRes.json()) as {
    result: { isError?: boolean; structuredContent?: { ok?: boolean; companies?: number } };
  };
  assert.equal(healthBody.result.isError, false);
  assert.equal(healthBody.result.structuredContent?.ok, true);
  assert.equal(typeof healthBody.result.structuredContent?.companies, "number");

  const listRes = await handleChatgptCareerMcpRequest(
    mcpRequest({
      method: "POST",
      auth: true,
      headers: { "mcp-protocol-version": CAREER_MCP_PROTOCOL_VERSION },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 11,
        method: "tools/call",
        params: { name: "career_companies_list", arguments: { limit: 5, offset: 0 } },
      }),
    }),
  );
  assert.equal(listRes.status, 200);
  const listBody = (await listRes.json()) as {
    result: { isError?: boolean; structuredContent?: { items?: unknown[]; total?: number } };
  };
  assert.equal(listBody.result.isError, false);
  assert.ok(Array.isArray(listBody.result.structuredContent?.items));
  assert.equal(typeof listBody.result.structuredContent?.total, "number");
}

// Protocol version inválida
{
  const res = await handleChatgptCareerMcpRequest(
    mcpRequest({
      method: "POST",
      auth: true,
      headers: { "mcp-protocol-version": "1999-01-01" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 3, method: "ping" }),
    }),
  );
  assert.equal(res.status, 400);
}

console.log("chatgpt-career-mcp.test.ts: ok");
