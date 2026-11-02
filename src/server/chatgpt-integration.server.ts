import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  buildChatgptMetaAnalysisPayload,
  chatgptOpenApiDocument,
  consumeRateLimit,
  extractBearerToken,
  isExecutionUuid,
  orgAllowed,
  parseOrgAllowlist,
  secretsMatch,
  type ChatgptMetaAnalysisPayload,
} from "@/lib/chatgpt-integration";
import type { MetaAiCalibrationFeedback, MetaAiExecutionDetail, MetaAiExecutionStatus } from "@/lib/meta-ai-calibration";
import type { NexMetaAnalysisV1 } from "@/lib/meta-export";

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

function audit(event: string, fields: Record<string, unknown>) {
  console.info("chatgpt_integration_audit", JSON.stringify({ event, ...fields }));
}

function integrationSecrets() {
  const current = process.env["CHATGPT_INTEGRATION_SECRET"]?.trim() ?? "";
  const previous = process.env["CHATGPT_INTEGRATION_SECRET_PREVIOUS"]?.trim() ?? "";
  return { current, previous };
}

export function authenticateChatgptIntegration(request: Request): Response | null {
  const { current, previous } = integrationSecrets();
  if (!current) {
    return json(500, {
      error: "chatgpt_integration_unconfigured",
      message: "Defina CHATGPT_INTEGRATION_SECRET no servidor.",
    });
  }

  const header = request.headers.get("authorization");
  const apiKey = request.headers.get("x-api-key") ?? request.headers.get("apikey") ?? "";
  const bearer = extractBearerToken(header);
  const token = bearer || apiKey;
  if (!token) return json(401, { error: "unauthorized", message: "Bearer token obrigatório." });

  const ok = secretsMatch(token, current) || (previous ? secretsMatch(token, previous) : false);
  if (!ok) return json(401, { error: "unauthorized", message: "Credencial inválida." });
  return null;
}

function clientKey(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("cf-connecting-ip") || "unknown";
}

import { toMetaAiExecutionDetail } from "@/lib/nex-intelligence/persistence/map-row";

export async function getMetaAnalysisExecutionById(
  executionId: string,
): Promise<
  | { ok: true; payload: ChatgptMetaAnalysisPayload }
  | { ok: false; status: number; error: string; message: string }
> {
  if (!isExecutionUuid(executionId)) {
    return {
      ok: false,
      status: 400,
      error: "invalid_execution_id",
      message: "Informe um UUID válido da execução.",
    };
  }

  const { data, error } = await supabaseAdmin
    .from("meta_ai_executions")
    .select("*")
    .eq("id", executionId)
    .maybeSingle();

  if (error) {
    if (/meta_ai_executions|schema cache|does not exist/i.test(error.message)) {
      return {
        ok: false,
        status: 503,
        error: "migration_required",
        message: "Aplique a migração 0049_meta_ai_executions.sql no Supabase.",
      };
    }
    return { ok: false, status: 500, error: "lookup_failed", message: "Falha ao consultar a execução." };
  }
  if (!data) {
    return {
      ok: false,
      status: 404,
      error: "not_found",
      message: "Execução não encontrada.",
    };
  }

  const detail = toMetaAiExecutionDetail(data as Record<string, unknown>);
  const allowlist = parseOrgAllowlist(process.env["CHATGPT_INTEGRATION_ORG_ALLOWLIST"]);
  if (!orgAllowed(detail.organizationId, allowlist)) {
    return {
      ok: false,
      status: 403,
      error: "forbidden_organization",
      message: "Esta execução não está liberada para a integração ChatGPT.",
    };
  }

  return { ok: true, payload: buildChatgptMetaAnalysisPayload(detail) };
}

/** Adaptador da ferramenta get_meta_analysis_execution (Actions / MCP). */
export async function getMetaAnalysisExecutionTool(input: { execution_id: string }) {
  return getMetaAnalysisExecutionById(input.execution_id);
}

export async function handleChatgptAnalysisRequest(
  request: Request,
  executionIdRaw: string,
): Promise<Response> {
  const authError = authenticateChatgptIntegration(request);
  if (authError) {
    audit("auth_rejected", { path: request.url, status: authError.status });
    return authError;
  }

  const rate = consumeRateLimit(`chatgpt:${clientKey(request)}`);
  if (!rate.allowed) {
    audit("rate_limited", { path: request.url });
    return json(
      429,
      { error: "rate_limited", message: "Limite de requisições excedido. Tente novamente em breve." },
      { "retry-after": String(Math.max(1, Math.ceil((rate.resetAt - Date.now()) / 1000))) },
    );
  }

  const executionId = executionIdRaw.trim();
  const result = await getMetaAnalysisExecutionById(executionId);
  if (!result.ok) {
    audit("lookup", {
      execution_id: executionId,
      status: result.status,
      error: result.error,
    });
    return json(result.status, { error: result.error, message: result.message });
  }

  audit("lookup", {
    execution_id: executionId,
    status: 200,
    organization_id: result.payload.organization_id,
    has_input: result.payload.availability.input_json,
    has_analysis: result.payload.availability.analysis_markdown,
  });
  return json(200, result.payload);
}

export function handleChatgptOpenApiRequest(request: Request): Response {
  const authError = authenticateChatgptIntegration(request);
  if (authError) return authError;
  const appUrl = (process.env["APP_URL"]?.trim() || new URL(request.url).origin).replace(/\/$/, "");
  return json(200, chatgptOpenApiDocument(appUrl));
}
