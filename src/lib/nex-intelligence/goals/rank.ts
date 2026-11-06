import { getGoalDefinition } from "@/lib/nex-intelligence/goals/definitions";
import type { AnalysisObjectives } from "@/lib/nex-intelligence/goals/types";

export type RankableOpportunity = {
  id: string;
  relatedGoal?: string | null;
  primaryMetric?: string | null;
  entityId?: string | null;
  evidenceLevel?: string | null;
};

/**
 * Ordenação determinística: primaryGoal → objetivos secundários → evidência E3>E2>E1.
 * Não inventa oportunidades; só classifica as já existentes.
 */
export function rankOpportunitiesByObjectives<T extends RankableOpportunity>(
  rows: T[],
  objectives: AnalysisObjectives,
): T[] {
  const primary = getGoalDefinition(objectives.primaryGoal);
  const secondary = new Set(
    objectives.selectedGoals
      .filter((code) => code !== objectives.primaryGoal)
      .map((code) => getGoalDefinition(code).primaryMetric),
  );
  const evidenceScore = (level: string | null | undefined) => {
    if (level === "E3") return 3;
    if (level === "E2") return 2;
    if (level === "E1") return 1;
    return 0;
  };

  return [...rows].sort((a, b) => {
    const aPrimary =
      a.relatedGoal === objectives.primaryGoal || a.primaryMetric === primary.primaryMetric
        ? 1
        : 0;
    const bPrimary =
      b.relatedGoal === objectives.primaryGoal || b.primaryMetric === primary.primaryMetric
        ? 1
        : 0;
    if (aPrimary !== bPrimary) return bPrimary - aPrimary;

    const aSec =
      (a.primaryMetric && secondary.has(a.primaryMetric)) ||
      (a.relatedGoal && objectives.selectedGoals.includes(a.relatedGoal as never))
        ? 1
        : 0;
    const bSec =
      (b.primaryMetric && secondary.has(b.primaryMetric)) ||
      (b.relatedGoal && objectives.selectedGoals.includes(b.relatedGoal as never))
        ? 1
        : 0;
    if (aSec !== bSec) return bSec - aSec;

    const ev = evidenceScore(b.evidenceLevel) - evidenceScore(a.evidenceLevel);
    if (ev !== 0) return ev;
    return String(a.id).localeCompare(String(b.id));
  });
}
