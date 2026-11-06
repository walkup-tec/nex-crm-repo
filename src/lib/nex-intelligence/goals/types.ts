/** Contrato de objetivos da análise NEX Intelligence (v1). */

export const ANALYSIS_GOAL_CONTRACT_VERSION = "1.0.0";

export const ANALYSIS_GOALS = [
  "INCREASE_RESULTS",
  "DECREASE_COST_PER_RESULT",
  "INCREASE_CTR",
  "DECREASE_CPC",
] as const;

export type AnalysisGoal = (typeof ANALYSIS_GOALS)[number];

export type GoalTargetUnit = "COUNT" | "BRL" | "PERCENT";

export type GoalTarget = {
  goal: AnalysisGoal;
  targetValue: number;
  unit: GoalTargetUnit;
};

export type AnalysisObjectives = {
  selectedGoals: AnalysisGoal[];
  primaryGoal: AnalysisGoal;
  targets?: GoalTarget[];
  resultEventKey?: string;
  /** Snapshot imutável da solicitação. */
  requestedAt?: string;
  contractVersion?: string;
};

export type GoalDirection = "INCREASE" | "DECREASE";

export type GoalDefinition = {
  code: AnalysisGoal;
  label: string;
  primaryMetric: "results" | "cost_per_result" | "ctr" | "cpc";
  direction: GoalDirection;
  relatedMetrics: Array<
    "results" | "cost_per_result" | "ctr" | "cpc" | "spend" | "impressions" | "clicks" | "cpm" | "frequency"
  >;
  defaultTargetUnit: GoalTargetUnit;
  supportedEntityLevels: Array<"campaign" | "adset" | "ad">;
};

export const ANALYSIS_GOAL_LABELS: Record<AnalysisGoal, string> = {
  INCREASE_RESULTS: "Aumentar resultados",
  DECREASE_COST_PER_RESULT: "Reduzir custo por resultado",
  INCREASE_CTR: "Aumentar CTR",
  DECREASE_CPC: "Reduzir CPC",
};

/** Legenda amigável sob o título do card (sem códigos técnicos). */
export const ANALYSIS_GOAL_HINTS: Record<AnalysisGoal, string> = {
  INCREASE_RESULTS: "Mais conversões, leads ou mensagens no período",
  DECREASE_COST_PER_RESULT: "Pagar menos por cada resultado obtido",
  INCREASE_CTR: "CTR = taxa de cliques (cliques ÷ impressões)",
  DECREASE_CPC: "CPC = custo por clique",
};
