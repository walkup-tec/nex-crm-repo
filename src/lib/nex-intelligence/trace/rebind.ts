import type { NexMetaAnalysisV1 } from "@/lib/meta-export";
import type { StructuredClaim, StructuredRecommendation } from "@/lib/nex-intelligence/ai-output/schemas";
import { inferMetricsFromText, resolveEntityFromText } from "@/lib/nex-intelligence/validation/entity-helpers";
import {
  indexCatalogByEntityMetric,
  type AvailableTraceRef,
} from "@/lib/nex-intelligence/trace/build-catalog";
import {
  normalizeCanonicalMetric,
  type MetricTraceRecord,
  type MetricTraceability,
} from "@/lib/nex-intelligence/trace/index";

export type TraceRebindAudit = {
  claim_id: string;
  kind: "observation" | "recommendation" | "executive_point";
  applied: boolean;
  previous_trace_ids: string[];
  next_trace_ids: string[];
  reason: string;
};

function pickTracesForEntityMetrics(input: {
  entityId: string;
  level: "account" | "campaign" | "adset" | "ad";
  metrics: string[];
  catalogIndex: Map<string, MetricTraceRecord>;
}): string[] {
  if (!input.entityId || input.level === "account") return [];
  const ids: string[] = [];
  for (const metricRaw of input.metrics) {
    const metric = normalizeCanonicalMetric(metricRaw);
    const hit = input.catalogIndex.get(`${input.level}:${input.entityId}:${metric}`);
    if (hit) ids.push(hit.trace_id);
  }
  return [...new Set(ids)];
}

function sameIds(a: string[], b: string[]) {
  if (a.length !== b.length) return false;
  const left = [...a].sort();
  const right = [...b].sort();
  return left.every((id, i) => id === right[i]);
}

/** Substitui metric_traceability da IA pelo catálogo backend (fonte de verdade). */
export function replaceAiTraceabilityWithBackend(
  backend: MetricTraceability,
  usedByLinks: Array<{ claimId: string; traceIds: string[] }> = [],
): MetricTraceability {
  const records = backend.records.map((row) => ({
    ...row,
    used_by: [] as string[],
    calculation: { ...row.calculation, inputs: { ...row.calculation.inputs } },
    validation: { ...row.validation, dependencies: [...row.validation.dependencies] },
  }));
  const byId = new Map(records.map((row) => [row.trace_id, row]));
  for (const link of usedByLinks) {
    for (const traceId of link.traceIds) {
      const row = byId.get(traceId);
      if (!row) continue;
      if (!row.used_by.includes(link.claimId)) row.used_by.push(link.claimId);
    }
  }
  return { version: backend.version, records };
}

/**
 * Reassocia trace_ids por entity_id + metric (+ período já fixo no catálogo).
 * Corrige referências erradas/ausentes da IA sem regenerar OpenAI.
 */
export function rebindClaimTraces(input: {
  claim: StructuredClaim;
  kind: TraceRebindAudit["kind"];
  payload: NexMetaAnalysisV1;
  catalog: MetricTraceability;
}): { claim: StructuredClaim; audit: TraceRebindAudit } {
  const catalogIndex = indexCatalogByEntityMetric(input.catalog);
  const resolved =
    input.claim.entity_id && input.claim.level !== "account"
      ? { entity_id: input.claim.entity_id, level: input.claim.level }
      : resolveEntityFromText(input.claim.text, input.payload);

  const metrics = (
    input.claim.metrics_used?.length ? input.claim.metrics_used : inferMetricsFromText(input.claim.text)
  ).map(normalizeCanonicalMetric);

  const nextIds = pickTracesForEntityMetrics({
    entityId: resolved.entity_id ?? "",
    level: resolved.level,
    metrics,
    catalogIndex,
  });

  const previous = [...(input.claim.trace_ids ?? [])];
  const applied = nextIds.length > 0 && !sameIds(previous, nextIds);
  const claim: StructuredClaim = {
    ...input.claim,
    entity_id: resolved.entity_id ?? input.claim.entity_id,
    level: resolved.level,
    metrics_used: metrics.length ? metrics : input.claim.metrics_used,
    trace_ids: nextIds.length ? nextIds : previous,
  };

  return {
    claim,
    audit: {
      claim_id: input.claim.id,
      kind: input.kind,
      applied: applied || (previous.length === 0 && nextIds.length > 0),
      previous_trace_ids: previous,
      next_trace_ids: claim.trace_ids ?? [],
      reason: nextIds.length
        ? applied || previous.length === 0
          ? "deterministic_entity_metric_rebind"
          : "traces_already_aligned"
        : "no_catalog_trace_for_entity_metric",
    },
  };
}

export function rebindRecommendationTraces(input: {
  recommendation: StructuredRecommendation;
  payload: NexMetaAnalysisV1;
  catalog: MetricTraceability;
}): { recommendation: StructuredRecommendation; audit: TraceRebindAudit } {
  const catalogIndex = indexCatalogByEntityMetric(input.catalog);
  const metrics = (input.recommendation.indicators_used ?? []).map(normalizeCanonicalMetric);
  const nextIds = pickTracesForEntityMetrics({
    entityId: input.recommendation.entity_id,
    level: input.recommendation.level,
    metrics,
    catalogIndex,
  });
  const previous = [...(input.recommendation.trace_ids ?? [])];
  const applied = nextIds.length > 0 && !sameIds(previous, nextIds);
  const recommendation: StructuredRecommendation = {
    ...input.recommendation,
    indicators_used: metrics.length ? metrics : input.recommendation.indicators_used,
    trace_ids: nextIds.length ? nextIds : previous,
  };
  return {
    recommendation,
    audit: {
      claim_id: input.recommendation.id,
      kind: "recommendation",
      applied: applied || (previous.length === 0 && nextIds.length > 0),
      previous_trace_ids: previous,
      next_trace_ids: recommendation.trace_ids ?? [],
      reason: nextIds.length
        ? applied || previous.length === 0
          ? "deterministic_entity_metric_rebind"
          : "traces_already_aligned"
        : "no_catalog_trace_for_entity_metric",
    },
  };
}

export function summarizeAvailableTracesForPrompt(refs: AvailableTraceRef[]): string {
  if (!refs.length) return "available_traces: []";
  return [
    "available_traces (use APENAS estes trace_id — o NEX ignora metric_traceability inventado pela IA):",
    JSON.stringify(refs, null, 2),
  ].join("\n");
}
