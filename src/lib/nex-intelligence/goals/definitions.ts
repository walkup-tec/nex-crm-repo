import type { AnalysisGoal, GoalDefinition } from "@/lib/nex-intelligence/goals/types";
import { ANALYSIS_GOAL_LABELS } from "@/lib/nex-intelligence/goals/types";

/** Registro central — composição dinâmica, sem matriz fixa de combinações. */
export const GOAL_DEFINITIONS: Record<AnalysisGoal, GoalDefinition> = {
  INCREASE_RESULTS: {
    code: "INCREASE_RESULTS",
    label: ANALYSIS_GOAL_LABELS.INCREASE_RESULTS,
    primaryMetric: "results",
    direction: "INCREASE",
    relatedMetrics: ["results", "spend", "cost_per_result", "ctr", "cpc", "cpm", "impressions", "clicks"],
    defaultTargetUnit: "COUNT",
    supportedEntityLevels: ["campaign", "adset", "ad"],
  },
  DECREASE_COST_PER_RESULT: {
    code: "DECREASE_COST_PER_RESULT",
    label: ANALYSIS_GOAL_LABELS.DECREASE_COST_PER_RESULT,
    primaryMetric: "cost_per_result",
    direction: "DECREASE",
    relatedMetrics: ["cost_per_result", "spend", "results", "cpc", "ctr", "cpm", "frequency"],
    defaultTargetUnit: "BRL",
    supportedEntityLevels: ["campaign", "adset", "ad"],
  },
  INCREASE_CTR: {
    code: "INCREASE_CTR",
    label: ANALYSIS_GOAL_LABELS.INCREASE_CTR,
    primaryMetric: "ctr",
    direction: "INCREASE",
    relatedMetrics: ["ctr", "impressions", "clicks", "cpc", "cpm", "frequency", "spend"],
    defaultTargetUnit: "PERCENT",
    supportedEntityLevels: ["campaign", "adset", "ad"],
  },
  DECREASE_CPC: {
    code: "DECREASE_CPC",
    label: ANALYSIS_GOAL_LABELS.DECREASE_CPC,
    primaryMetric: "cpc",
    direction: "DECREASE",
    relatedMetrics: ["cpc", "ctr", "cpm", "impressions", "clicks", "spend", "frequency"],
    defaultTargetUnit: "BRL",
    supportedEntityLevels: ["campaign", "adset", "ad"],
  },
};

export function getGoalDefinition(code: AnalysisGoal): GoalDefinition {
  return GOAL_DEFINITIONS[code];
}
