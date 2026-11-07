import type { AnalysisGoal, AnalysisObjectives } from "@/lib/nex-intelligence/goals/types";
import { ANALYSIS_GOAL_LABELS } from "@/lib/nex-intelligence/goals/types";
import { getGoalDefinition } from "@/lib/nex-intelligence/goals/definitions";
import { composeGoalAnalysis } from "@/lib/nex-intelligence/goals/compose";
import type { ValidatedComparisonRef } from "@/lib/nex-intelligence/trace/build-comparisons";
import { normalizeCanonicalMetric, recomputeMetricFromMeta } from "@/lib/nex-intelligence/trace";
import type { ClaimIR } from "@/lib/nex-intelligence/claim-ir/schema";
import type { NexMetaAnalysisV1 } from "@/lib/meta-export";
import { resolveEntityDisplayName } from "@/lib/nex-intelligence/dashboard/entity-labels";

export type MetricEvidenceCell = {
  entityId: string;
  entityName: string;
  value: number | null;
};

export type MetricEvidenceRow = {
  metric: string;
  label: string;
  unit: "currency" | "count" | "ratio_pct" | "other";
  cells: MetricEvidenceCell[];
};

export type StrategicRecommendation = {
  id: string;
  primaryGoal: AnalysisGoal;
  relatedGoals: AnalysisGoal[];
  strategyType: "budget_reallocation_test";
  title: string;
  scope: {
    level: "campaign" | "adset" | "ad";
    entityIds: string[];
    entityNames: string[];
    campaignIds: string[];
    adsetIds: string[];
  };
  diagnosis: {
    summary: string;
    metrics: MetricEvidenceRow[];
    detectedProblem: string;
    opportunity: string;
  };
  rationale: {
    mechanism: string;
    expectedDirection: string;
    assumptions: string[];
    limitations: string[];
  };
  actionPlan: {
    actionType: "scale_budget";
    steps: string[];
    executionLevel: "campaign" | "adset" | "ad";
    prerequisites: string[];
  };
  validationPlan: {
    baselinePeriod: { since: string | null; until: string | null };
    evaluationMetricKeys: string[];
    successCriteria: string[];
    guardrailMetrics: string[];
    minimumEvidenceRequirements: string[];
  };
  confidence: {
    evidenceLevel: "E3";
    status: "VALIDATED" | "INVESTIGATION" | "BLOCKED";
    reasons: string[];
  };
  comparisonRefs: string[];
  metricTraceIds: string[];
  priorityScore: number;
};

const METRIC_LABEL: Record<string, { label: string; unit: MetricEvidenceRow["unit"] }> = {
  spend: { label: "Investimento", unit: "currency" },
  results: { label: "Resultados", unit: "count" },
  cost_per_result: { label: "Custo por resultado", unit: "currency" },
  impressions: { label: "Impressões", unit: "count" },
  clicks: { label: "Cliques", unit: "count" },
  ctr: { label: "CTR", unit: "ratio_pct" },
  cpc: { label: "CPC", unit: "currency" },
  cpm: { label: "CPM", unit: "currency" },
  frequency: { label: "Frequência", unit: "other" },
};

const DIAGNOSTIC_METRICS = [
  "spend",
  "results",
  "cost_per_result",
  "impressions",
  "clicks",
  "ctr",
  "cpc",
  "cpm",
  "frequency",
] as const;

function parentCampaignId(
  payload: NexMetaAnalysisV1,
  level: "campaign" | "adset" | "ad",
  entityId: string,
): string | null {
  if (level === "campaign") return entityId;
  if (level === "adset") {
    return payload.adsets.find((row) => row.id === entityId)?.campaign_id ?? null;
  }
  return payload.ads.find((row) => row.id === entityId)?.campaign_id ?? null;
}

function parentAdsetId(
  payload: NexMetaAnalysisV1,
  level: "campaign" | "adset" | "ad",
  entityId: string,
): string | null {
  if (level === "adset") return entityId;
  if (level === "ad") return payload.ads.find((row) => row.id === entityId)?.adset_id ?? null;
  return null;
}

