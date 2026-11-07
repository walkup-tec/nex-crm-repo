import type { AnalysisObjectives } from "@/lib/nex-intelligence/goals/types";
import { getGoalDefinition } from "@/lib/nex-intelligence/goals/definitions";
import type { ValidatedClaimIR } from "@/lib/nex-intelligence/claim-ir/validate";
import type { ValidatedComparisonRef } from "@/lib/nex-intelligence/trace/build-comparisons";
import type { MetaDataQualityReport } from "@/lib/nex-intelligence/quality/validate-export";
import { normalizeCanonicalMetric } from "@/lib/nex-intelligence/trace";

export type ObjectivesCoverageStatus =
  | "COVERED"
  | "PARTIAL"
  | "UNCOVERED"
  | "BLOCKED_BY_QUALITY";

export type ObjectivesCoverage = {
  status: ObjectivesCoverageStatus;
  primary_goal: string | null;
  selected_goals: string[];
  strategic_approved: number;
  monitor_approved: number;
  goal_metrics_with_comparison: string[];
  goal_metrics_compromised: string[];
  notes: string[];
};

/**
 * Indicador separado de publication/analytical_status:
 * os objetivos foram atendidos com otimização E3, só monitoramento, ou bloqueados por qualidade.
 */
export function deriveObjectivesCoverage(input: {
  objectives?: AnalysisObjectives | null;
  approved: ValidatedClaimIR[];
  comparisons: ValidatedComparisonRef[];
  quality: MetaDataQualityReport;
}): ObjectivesCoverage {
  const objectives = input.objectives ?? null;
  const selected = objectives?.selectedGoals ?? [];
  const primary = objectives?.primaryGoal ?? null;
  const notes: string[] = [];

  const strategic = input.approved.filter(
    (c) => c.operation === "STRATEGIC_TEST" && c.evidence_level === "E3",
  );
  const monitors = input.approved.filter((c) => c.operation === "MONITOR");

  const goalMetrics = selected.map((code) =>
    normalizeCanonicalMetric(getGoalDefinition(code).primaryMetric),
  );
  const uniqueGoalMetrics = [...new Set(goalMetrics)];
  const cmpMetrics = new Set(input.comparisons.map((c) => normalizeCanonicalMetric(c.metric)));
  const withCmp = uniqueGoalMetrics.filter((m) => cmpMetrics.has(m));
  const compromised = uniqueGoalMetrics.filter((m) =>
    input.quality.compromised_metrics.includes(m),
  );

  if (!selected.length) {
    return {
      status: "UNCOVERED",
      primary_goal: null,
      selected_goals: [],
      strategic_approved: strategic.length,
      monitor_approved: monitors.length,
      goal_metrics_with_comparison: [],
      goal_metrics_compromised: [],
      notes: ["Sem analysis_objectives na execução."],
    };
  }

  if (strategic.length > 0) {
    notes.push(`${strategic.length} teste(s) estratégico(s) E3 aprovado(s).`);
    return {
      status: withCmp.length === uniqueGoalMetrics.length ? "COVERED" : "PARTIAL",
      primary_goal: primary,
      selected_goals: selected,
      strategic_approved: strategic.length,
      monitor_approved: monitors.length,
      goal_metrics_with_comparison: withCmp,
      goal_metrics_compromised: compromised,
      notes,
    };
  }

  if (compromised.length === uniqueGoalMetrics.length && withCmp.length === 0) {
    notes.push(
      "Métricas dos objetivos comprometidas na qualidade Meta; sem comparisons E2 utilizáveis.",
    );
    return {
      status: "BLOCKED_BY_QUALITY",
      primary_goal: primary,
      selected_goals: selected,
      strategic_approved: 0,
      monitor_approved: monitors.length,
      goal_metrics_with_comparison: withCmp,
      goal_metrics_compromised: compromised,
      notes,
    };
  }

  if (monitors.length > 0) {
    notes.push(
      "Apenas MONITOR aprovado — monitoramento não conta como otimização orientada a objetivos.",
    );
    return {
      status: withCmp.length ? "PARTIAL" : "UNCOVERED",
      primary_goal: primary,
      selected_goals: selected,
      strategic_approved: 0,
      monitor_approved: monitors.length,
      goal_metrics_with_comparison: withCmp,
      goal_metrics_compromised: compromised,
      notes,
    };
  }

  notes.push("Nenhuma recomendação aprovada para os objetivos selecionados.");
  return {
    status: "UNCOVERED",
    primary_goal: primary,
    selected_goals: selected,
    strategic_approved: 0,
    monitor_approved: 0,
    goal_metrics_with_comparison: withCmp,
    goal_metrics_compromised: compromised,
    notes,
  };
}
