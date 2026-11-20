/**
 * MCP Streamable HTTP para NEX Career Intelligence.
 * Reutiliza os mesmos serviços de career.server (auth Bearer + dedupe + idempotência).
 * Não altera o contrato REST em /api/integrations/chatgpt/career/*.
 */
import { randomUUID } from "node:crypto";
import { consumeRateLimit, extractBearerToken } from "@/lib/chatgpt-integration";
import {
  CAREER_MCP_INSTRUCTIONS,
  CAREER_MCP_PROTOCOL_VERSION,
  CAREER_MCP_SERVER_INFO,
  CAREER_MCP_SUPPORTED_PROTOCOL_VERSIONS,
  careerMcpTools,
  findCareerMcpTool,
} from "@/lib/chatgpt-career-mcp";
import {
  careerAppOrigin,
  isChatgptIntegrationBearer,
  verifyCareerMcpAccessToken,
} from "@/server/chatgpt-career-oauth.server";
import {
  enrichCareerContacts,
  pluginGetCompany,
  pluginGetExecution,
  pluginGetJob,
  pluginListApplications,
  pluginListCompanies,
  pluginListHistory,
  pluginListJobs,
  prepareCareerApplication,
  upsertCareerCompanies,
  upsertCareerJobs,
} from "@/server/career.server";

type JsonRpcId = string | number | null;
type JsonRpcMessage = {
  jsonrpc?: string;
  id?: JsonRpcId;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: unknown;
};

function jsonResponse(status: number, body: unknown, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...extraHeaders,
    },
  });
}

function rpcResult(id: JsonRpcId, result: unknown) {
  return { jsonrpc: "2.0", id, result };
}

function rpcError(id: JsonRpcId, code: number, message: string, data?: unknown) {
  return {
    jsonrpc: "2.0",
    id,
    error: data === undefined ? { code, message } : { code, message, data },
  };
}

function clientKey(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("cf-connecting-ip") || "unknown";
}

function audit(event: string, fields: Record<string, unknown>) {
  console.info("chatgpt_career_mcp_audit", JSON.stringify({ event, ...fields }));
}

function isNotification(message: JsonRpcMessage) {
  return typeof message.method === "string" && !("id" in message);
}

function isResponseMessage(message: JsonRpcMessage) {
  return message.id !== undefined && (message.result !== undefined || message.error !== undefined) && !message.method;
}

function negotiateProtocolVersion(requested: unknown) {
  const version = typeof requested === "string" ? requested.trim() : "";
  if (version && (CAREER_MCP_SUPPORTED_PROTOCOL_VERSIONS as readonly string[]).includes(version)) {
    return version;
  }
  return CAREER_MCP_PROTOCOL_VERSION;
}

function validateOrigin(request: Request): Response | null {
  const origin = request.headers.get("origin");
  if (!origin) return null;
  const appUrl = (process.env["APP_URL"]?.trim() || "").replace(/\/$/, "");
  const allowed = new Set<string>();
  if (appUrl) {
    try {
      allowed.add(new URL(appUrl).origin);
    } catch {
      /* ignore invalid APP_URL */
    }
  }
  try {
    allowed.add(new URL(request.url).origin);
  } catch {
    /* ignore */
  }
  allowed.add("https://app.nexmeta.com.br");
  allowed.add("https://chatgpt.com");
  allowed.add("https://chat.openai.com");
  if (!allowed.has(origin)) {
    audit("origin_rejected", { origin });
    return jsonResponse(403, { error: "forbidden_origin", message: "Origin não permitida para o MCP Career." });
  }
  return null;
}

function textToolResult(payload: unknown, isError = false) {
  return {
    content: [
      {
        type: "text",
        text: typeof payload === "string" ? payload : JSON.stringify(payload, null, 2),
      },
    ],
    structuredContent: typeof payload === "object" && payload !== null ? payload : { value: payload },
    isError,
  };
}

