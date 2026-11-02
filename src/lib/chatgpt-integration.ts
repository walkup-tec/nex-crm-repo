import { createHash, timingSafeEqual } from "node:crypto";
import {
  META_AI_ANALYSIS_PROMPT,
  META_AI_DATA_CONTRACT_VERSION,
  META_AI_PROTOCOL_VERSION,
} from "@/intelligence/meta-leads/protocol";
import type { MetaAiExecutionDetail } from "@/lib/meta-ai-calibration";
import { metaAiUserPrompt } from "@/lib/meta-ai-prompt";
import type { NexMetaAnalysisV1 } from "@/lib/meta-export";

/** Nome da ferramenta para Actions / MCP / Custom GPT. */
export const CHATGPT_META_ANALYSIS_TOOL = "get_meta_analysis_execution" as const;

export const EXECUTION_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const SENSITIVE_KEY_RE =
  /access[_-]?token|client[_-]?secret|api[_-]?key|authorization|password|bearer|sk-|EAA[A-Za-z0-9]|refresh[_-]?token|private[_-]?key/i;

export type ChatgptMetaAnalysisPayload = {
  tool: typeof CHATGPT_META_ANALYSIS_TOOL;
  execution_id: string;
  created_at: string;
  status: string;
  organization_id: string;
  client_name: string;
  account: { id: string; name: string };
  period: { since: string | null; until: string | null; timezone: string };
  metadata: Record<string, unknown>;
  attribution: { setting: string | null; note: string } | null;
  campaigns: unknown[];
  adsets: unknown[];
  ads: unknown[];
  business_outcomes: Record<string, unknown> | null;
  ai_analysis: {
    markdown: string | null;
    model: string;
    output: Record<string, unknown>;
  };
  analysis_prompt: {
    system: string;
    user: string | null;
    prompt_hash: string;
    protocol_version: string;
    data_contract_version: string;
  };
  protocol_version: string;
  data_contract_version: string;
  warnings: string[];
  error_message: string | null;
  availability: {
    input_json: boolean;
    analysis_markdown: boolean;
    output_json: boolean;
  };
};

export function isExecutionUuid(value: string) {
  return EXECUTION_ID_RE.test(value.trim());
}

export function digestSecret(value: string) {
  return createHash("sha256").update(value, "utf8").digest();
}

export function secretsMatch(provided: string, expected: string) {
  if (!provided || !expected) return false;
  const left = digestSecret(provided);
  const right = digestSecret(expected);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function extractBearerToken(authorization: string | null) {
  const match = /^Bearer\s+([^\s,]+)$/i.exec(authorization ?? "");
  return match?.[1] ?? "";
}

export function parseOrgAllowlist(raw: string | undefined) {
  return (raw ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function orgAllowed(organizationId: string, allowlist: string[]) {
  if (!allowlist.length) return true;
  return allowlist.includes(organizationId);
}

/** Remove chaves sensíveis de objetos aninhados sem alterar métricas. */
export function scrubSensitive<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => scrubSensitive(item)) as T;
  }
  if (!value || typeof value !== "object") return value;
  const out: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (SENSITIVE_KEY_RE.test(key)) continue;
    if (typeof entry === "string" && /^(EAA[A-Za-z0-9]+|sk-[A-Za-z0-9]+)/.test(entry)) continue;
    out[key] = scrubSensitive(entry);
  }
  return out as T;
}

function asInput(detail: MetaAiExecutionDetail): NexMetaAnalysisV1 | null {
  const raw = detail.inputJson;
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Partial<NexMetaAnalysisV1>;
  if (!row.account || !Array.isArray(row.campaigns)) return null;
  return scrubSensitive(raw as NexMetaAnalysisV1);
}

