import type { AnalysisObjectives } from "@/lib/nex-intelligence/goals/types";

export function defaultAnalysisObjectives(): AnalysisObjectives {
  return {
    selectedGoals: ["INCREASE_RESULTS"],
    primaryGoal: "INCREASE_RESULTS",
  };
}

/**
 * Padrão documentado para Análise diária sem configuração por cliente:
 * prioriza eficiência (custo por resultado) sem inventar metas numéricas.
 */
export function defaultDailyAnalysisObjectives(): AnalysisObjectives {
  return {
    selectedGoals: ["INCREASE_RESULTS", "DECREASE_COST_PER_RESULT"],
    primaryGoal: "DECREASE_COST_PER_RESULT",
  };
}