function metricValue(
  payload: NexMetaAnalysisV1,
  level: "campaign" | "adset" | "ad",
  entityId: string,
  metric: string,
): number | null {
  const recomputed = recomputeMetricFromMeta(payload, level, entityId, metric);
  return recomputed?.result ?? null;
}

function buildMetricRows(
  payload: NexMetaAnalysisV1,
  level: "campaign" | "adset" | "ad",
  entityIds: string[],
): MetricEvidenceRow[] {
  const rows: MetricEvidenceRow[] = [];
  for (const metric of DIAGNOSTIC_METRICS) {
    const meta = METRIC_LABEL[metric]!;
    const cells = entityIds.map((entityId) => ({
      entityId,
      entityName: resolveEntityDisplayName(payload, level, entityId) ?? entityId,
      value: metricValue(payload, level, entityId, metric),
    }));
    if (cells.every((cell) => cell.value == null)) continue;
    rows.push({ metric, label: meta.label, unit: meta.unit, cells });
  }
  return rows;
}

function formatValue(value: number | null, unit: MetricEvidenceRow["unit"]): string {
  if (value == null || !Number.isFinite(value)) return "indisponível";
  if (unit === "currency") {
    return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }
  if (unit === "ratio_pct") {
    return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
  }
  return value.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}

function betterEntityForMetric(
  metric: string,
  cells: MetricEvidenceCell[],
): MetricEvidenceCell | null {
  const usable = cells.filter((cell) => cell.value != null && Number.isFinite(cell.value));
  if (usable.length < 2) return null;
  const lowerBetter = metric === "cost_per_result" || metric === "cpc" || metric === "cpm";
  return [...usable].sort((a, b) =>
    lowerBetter ? (a.value! - b.value!) : (b.value! - a.value!),
  )[0]!;
}

function strategicSignature(input: {
  primaryGoal: AnalysisGoal;
  level: "campaign" | "adset" | "ad";
  metric: string;
  campaignIds: string[];
}): string {
  return [
    input.primaryGoal,
    "budget_reallocation_test",
    input.level,
    normalizeCanonicalMetric(input.metric),
    [...input.campaignIds].sort().join(","),
  ].join("|");
}

function priorityScore(input: {
  primaryGoal: AnalysisGoal;
  metric: string;
  magnitude: number;
  entityCount: number;
  pairCount: number;
  level: "campaign" | "adset" | "ad";
  sameAdset: boolean;
}): number {
  const def = getGoalDefinition(input.primaryGoal);
  const metricMatch = normalizeCanonicalMetric(input.metric) === def.primaryMetric ? 40 : 10;
  const magnitude = Math.min(25, Math.abs(input.magnitude));
  const volume = Math.min(15, input.entityCount * 4);
  const pairs = Math.min(20, input.pairCount * 5);
  const levelBonus = input.level === "ad" ? 12 : input.level === "adset" ? 8 : 0;
  const operability = input.sameAdset ? 15 : 5;
  return metricMatch + magnitude + volume + pairs + levelBonus + operability;
}

type PairCluster = {
  signature: string;
  level: "campaign" | "adset" | "ad";
  metric: string;
  pairs: ValidatedComparisonRef[];
  entityIds: Set<string>;
  campaignIds: Set<string>;
  adsetIds: Set<string>;
  comparisonRefs: string[];
};

/**
 * Constrói recomendações estratégicas consolidadas com diagnóstico quantitativo.
 * Valores vêm do export Meta (recompute); não inventa evidência.
 */
