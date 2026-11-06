import { getGoalDefinition } from "@/lib/nex-intelligence/goals/definitions";
import type { AnalysisGoal, AnalysisObjectives, GoalDefinition } from "@/lib/nex-intelligence/goals/types";

export type ComposedGoalAnalysis = {
  objectives: AnalysisObjectives;
  definitions: GoalDefinition[];
  primary: GoalDefinition;
  /** União deduplicada de métricas necessárias. */
  requiredMetrics: string[];
  /** Pares de objetivos para investigação de relações (sem matriz fixa). */
  goalPairs: Array<[AnalysisGoal, AnalysisGoal]>;
};

/** Compõe dinamicamente o plano analítico a partir dos objetivos selecionados. */
export function composeGoalAnalysis(objectives: AnalysisObjectives): ComposedGoalAnalysis {
  const definitions = objectives.selectedGoals.map((code) => getGoalDefinition(code));
  const primary = getGoalDefinition(objectives.primaryGoal);
  const metricSet = new Set<string>();
  for (const def of definitions) {
    metricSet.add(def.primaryMetric);
    for (const metric of def.relatedMetrics) metricSet.add(metric);
  }
  const goalPairs: Array<[AnalysisGoal, AnalysisGoal]> = [];
  for (let i = 0; i < objectives.selectedGoals.length; i += 1) {
    for (let j = i + 1; j < objectives.selectedGoals.length; j += 1) {
      goalPairs.push([objectives.selectedGoals[i]!, objectives.selectedGoals[j]!]);
    }
  }
  return {
    objectives,
    definitions,
    primary,
    requiredMetrics: [...metricSet],
    goalPairs,
  };
}
