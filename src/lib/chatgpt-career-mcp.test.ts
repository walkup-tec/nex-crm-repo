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
  const body = (await res.json()) as { result: { tools: Array<{ name: string }> } };
  const names = body.result.tools.map((tool) => tool.name);
  assert.ok(names.includes("career_health"));
  assert.ok(names.includes("career_companies_discover"));
  assert.ok(names.includes("career_applications_prepare"));
  assert.equal(names.length, careerMcpTools.length);
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