export function buildStrategicRecommendationPackage(input: {
  objectives: AnalysisObjectives;
  comparisons: ValidatedComparisonRef[];
  payload: NexMetaAnalysisV1;
  limit?: number;
}): { recommendations: StrategicRecommendation[]; claims: ClaimIR[] } {
  const composed = composeGoalAnalysis(input.objectives);
  const preferredMetrics = new Set(
    composed.requiredMetrics.map((m) => normalizeCanonicalMetric(m)),
  );
  const primary = input.objectives.primaryGoal;
  const primaryMetric = normalizeCanonicalMetric(getGoalDefinition(primary).primaryMetric);
  const relatedGoals = input.objectives.selectedGoals.filter((g) => g !== primary);
  // Poucas recomendações consolidadas > muitos pares equivalentes.
  const limit = input.limit ?? 2;

  const entityPairs = input.comparisons.filter(
    (row) =>
      row.kind === "ENTITY" &&
      preferredMetrics.has(normalizeCanonicalMetric(row.metric)) &&
      Boolean(row.other_entity_id),
  );

  const clusters = new Map<string, PairCluster>();
  for (const pair of entityPairs) {
    const leftCampaign = parentCampaignId(input.payload, pair.entity_level, pair.entity_id);
    const rightCampaign = parentCampaignId(
      input.payload,
      pair.entity_level,
      pair.other_entity_id!,
    );
    const campaignIds = [leftCampaign, rightCampaign].filter((id): id is string => Boolean(id));
    if (!campaignIds.length) continue;

    // Evento incompatível entre campanhas: não consolidar/gerar
    if (pair.entity_level === "campaign" || leftCampaign !== rightCampaign) {
      const events = [...new Set(campaignIds.map((id) => {
        const camp = input.payload.campaigns.find((c) => c.id === id);
        return camp?.result_metric?.trim() || null;
      }))];
      if (events.length > 1 || events.some((e) => !e)) continue;
    }

    const signature = strategicSignature({
      primaryGoal: primary,
      level: pair.entity_level,
      metric: pair.metric,
      campaignIds: [...new Set(campaignIds)],
    });
    const existing = clusters.get(signature) ?? {
      signature,
      level: pair.entity_level,
      metric: normalizeCanonicalMetric(pair.metric),
      pairs: [],
      entityIds: new Set<string>(),
      campaignIds: new Set<string>(),
      adsetIds: new Set<string>(),
      comparisonRefs: [],
    };
    existing.pairs.push(pair);
    existing.entityIds.add(pair.entity_id);
    existing.entityIds.add(pair.other_entity_id!);
    for (const id of campaignIds) existing.campaignIds.add(id);
    const leftAdset = parentAdsetId(input.payload, pair.entity_level, pair.entity_id);
    const rightAdset = parentAdsetId(input.payload, pair.entity_level, pair.other_entity_id!);
    if (leftAdset) existing.adsetIds.add(leftAdset);
    if (rightAdset) existing.adsetIds.add(rightAdset);
    existing.comparisonRefs.push(pair.comparison_ref);
    clusters.set(signature, existing);
  }

  const rankedClusters = [...clusters.values()]
    .map((cluster) => {
      const maxDelta = Math.max(...cluster.pairs.map((p) => Math.abs(p.delta)), 0);
      const sameAdset = cluster.level === "ad" && cluster.adsetIds.size === 1;
      return {
        cluster,
        score: priorityScore({
          primaryGoal: primary,
          metric: cluster.metric,
          magnitude: maxDelta,
          entityCount: cluster.entityIds.size,
          pairCount: cluster.pairs.length,
          level: cluster.level,
          sameAdset,
        }),
      };
    })
    .sort((a, b) => {
      const aPrimary = a.cluster.metric === primaryMetric ? 1 : 0;
      const bPrimary = b.cluster.metric === primaryMetric ? 1 : 0;
      if (aPrimary !== bPrimary) return bPrimary - aPrimary;
      return b.score - a.score;
    })
    .slice(0, limit);

  const recommendations: StrategicRecommendation[] = [];
  const claims: ClaimIR[] = [];

  rankedClusters.forEach((entry, index) => {
    const { cluster, score } = entry;
    const entityIds = [...cluster.entityIds];
    const entityNames = entityIds.map(
      (id) => resolveEntityDisplayName(input.payload, cluster.level, id) ?? id,
    );
    const metrics = buildMetricRows(input.payload, cluster.level, entityIds);
    const focusRow = metrics.find((row) => row.metric === cluster.metric);
    const best = focusRow ? betterEntityForMetric(cluster.metric, focusRow.cells) : null;
    const worst =
      focusRow && best
        ? [...focusRow.cells]
            .filter((c) => c.entityId !== best.entityId && c.value != null)
            .sort((a, b) => {
              const lowerBetter =
                cluster.metric === "cost_per_result" ||
                cluster.metric === "cpc" ||
                cluster.metric === "cpm";
              return lowerBetter ? (b.value! - a.value!) : (a.value! - b.value!);
            })[0] ?? null
        : null;

    if (!best || !worst || !focusRow) return;

    const meta = METRIC_LABEL[cluster.metric] ?? { label: cluster.metric, unit: "other" as const };
    const sameAdset = cluster.level === "ad" && cluster.adsetIds.size === 1;
    const levelLabel =
      cluster.level === "campaign" ? "campanhas" : cluster.level === "adset" ? "conjuntos" : "anúncios";
    const goalLabel = ANALYSIS_GOAL_LABELS[primary];

    const comparisonLines = focusRow.cells
      .map((cell) => `${cell.entityName}: ${formatValue(cell.value, meta.unit)}`)
      .join("; ");

    const title = `Avaliar redistribuição de investimento entre ${levelLabel} com ${meta.label.toLowerCase()} distintos`;
    const detectedProblem = `${worst.entityName} apresentou ${meta.label.toLowerCase()} de ${formatValue(worst.value, meta.unit)} frente a ${best.entityName} (${formatValue(best.value, meta.unit)}) no período analisado.`;
    const opportunity = `Concentrar testes de alocação nas entidades com melhor ${meta.label.toLowerCase()} pode melhorar o objetivo prioritário (${goalLabel}), se a eficiência se mantiver com maior entrega.`;

    const executionLevel: "campaign" | "adset" | "ad" =
      cluster.level === "ad" ? (sameAdset ? "adset" : "campaign") : cluster.level;

    const prerequisites = [
      "Confirmar no Gerenciador se o orçamento é controlado na campanha ou no conjunto.",
      sameAdset
        ? "Os anúncios comparados pertencem ao mesmo conjunto — preferir ajuste no conjunto/campanha, não “orçamento por anúncio”."
        : "Entidades em conjuntos distintos — validar se há Advantage Campaign Budget / orçamento compartilhado antes do teste.",
      "Não executar alterações via API NEX; o gestor aplica manualmente e registra Aplicar/Rejeitar.",
    ];

    const metricTraceIds = entityIds.map(
      (id) => `nx-tr-${cluster.level}-${id}-${cluster.metric}`,
    );
    // Claim E3 ancora na melhor entidade + comparison de maior |delta|
    const anchorPair = [...cluster.pairs].sort(
      (a, b) => Math.abs(b.delta) - Math.abs(a.delta),
    )[0]!;
    const claimId = `goal-strategic-${index + 1}-${cluster.metric}`;

    const recommendation: StrategicRecommendation = {
      id: claimId,
      primaryGoal: primary,
      relatedGoals,
      strategyType: "budget_reallocation_test",
      title,
      scope: {
        level: cluster.level,
        entityIds,
        entityNames,
        campaignIds: [...cluster.campaignIds],
        adsetIds: [...cluster.adsetIds],
      },
      diagnosis: {
        summary: `${detectedProblem} Comparativo (${meta.label}): ${comparisonLines}.`,
        metrics,
        detectedProblem,
        opportunity,
      },
      rationale: {
        mechanism: `Se parte do investimento migrar gradualmente para entidades com melhor ${meta.label.toLowerCase()}, o custo agregado e/ou o volume de resultados podem melhorar — hipótese a testar, não efeito garantido.`,
        expectedDirection:
          getGoalDefinition(primary).direction === "DECREASE"
            ? `Redução de ${meta.label.toLowerCase()} agregado sem colapso de volume de resultados.`
            : `Aumento de resultados mantendo ${meta.label.toLowerCase()} sob controle.`,
        assumptions: [
          "Entidades comparadas compartilham evento de resultado e janela compatíveis.",
          "A diferença observada não é apenas ruído de amostra curta.",
          "Não há mudança simultânea de criativo/público que confunda o teste.",
        ],
        limitations: [
          "Diferença observada não prova causalidade da configuração.",
          "Aumento de entrega pode elevar o custo marginal (saturação/aprendizado).",
          "CTR/CPC/CPM são fatores associados, não prova isolada de CPR ou resultados.",
          relatedGoals.length
            ? `Trade-offs com objetivos secundários: ${relatedGoals.map((g) => ANALYSIS_GOAL_LABELS[g]).join(", ")}.`
            : "Sem objetivos secundários declarados nesta execução.",
        ],
      },
      actionPlan: {
        actionType: "scale_budget",
        steps: [
          `Listar entidades sob teste: ${entityNames.join("; ")}.`,
          `Definir baseline do período ${input.payload.period.since ?? "?"} a ${input.payload.period.until ?? "?"}.`,
          `No nível ${executionLevel === "campaign" ? "da campanha" : executionLevel === "adset" ? "do conjunto" : "indicado"}, reduzir gradualmente a entrega relativa de “${worst.entityName}” e ampliar a de “${best.entityName}” (sem pausar tudo de uma vez).`,
          "Registrar a intervenção no NEX (Aplicar) com data efetiva para comparação antes/depois.",
        ],
        executionLevel,
        prerequisites,
      },
      validationPlan: {
        baselinePeriod: {
          since: input.payload.period.since,
          until: input.payload.period.until,
        },
        evaluationMetricKeys: [cluster.metric, primaryMetric, "results", "spend"].filter(
          (v, i, arr) => arr.indexOf(v) === i,
        ),
        successCriteria: [
          `${ANALYSIS_GOAL_LABELS[primary]}: ${meta.label} agregado na direção desejada em janela equivalente pós-intervenção.`,
          "Volume de resultados não pode cair de forma desproporcional ao investimento redistribuído.",
        ],
        guardrailMetrics: ["results", "spend", "ctr", "cpc", "frequency"].filter(
          (m) => m !== cluster.metric,
        ),
        minimumEvidenceRequirements: [
          "Mesmo evento de resultado e atribuição.",
          "Períodos com cobertura diária comparável.",
          "Traces PASS para as métricas de validação.",
        ],
      },
      confidence: {
        evidenceLevel: "E3",
        status: "VALIDATED",
        reasons: [
          `Comparações determinísticas disponíveis (${cluster.comparisonRefs.length}).`,
          `Métrica alinhada ao objetivo prioritário: ${cluster.metric === primaryMetric ? "sim" : "parcial"}.`,
          sameAdset
            ? "Anúncios no mesmo conjunto — teste operacionalmente mais controlável."
            : "Escopo multi-conjunto/campanha — risco operacional maior.",
        ],
      },
      comparisonRefs: [...new Set(cluster.comparisonRefs)],
      metricTraceIds,
      priorityScore: score,
    };

    const claim: ClaimIR = {
      claim_id: claimId,
      operation: "STRATEGIC_TEST",
      entity_level: cluster.level,
      entity_id: best.entityId,
      args: {
        action_kind: "scale_budget",
        action: title,
        hypothesis: recommendation.rationale.mechanism,
        validation_criterion: recommendation.validationPlan.successCriteria.join(" "),
        reversal_condition:
          "Reverter alocação se guardrails (resultados/spend/frequência) deteriorarem sem ganho no objetivo prioritário.",
      },
      metric_refs: [`nx-tr-${cluster.level}-${best.entityId}-${cluster.metric}`],
      comparison_ref: anchorPair.comparison_ref,
      hypothesis_ref: null,
      action_ref: null,
    };

    recommendations.push(recommendation);
    claims.push(claim);
  });

  return { recommendations, claims };
}

/** @deprecated use buildStrategicRecommendationPackage */
export function buildStrategicTestCandidates(input: {
  objectives: AnalysisObjectives;
  comparisons: ValidatedComparisonRef[];
  payload?: NexMetaAnalysisV1 | null;
  limit?: number;
}): ClaimIR[] {
  if (!input.payload) return [];
  return buildStrategicRecommendationPackage({
    objectives: input.objectives,
    comparisons: input.comparisons,
    payload: input.payload,
    limit: input.limit,
  }).claims;
}