async function invokeCareerTool(name: string, rawArgs: unknown) {
  const args = rawArgs && typeof rawArgs === "object" && !Array.isArray(rawArgs) ? (rawArgs as Record<string, unknown>) : {};

  switch (name) {
    case "career_health": {
      const [companies, jobs, history] = await Promise.all([
        pluginListCompanies({ limit: 1, offset: 0 }),
        pluginListJobs({ limit: 1, offset: 0 }),
        pluginListHistory(),
      ]);
      return {
        ok: true,
        companies: companies.total,
        jobs: jobs.total,
        executions: history.items.length,
      };
    }
    case "career_companies_discover": {
      const companies = Array.isArray(args.companies) ? args.companies : [];
      const result = await upsertCareerCompanies({
        companies: companies as never[],
        actorSource: "plugin",
        idempotencyKey: typeof args.idempotency_key === "string" ? args.idempotency_key : null,
        kind: "companies_discover",
      });
      return {
        execution_id: result.executionId,
        replay: result.replay,
        ...result.counts,
      };
    }
    case "career_companies_import": {
      const companies = Array.isArray(args.companies) ? args.companies : [];
      const result = await upsertCareerCompanies({
        companies: companies as never[],
        actorSource: "plugin",
        idempotencyKey: typeof args.idempotency_key === "string" ? args.idempotency_key : null,
        kind: "import",
      });
      return {
        execution_id: result.executionId,
        replay: result.replay,
        ...result.counts,
      };
    }
    case "career_companies_list":
      return pluginListCompanies({
        q: typeof args.q === "string" ? args.q : undefined,
        limit: typeof args.limit === "number" ? args.limit : 50,
        offset: typeof args.offset === "number" ? args.offset : 0,
      });
    case "career_companies_get": {
      const id = typeof args.id === "string" ? args.id : "";
      if (!id) throw new Error("Informe id.");
      return pluginGetCompany(id);
    }
    case "career_companies_enrich": {
      const contacts = Array.isArray(args.contacts) ? args.contacts : [];
      const result = await enrichCareerContacts({
        contacts: contacts as never[],
        actorSource: "plugin",
        idempotencyKey: typeof args.idempotency_key === "string" ? args.idempotency_key : null,
      });
      return {
        execution_id: result.executionId,
        replay: result.replay,
        ...result.counts,
        error_samples: "errorSamples" in result ? result.errorSamples : [],
      };
    }
    case "career_jobs_search": {
      const jobs = Array.isArray(args.jobs) ? args.jobs : [];
      const result = await upsertCareerJobs({
        jobs: jobs as never[],
        actorSource: "plugin",
        idempotencyKey: typeof args.idempotency_key === "string" ? args.idempotency_key : null,
      });
      return {
        execution_id: result.executionId,
        replay: result.replay,
        ...result.counts,
        error_samples: "errorSamples" in result ? result.errorSamples : [],
      };
    }
    case "career_jobs_list":
      return pluginListJobs({
        q: typeof args.q === "string" ? args.q : undefined,
        limit: typeof args.limit === "number" ? args.limit : 50,
        offset: typeof args.offset === "number" ? args.offset : 0,
      });
    case "career_jobs_get": {
      const id = typeof args.id === "string" ? args.id : "";
      if (!id) throw new Error("Informe id.");
      return pluginGetJob(id);
    }
    case "career_applications_prepare": {
      const jobId =
        (typeof args.jobId === "string" && args.jobId) || (typeof args.job_id === "string" && args.job_id) || "";
      if (!jobId) throw new Error("Informe jobId.");
      const result = await prepareCareerApplication({
        jobId,
        compatibilityAnalysis: typeof args.compatibilityAnalysis === "string" ? args.compatibilityAnalysis : undefined,
        recommendedResume: typeof args.recommendedResume === "string" ? args.recommendedResume : undefined,
        introMessage: typeof args.introMessage === "string" ? args.introMessage : undefined,
        emailBody: typeof args.emailBody === "string" ? args.emailBody : undefined,
        linkedinMessage: typeof args.linkedinMessage === "string" ? args.linkedinMessage : undefined,
        whatsappMessage: typeof args.whatsappMessage === "string" ? args.whatsappMessage : undefined,
        guidance: typeof args.guidance === "string" ? args.guidance : undefined,
        actorSource: "plugin",
        idempotencyKey: typeof args.idempotency_key === "string" ? args.idempotency_key : null,
      });
      return {
        execution_id: result.executionId,
        application_id: result.applicationId,
        replay: result.replay,
        ...result.counts,
        note: "Candidatura preparada apenas. Envio automático não é permitido pela API NEX.",
      };
    }
    case "career_applications_list":
      return pluginListApplications();
    case "career_history":
      return pluginListHistory();
    case "career_execution_get": {
      const id = typeof args.id === "string" ? args.id : "";
      if (!id) throw new Error("Informe id.");
      return pluginGetExecution(id);
    }
    default:
      throw new Error(`Ferramenta desconhecida: ${name}`);
  }
}

