/** Códigos de erro estáveis — sem secrets no message. */

export const NexIntelligenceErrorCode = {
  COLLECTION_FAILED: "COLLECTION_FAILED",
  QUALITY_GATE_FAILED: "QUALITY_GATE_FAILED",
  SCHEMA_INVALID: "SCHEMA_INVALID",
  EVIDENCE_INSUFFICIENT: "EVIDENCE_INSUFFICIENT",
  REGEN_BUDGET_EXHAUSTED: "REGEN_BUDGET_EXHAUSTED",
  OPENAI_FAILED: "OPENAI_FAILED",
  PERSISTENCE_FAILED: "PERSISTENCE_FAILED",
} as const;

export type NexIntelligenceErrorCode =
  (typeof NexIntelligenceErrorCode)[keyof typeof NexIntelligenceErrorCode];

export class NexIntelligenceError extends Error {
  readonly code: NexIntelligenceErrorCode;
  readonly safeMessage: string;

  constructor(code: NexIntelligenceErrorCode, safeMessage: string) {
    super(`[${code}] ${safeMessage}`);
    this.name = "NexIntelligenceError";
    this.code = code;
    this.safeMessage = safeMessage;
  }
}

export function nexIntelligenceError(code: NexIntelligenceErrorCode, safeMessage: string) {
  return new NexIntelligenceError(code, safeMessage);
}
