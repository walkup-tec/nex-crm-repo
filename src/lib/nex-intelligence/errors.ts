/** Códigos de erro estáveis v1.3.0 — sem secrets no message. */

export const NexIntelligenceErrorCode = {
  // legado (aliases estáveis)
  COLLECTION_FAILED: "COLLECTION_FAILED",
  QUALITY_GATE_FAILED: "QUALITY_GATE_FAILED",
  SCHEMA_INVALID: "SCHEMA_INVALID",
  EVIDENCE_INSUFFICIENT: "EVIDENCE_INSUFFICIENT",
  REGEN_BUDGET_EXHAUSTED: "REGEN_BUDGET_EXHAUSTED",
  OPENAI_FAILED: "OPENAI_FAILED",
  PERSISTENCE_FAILED: "PERSISTENCE_FAILED",
  // §15
  META_AUTH_FAILED: "META_AUTH_FAILED",
  META_RATE_LIMITED: "META_RATE_LIMITED",
  META_COLLECTION_INCOMPLETE: "META_COLLECTION_INCOMPLETE",
  META_QUERY_FAILED: "META_QUERY_FAILED",
  DATA_COVERAGE_INCOMPLETE: "DATA_COVERAGE_INCOMPLETE",
  DATA_INTEGRITY_FAILED: "DATA_INTEGRITY_FAILED",
  METRIC_DEPENDENCY_INVALID: "METRIC_DEPENDENCY_INVALID",
  TRACE_NOT_FOUND: "TRACE_NOT_FOUND",
  TRACE_ENTITY_MISMATCH: "TRACE_ENTITY_MISMATCH",
  TRACE_PERIOD_MISMATCH: "TRACE_PERIOD_MISMATCH",
  AI_SCHEMA_INVALID: "AI_SCHEMA_INVALID",
  AI_TIMEOUT: "AI_TIMEOUT",
  UNSUPPORTED_OPERATION: "UNSUPPORTED_OPERATION",
  SEMANTIC_EVIDENCE_INSUFFICIENT: "SEMANTIC_EVIDENCE_INSUFFICIENT",
  COMPARISON_NOT_VALIDATED: "COMPARISON_NOT_VALIDATED",
  STRATEGIC_EVIDENCE_INSUFFICIENT: "STRATEGIC_EVIDENCE_INSUFFICIENT",
  RECOVERY_FAILED: "RECOVERY_FAILED",
  REGENERATION_EXHAUSTED: "REGENERATION_EXHAUSTED",
  REPORT_BUILD_FAILED: "REPORT_BUILD_FAILED",
  INSUFFICIENT_EVIDENCE: "INSUFFICIENT_EVIDENCE",
} as const;

export type NexIntelligenceErrorCode =
  (typeof NexIntelligenceErrorCode)[keyof typeof NexIntelligenceErrorCode];

export type ErrorSeverity = "info" | "warning" | "error" | "fatal";
export type ErrorStage =
  | "A_COLLECTION"
  | "B_INTEGRITY"
  | "C_METRICS"
  | "D_AI"
  | "E_VALIDATE"
  | "F_RECOVERY"
  | "G_REVALIDATE"
  | "H_REPORT"
  | "I_PERSIST"
  | "J_CHATGPT";

export type ErrorImpact = {
  blocks_publication: boolean;
  invalidates_all_metrics: boolean;
  retryable: boolean;
};

const DEFAULT_IMPACT: Record<string, ErrorImpact> = {
  META_AUTH_FAILED: { blocks_publication: true, invalidates_all_metrics: true, retryable: false },
  META_RATE_LIMITED: { blocks_publication: true, invalidates_all_metrics: false, retryable: true },
  META_COLLECTION_INCOMPLETE: {
    blocks_publication: false,
    invalidates_all_metrics: false,
    retryable: true,
  },
  META_QUERY_FAILED: { blocks_publication: true, invalidates_all_metrics: false, retryable: true },
  AI_TIMEOUT: { blocks_publication: false, invalidates_all_metrics: false, retryable: true },
  AI_SCHEMA_INVALID: { blocks_publication: false, invalidates_all_metrics: false, retryable: false },
  UNSUPPORTED_OPERATION: {
    blocks_publication: false,
    invalidates_all_metrics: false,
    retryable: false,
  },
  PERSISTENCE_FAILED: { blocks_publication: true, invalidates_all_metrics: false, retryable: true },
  INSUFFICIENT_EVIDENCE: {
    blocks_publication: false,
    invalidates_all_metrics: false,
    retryable: false,
  },
};

export class NexIntelligenceError extends Error {
  readonly code: NexIntelligenceErrorCode;
  readonly safeMessage: string;
  readonly stage?: ErrorStage;
  readonly severity: ErrorSeverity;
  readonly impact: ErrorImpact;

  constructor(
    code: NexIntelligenceErrorCode,
    safeMessage: string,
    opts?: { stage?: ErrorStage; severity?: ErrorSeverity; impact?: Partial<ErrorImpact> },
  ) {
    super(`[${code}] ${safeMessage}`);
    this.name = "NexIntelligenceError";
    this.code = code;
    this.safeMessage = safeMessage;
    this.stage = opts?.stage;
    this.severity = opts?.severity ?? "error";
    this.impact = {
      ...(DEFAULT_IMPACT[code] ?? {
        blocks_publication: false,
        invalidates_all_metrics: false,
        retryable: false,
      }),
      ...opts?.impact,
    };
  }
}

export function nexIntelligenceError(
  code: NexIntelligenceErrorCode,
  safeMessage: string,
  opts?: { stage?: ErrorStage; severity?: ErrorSeverity; impact?: Partial<ErrorImpact> },
) {
  return new NexIntelligenceError(code, safeMessage, opts);
}