async function handleJsonRpcRequest(message: JsonRpcMessage): Promise<{ body: unknown; sessionId?: string }> {
  const id = message.id ?? null;
  const method = message.method ?? "";
  const params = message.params && typeof message.params === "object" ? (message.params as Record<string, unknown>) : {};

  if (method === "initialize") {
    const protocolVersion = negotiateProtocolVersion(params.protocolVersion);
    const sessionId = randomUUID();
    audit("initialize", { protocolVersion, client: params.clientInfo ?? null });
    return {
      sessionId,
      body: rpcResult(id, {
        protocolVersion,
        capabilities: {
          tools: { listChanged: false },
        },
        serverInfo: CAREER_MCP_SERVER_INFO,
        instructions: CAREER_MCP_INSTRUCTIONS,
      }),
    };
  }

  if (method === "ping") {
    return { body: rpcResult(id, {}) };
  }

  if (method === "tools/list") {
    return {
      body: rpcResult(id, {
        tools: careerMcpTools.map((tool) => ({
          name: tool.name,
          title: tool.title,
          description: tool.description,
          inputSchema: tool.inputSchema,
          annotations: tool.annotations,
        })),
      }),
    };
  }

  if (method === "tools/call") {
    const name = typeof params.name === "string" ? params.name.trim() : "";
    if (!name || !findCareerMcpTool(name)) {
      return { body: rpcResult(id, textToolResult({ error: "unknown_tool", message: `Ferramenta desconhecida: ${name}` }, true)) };
    }
    // Bloqueio explícito: nenhuma tool de envio automático.
    if (/send|dispatch|submit_application|auto_send/i.test(name)) {
      return {
        body: rpcResult(
          id,
          textToolResult(
            { error: "forbidden", message: "Envio automático de candidaturas não é permitido." },
            true,
          ),
        ),
      };
    }
    try {
      const result = await invokeCareerTool(name, params.arguments);
      audit("tools_call", { name, ok: true });
      return { body: rpcResult(id, textToolResult(result, false)) };
    } catch (error) {
      const messageText = error instanceof Error ? error.message : "Falha ao executar ferramenta.";
      audit("tools_call", { name, ok: false, message: messageText });
      const isNotFound = /não encontrada|nao encontrada/i.test(messageText);
      return {
        body: rpcResult(
          id,
          textToolResult(
            {
              error: isNotFound ? "not_found" : /migração|migration/i.test(messageText) ? "migration_required" : "tool_error",
              message: messageText,
            },
            true,
          ),
        ),
      };
    }
  }

  if (method.startsWith("notifications/")) {
    return { body: null };
  }

  return { body: rpcError(id, -32601, `Método não suportado: ${method}`) };
}

function mcpUnauthorized(message: string) {
  return jsonResponse(401, { error: "unauthorized", message });
}

function withMcpAuthChallenge(response: Response, request: Request) {
  if (response.status !== 401) return response;
  const origin = careerAppOrigin(request);
  const resourceMetadata = `${origin}/.well-known/oauth-protected-resource`;
  const headers = new Headers(response.headers);
  headers.set(
    "www-authenticate",
    `Bearer realm="nex-career-mcp", resource_metadata="${resourceMetadata}"`,
  );
  return new Response(response.body, { status: response.status, headers });
}

/**
 * Dual auth:
 * - Bearer CHATGPT_INTEGRATION_SECRET → REST / MCP direto (Actions, clientes MCP locais)
 * - JWT OAuth (authorization_code + PKCE) → ChatGPT Web
 */
