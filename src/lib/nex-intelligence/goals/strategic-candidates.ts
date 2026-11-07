import { composeGoalAnalysis } from "@/lib/nex-intelligence/goals/compose";
import { getGoalDefinition } from "@/lib/nex-intelligence/goals/definitions";
import type { AnalysisObjectives } from "@/lib/nex-intelligence/goals/types";
import type { ValidatedComparisonRef } from "@/lib/nex-intelligence/trace/build-comparisons";
import { normalizeCanonicalMetric } from "@/lib/nex-intelligence/trace";
import type { ClaimIR } from "@/lib/nex-intelligence/claim-ir/schema";
import type { NexMetaAnalysisV1 } from "@/lib/meta-export";
import { resolveEntityDisplayName } from "@/lib/nex-intelligence/dashboard/entity-labels";

/**
 * Candidatos determinísticos de STRATEGIC_TEST a partir de comparisons validadas.
 * A IA pode refinar; o backend nunca inventa comparison_ref.
 */
export function buildStrategicTestCandidates(input: {
  objectives: AnalysisObjectives;
  comparisons: ValidatedComparisonRef[];
  payload?: NexMetaAnalysisV1 | null;
  limit?: number;
}): ClaimIR[] {
  const composed = composeGoalAnalysis(input.objectives);
  const preferredMetrics = new Set(
    composed.requiredMetrics.map((m) => normalizeCanonicalMetric(m)),
  );
  const primaryMetric = normalizeCanonicalMetric(
    getGoalDefinition(input.objectives.primaryGoal).primaryMetric,
  );

  const ranked = [...input.comparisons]
    .filter((row) => preferredMetrics.has(normalizeCanonicalMetric(row.metric)))
    .sort((a, b) => {
      const aPrimary = a.metric === primaryMetric ? 0 : 1;
      const bPrimary = b.metric === primaryMetric ? 0 : 1;
      if (aPrimary !== bPrimary) return aPrimary - bPrimary;
      return Math.abs(b.delta) - Math.abs(a.delta);
    })
    .slice(0, input.limit ?? 5);

  return ranked.map((row, index) => {
    const metric = normalizeCanonicalMetric(row.metric);
    const entityId = row.entity_id;
    const otherId = row.other_entity_id ?? "peer";
    const leftName =
      resolveEntityDisplayName(input.payload, row.entity_level, entityId) ?? entityId;
    const rightName =
      resolveEntityDisplayName(input.payload, row.entity_level, otherId) ?? otherId;
    const scalarRef = `nx-tr-${row.entity_level}-${entityId}-${metric}`;
    return {
      claim_id: `goal-candidate-${index + 1}-${metric}`,
      operation: "STRATEGIC_TEST" as const,
      entity_level: row.entity_level,
      entity_id: entityId,
      args: {
        action_kind: "scale_budget" as const,
        action: `Testar redistribuição de orçamento entre “${leftName}” e “${rightName}” com base em ${metric}.`,
        hypothesis: `Diferença observável de ${metric} entre entidades comparáveis pode indicar alocação ineficiente.`,
        validation_criterion: `${metric} da entidade priorizada melhora sem deteriorar o objetivo secundário no próximo período.`,
      },
      metric_refs: [scalarRef],
      comparison_ref: row.comparison_ref,
      hypothesis_ref: null,
      action_ref: null,
    };
  });
}
