/** Contratos de versão — NEX Intelligence v1.2.0 (fonte única). */

export const NEX_INTELLIGENCE_PROTOCOL_VERSION = "1.2.0";
export const NEX_INTELLIGENCE_ENGINE_VERSION = "1.2.0";
/** Contrato do payload Meta export — compat ChatGPT / schema 1.0.0. */
export const NEX_INTELLIGENCE_DATA_CONTRACT_VERSION = "1.0.0";
export const NEX_INTELLIGENCE_ANALYSIS_FORMAT = "nex_intelligence_analysis_v1_2_0";
export const NEX_INTELLIGENCE_TRACEABILITY_VERSION = "1.0";
export const NEX_INTELLIGENCE_SCOPE = "meta_ads_performance_v1_2";

/** Máximo de chamadas OpenAI por execução (1 inicial + 1 regen). */
export const NEX_INTELLIGENCE_MAX_AI_CALLS = 2;

/** Aliases estáveis para código legado. */
export const META_AI_PROTOCOL_VERSION = NEX_INTELLIGENCE_PROTOCOL_VERSION;
export const META_AI_ENGINE_VERSION = NEX_INTELLIGENCE_ENGINE_VERSION;
export const META_AI_DATA_CONTRACT_VERSION = NEX_INTELLIGENCE_DATA_CONTRACT_VERSION;
export const META_AI_RECOMMENDATION_ENGINE = NEX_INTELLIGENCE_ENGINE_VERSION;
export const META_AI_SCOPE = NEX_INTELLIGENCE_SCOPE;
export const METRIC_TRACEABILITY_VERSION = NEX_INTELLIGENCE_TRACEABILITY_VERSION;
export const METRIC_TRACEABILITY_ENGINE = NEX_INTELLIGENCE_ENGINE_VERSION;