export function buildChatgptMetaAnalysisPayload(
  detail: MetaAiExecutionDetail,
): ChatgptMetaAnalysisPayload {
  const input = asInput(detail);
  const hasAnalysis = Boolean(detail.analysisMarkdown?.trim());
  const output =
    detail.outputJson && typeof detail.outputJson === "object"
      ? scrubSensitive(detail.outputJson)
      : {};

  return {
    tool: CHATGPT_META_ANALYSIS_TOOL,
    execution_id: detail.id,
    created_at: detail.createdAt,
    status: detail.status,
    organization_id: detail.organizationId,
    client_name: detail.clientName || input?.metadata.client_name || "",
    account: {
      id: detail.accountId || input?.account.id || "",
      name: detail.accountName || input?.account.name || "",
    },
    period: {
      since: detail.periodSince ?? input?.period.since ?? null,
      until: detail.periodUntil ?? input?.period.until ?? null,
      timezone: detail.periodTimezone || input?.period.timezone || "America/Sao_Paulo",
    },
    metadata: scrubSensitive({
      source: input?.metadata.source ?? "NEX",
      exported_at: input?.metadata.exported_at ?? null,
      currency: input?.metadata.currency ?? null,
      data_status: input?.metadata.data_status ?? null,
      organization_id: detail.organizationId,
      client_name: detail.clientName || input?.metadata.client_name || "",
      model: detail.model,
      prompt_hash: detail.promptHash,
      schema_version: input?.schema_version ?? null,
    }),
    attribution: input?.attribution
      ? scrubSensitive(input.attribution)
      : { setting: null, note: "Atribuição não persistida nesta execução." },
    campaigns: input?.campaigns ?? [],
    adsets: input?.adsets ?? [],
    ads: input?.ads ?? [],
    business_outcomes: input?.business_outcomes
      ? scrubSensitive(input.business_outcomes)
      : null,
    ai_analysis: {
      markdown: hasAnalysis ? detail.analysisMarkdown : null,
      model: detail.model,
      output,
    },
    analysis_prompt: {
      system: META_AI_ANALYSIS_PROMPT,
      user: input ? metaAiUserPrompt(input) : null,
      prompt_hash: detail.promptHash,
      protocol_version: detail.protocolVersion || META_AI_PROTOCOL_VERSION,
      data_contract_version: detail.dataContractVersion || META_AI_DATA_CONTRACT_VERSION,
    },
    protocol_version: detail.protocolVersion || META_AI_PROTOCOL_VERSION,
    data_contract_version: detail.dataContractVersion || META_AI_DATA_CONTRACT_VERSION,
    warnings: detail.warnings ?? [],
    error_message: detail.errorMessage?.trim() ? detail.errorMessage : null,
    availability: {
      input_json: Boolean(input),
      analysis_markdown: hasAnalysis,
      output_json: Object.keys(output).length > 0,
    },
  };
}

export function chatgptOpenApiDocument(serverUrl: string) {
  const base = serverUrl.replace(/\/$/, "");
  return {
    openapi: "3.1.0",
    info: {
      title: "NEX Intelligence — ChatGPT Integration",
      version: "1.0.0",
      description:
        "Consulta autenticada de execuções Meta Ads do Laboratório de Calibração NEX. Ferramenta: get_meta_analysis_execution.",
    },
    servers: [{ url: base }],
    paths: {
      "/api/integrations/chatgpt/analyses/{executionId}": {
        get: {
          operationId: CHATGPT_META_ANALYSIS_TOOL,
          summary: "Recuperar execução de análise Meta Ads pelo UUID",
          description:
            "Retorna input original, análise do NEX, prompt e metadados da execução. Requer Bearer token.",
          parameters: [
            {
              name: "executionId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
              description: "UUID da execução (meta_ai_executions.id)",
            },
          ],
          responses: {
            "200": {
              description: "Execução encontrada",
              content: {
                "application/json": {
                  schema: { type: "object", additionalProperties: true },
                },
              },
            },
            "401": { description: "Não autenticado" },
            "403": { description: "Organização não autorizada" },
            "404": { description: "Execução não encontrada" },
            "429": { description: "Limite de requisições" },
          },
          security: [{ bearerAuth: [] }],
        },
      },
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          description: "CHATGPT_INTEGRATION_SECRET configurado no EasyPanel",
        },
      },
    },
  };
}

type RateBucket = { count: number; resetAt: number };

const rateBuckets = new Map<string, RateBucket>();

export function consumeRateLimit(
  key: string,
  limit = 60,
  windowMs = 60_000,
  now = Date.now(),
) {
  const current = rateBuckets.get(key);
  if (!current || now >= current.resetAt) {
    rateBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, resetAt: now + windowMs };
  }
  if (current.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: current.resetAt };
  }
  current.count += 1;
  return { allowed: true, remaining: limit - current.count, resetAt: current.resetAt };
}

/** Expõe o contrato da ferramenta para adaptadores MCP futuros. */
export const getMetaAnalysisExecutionToolDefinition = {
  name: CHATGPT_META_ANALYSIS_TOOL,
  description:
    "Consulta no NEX uma execução de análise Meta Ads pelo UUID e devolve o pacote completo para calibração.",
  parameters: {
    type: "object",
    additionalProperties: false,
    required: ["execution_id"],
    properties: {
      execution_id: {
        type: "string",
        format: "uuid",
        description: "ID da execução gerado pelo Laboratório de Calibração NEX",
      },
    },
  },
} as const;
