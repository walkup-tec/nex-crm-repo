import { createHash, timingSafeEqual } from "node:crypto";

/** Nome da ferramenta para Actions / MCP / Custom GPT. */
export const CHATGPT_META_ANALYSIS_TOOL = "get_meta_analysis_execution" as const;

export const EXECUTION_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const SENSITIVE_KEY_RE =
  /access[_-]?token|client[_-]?secret|api[_-]?key|authorization|password|bearer|sk-|EAA[A-Za-z0-9]|refresh[_-]?token|private[_-]?key/i;

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
