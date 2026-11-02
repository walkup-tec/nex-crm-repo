import {
  NEX_INTELLIGENCE_ANALYSIS_FORMAT,
  NEX_INTELLIGENCE_DATA_CONTRACT_VERSION,
  NEX_INTELLIGENCE_ENGINE_VERSION,
  NEX_INTELLIGENCE_MAX_AI_CALLS,
  NEX_INTELLIGENCE_PROTOCOL_VERSION,
} from "@/lib/nex-intelligence/versions";

/**
 * Ordem vinculante A→F (v1.2.0):
 *
 * A Coleta → B Integridade → C Métricas/Traces (fonte de verdade)
 * → OpenAI#1 → D Auditoria (claims IA, só traces C)
 * → Recuperação_CMS determinística (SEM OpenAI)
 * → D re-auditoria (itens recuperados + restantes, só traces C)
 * → [opcional] OpenAI#2 somente se ainda houver falha estrutural/conteúdo
 *    e aiCallsUsed < MAX_AI_CALLS → D → E Publicação → Persistência
 * → ChatGPT leitura somente (evidências persistidas)
 *
 * Regra: CMS/recovery determinística SEMPRE antes de qualquer 2ª chamada OpenAI.
 * Orçamento: no máximo 2 chamadas OpenAI por execução.
 */
export const PIPELINE_STAGE_ORDER = [
  "A_COLLECTION",
  "B_INTEGRITY",
  "C_METRICS_TRACES",
  "AI_CALL_1",
  "D_AUDIT_AI",
  "CMS_RECOVERY",
  "D_AUDIT_RECOVERED",
  "AI_CALL_2_OPTIONAL",
  "D_AUDIT_POST_REGEN",
  "E_PUBLICATION",
  "F_PERSISTENCE",
] as const;

export type PipelineStage = (typeof PIPELINE_STAGE_ORDER)[number];

export type MetaAnalysisPipelineContext = {
  protocolVersion: string;
  engineVersion: string;
  dataContractVersion: string;
  analysisFormat: string;
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