async function authenticateCareerMcp(request: Request): Promise<Response | null> {
  const header = request.headers.get("authorization");
  const apiKey = request.headers.get("x-api-key") ?? request.headers.get("apikey") ?? "";
  const token = extractBearerToken(header) || apiKey;
  if (!token) return mcpUnauthorized("Bearer token obrigatório.");

  if (isChatgptIntegrationBearer(token)) return null;

  const oauth = await verifyCareerMcpAccessToken(token, request);
  if (oauth.ok) {
    audit("oauth_accepted", { email: oauth.claims.email, sub: oauth.claims.sub, aud: oauth.claims.aud });
    return null;
  }

  const integrationConfigured = Boolean(process.env["CHATGPT_INTEGRATION_SECRET"]?.trim());
  if (!integrationConfigured && !process.env["CAREER_MCP_OAUTH_SIGNING_SECRET"]?.trim()) {
    return jsonResponse(500, {
      error: "chatgpt_integration_unconfigured",
      message: "Defina CHATGPT_INTEGRATION_SECRET e/ou CAREER_MCP_OAUTH_SIGNING_SECRET no servidor.",
    });
  }

  return mcpUnauthorized(oauth.message || "Credencial inválida.");
}

export async function handleChatgptCareerMcpRequest(request: Request): Promise<Response> {
  const authError = await authenticateCareerMcp(request);
  if (authError) {
    audit("auth_rejected", { path: request.url, status: authError.status, method: request.method });
    return withMcpAuthChallenge(authError, request);
  }

  const originError = validateOrigin(request);
  if (originError) return originError;

  const rate = consumeRateLimit(`chatgpt-career-mcp:${clientKey(request)}`);
  if (!rate.allowed) {
    return jsonResponse(
      429,
      { error: "rate_limited", message: "Limite de requisições excedido." },
      { "retry-after": String(Math.max(1, Math.ceil((rate.resetAt - Date.now()) / 1000))) },
    );
  }

  const method = request.method.toUpperCase();
  const protocolHeader = request.headers.get("mcp-protocol-version")?.trim();
  if (
    protocolHeader &&
    !(CAREER_MCP_SUPPORTED_PROTOCOL_VERSIONS as readonly string[]).includes(protocolHeader) &&
    method !== "DELETE"
  ) {
    return jsonResponse(400, {
      error: "unsupported_protocol_version",
      message: `MCP-Protocol-Version não suportada: ${protocolHeader}`,
      supported: CAREER_MCP_SUPPORTED_PROTOCOL_VERSIONS,
    });
  }

  if (method === "DELETE") {
    // Sessões são opcionais/stateless neste servidor.
    return new Response(null, { status: 405, headers: { allow: "GET, POST", "cache-control": "no-store" } });
  }

  if (method === "GET") {
    const accept = request.headers.get("accept") ?? "";
    if (!accept.includes("text/event-stream")) {
      return new Response(null, {
        status: 405,
        headers: { allow: "GET, POST", "cache-control": "no-store" },
      });
    }
    // Stream SSE ocioso (servidor não emite mensagens proativas).
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(": nex-career-mcp\n\n"));
        controller.close();
      },
    });
    return new Response(stream, {
      status: 200,
      headers: {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-store",
        connection: "keep-alive",
      },
    });
  }

  if (method !== "POST") {
    return new Response(null, { status: 405, headers: { allow: "GET, POST" } });
  }

  let message: JsonRpcMessage;
  try {
    message = (await request.json()) as JsonRpcMessage;
  } catch {
    return jsonResponse(400, rpcError(null, -32700, "JSON inválido."));
  }

  if (!message || typeof message !== "object" || Array.isArray(message)) {
    return jsonResponse(400, rpcError(null, -32600, "Esperado um único objeto JSON-RPC (não batch)."));
  }

  if (message.jsonrpc !== "2.0") {
    return jsonResponse(400, rpcError(message.id ?? null, -32600, "jsonrpc deve ser \"2.0\"."));
  }

  if (isResponseMessage(message) || isNotification(message)) {
    if (message.method === "notifications/initialized") {
      audit("initialized", {});
    }
    return new Response(null, { status: 202, headers: { "cache-control": "no-store" } });
  }

  if (!message.method) {
    return jsonResponse(400, rpcError(message.id ?? null, -32600, "method obrigatório."));
  }

  const handled = await handleJsonRpcRequest(message);
  if (handled.body === null) {
    return new Response(null, { status: 202, headers: { "cache-control": "no-store" } });
  }

  const headers: Record<string, string> = {};
  if (handled.sessionId) {
    headers["mcp-session-id"] = handled.sessionId;
  }
  if (message.method === "initialize") {
    const result = (handled.body as { result?: { protocolVersion?: string } }).result;
    if (result?.protocolVersion) headers["mcp-protocol-version"] = result.protocolVersion;
  }

  return jsonResponse(200, handled.body, headers);
}
