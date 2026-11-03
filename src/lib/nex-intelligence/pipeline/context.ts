import {
  NEX_INTELLIGENCE_ANALYSIS_FORMAT,
  NEX_INTELLIGENCE_CLAIM_IR_VERSION,
  NEX_INTELLIGENCE_DATA_CONTRACT_VERSION,
  NEX_INTELLIGENCE_ENGINE_VERSION,
  NEX_INTELLIGENCE_MAX_AI_CALLS,
  NEX_INTELLIGENCE_PROTOCOL_VERSION,
} from "@/lib/nex-intelligence/versions";

/**
 * Ordem vinculante A→J (v1.3.0):
 *
 * A Coleta → B Integridade → C Métricas/Registry/Traces
 * → D IA propõe Claim IR → E Validação IR → F Recuperação estrutural
 * → G Revalidação → H Relatório (renderizadores) → I Persistência atômica
 * → J ChatGPT RO (somente publication_status=published)
 *
 * CMS/recovery determinística SEMPRE antes de qualquer 2ª chamada OpenAI.
 * Orçamento: no máximo 2 chamadas OpenAI por execução.
 */
export const PIPELINE_STAGE_ORDER = [
  "A_COLLECTION",
  "B_INTEGRITY",
  "C_METRICS_TRACES",
  "D_AI_PROPOSALS",
  "E_VALIDATE_IR",
  "F_STRUCTURAL_RECOVERY",
  "G_REVALIDATE_IR",
  "H_RENDER_REPORT",
  "I_PERSIST_ATOMIC",
  "J_CHATGPT_READONLY",
] as const;

export type PipelineStage = (typeof PIPELINE_STAGE_ORDER)[number];

export type MetaAnalysisPipelineContext = {
  protocolVersion: string;
  engineVersion: string;
  dataContractVersion: string;
  analysisFormat: string;
  claimIrVersion: string;
  promptHash: string;
  aiCallBudget: number;
  aiCallsUsed: number;
};

export function createPipelineContext(input: {
  promptHash: string;
  aiCallsUsed?: number;
}): MetaAnalysisPipelineContext {
  return {
    protocolVersion: NEX_INTELLIGENCE_PROTOCOL_VERSION,
    engineVersion: NEX_INTELLIGENCE_ENGINE_VERSION,
    dataContractVersion: NEX_INTELLIGENCE_DATA_CONTRACT_VERSION,
    analysisFormat: NEX_INTELLIGENCE_ANALYSIS_FORMAT,
    claimIrVersion: NEX_INTELLIGENCE_CLAIM_IR_VERSION,
    promptHash: input.promptHash,
    aiCallBudget: NEX_INTELLIGENCE_MAX_AI_CALLS,
    aiCallsUsed: input.aiCallsUsed ?? 0,
  };
}

export function canCallOpenAi(ctx: MetaAnalysisPipelineContext): boolean {
  return ctx.aiCallsUsed < ctx.aiCallBudget;
}

export function recordOpenAiCall(ctx: MetaAnalysisPipelineContext): MetaAnalysisPipelineContext {
  if (!canCallOpenAi(ctx)) {
    throw new Error("ai_call_budget_exhausted");
  }
  return { ...ctx, aiCallsUsed: ctx.aiCallsUsed + 1 };
}
