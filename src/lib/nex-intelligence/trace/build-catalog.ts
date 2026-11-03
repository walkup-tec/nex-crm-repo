import type { MetaDataQualityReport } from "@/lib/nex-intelligence/quality/validate-export";
import type { NexMetaAnalysisV1 } from "@/lib/meta-export";
import {
  METRIC_TRACEABILITY_VERSION,
  computeDeterministicTraceStatus,
  dependenciesForMetric,
  normalizeCanonicalMetric,
  recomputeMetricFromMeta,
  type MetricTraceRecord,
  type MetricTraceability,
  type TraceCalculationType,
} from "@/lib/nex-intelligence/trace/index";

/** Métricas geradas no catálogo backend (Camada C) antes da OpenAI. */
export const BACKEND_CATALOG_METRICS = [
  "ctr",
  "cpc",
  "cpm",
  "cost_per_result",
  "spend",
  "clicks",
  "impressions",
  "results",
  "reach",
  "frequency",
] as const;

export type BackendCatalogEntityLevel = "campaign" | "adset" | "ad";

export type AvailableTraceRef = {
  trace_id: string;
  entity_level: BackendCatalogEntityLevel;
  entity_id: string;
  entity_name: string | null;
  metric: string;
  result: number | null;
};

function stableTraceId(level: string, entityId: string, metric: string) {
  return `nx-tr-${level}-${entityId}-${normalizeCanonicalMetric(metric)}`;
}

function formulaMeta(metric: string): {
  type: TraceCalculationType;
  formula: string;
  source_field: string;
  unit: string | null;
} {
  switch (normalizeCanonicalMetric(metric)) {
    case "ctr":
      return {
        type: "RATIO",
        formula: "(clicks / impressions) * 100",
        source_field: "insights.clicks+insights.impressions",
        unit: "percent",
      };
    case "cpc":
      return {
        type: "RATIO",
        formula: "spend / clicks",
        source_field: "insights.spend+insights.clicks",
        unit: "currency",
      };
    case "cpm":
      return {
        type: "RATIO",
        formula: "(spend / impressions) * 1000",
        source_field: "insights.spend+insights.impressions",
        unit: "currency",
      };
    case "cost_per_result":
      return {
        type: "RATIO",
        formula: "spend / results",
        source_field: "insights.spend+insights.results",
        unit: "currency",
      };
    default:
      return {
        type: "DIRECT",
        formula: metric,
        source_field: `insights.${normalizeCanonicalMetric(metric)}`,
        unit: normalizeCanonicalMetric(metric) === "spend" ? "currency" : null,
      };
  }
}

function entityName(
  payload: NexMetaAnalysisV1,
  level: BackendCatalogEntityLevel,
  entityId: string,
): string | null {
  if (level === "campaign") return payload.campaigns.find((row) => row.id === entityId)?.name ?? null;
  if (level === "adset") return payload.adsets.find((row) => row.id === entityId)?.name ?? null;
  return payload.ads.find((row) => row.id === entityId)?.name ?? null;
}

function entitiesOf(payload: NexMetaAnalysisV1): Array<{ level: BackendCatalogEntityLevel; id: string }> {
  return [
    ...payload.campaigns.map((row) => ({ level: "campaign" as const, id: row.id })),
    ...payload.adsets.map((row) => ({ level: "adset" as const, id: row.id })),
    ...payload.ads.map((row) => ({ level: "ad" as const, id: row.id })),
  ];
}

/**
 * Camada C: catálogo completo de traces determinísticos ANTES da OpenAI.
 * A IA não cria nem valida estes registros — apenas referencia trace_id.
 */
export function buildBackendMetricTraceCatalog(
  payload: NexMetaAnalysisV1,
  quality: MetaDataQualityReport,
): MetricTraceability {
  const records: MetricTraceRecord[] = [];

  for (const entity of entitiesOf(payload)) {
    for (const metricRaw of BACKEND_CATALOG_METRICS) {
      const metric = normalizeCanonicalMetric(metricRaw);
      const recomputed = recomputeMetricFromMeta(payload, entity.level, entity.id, metric);
      if (!recomputed || recomputed.result == null) continue;

      const meta = formulaMeta(metric);
      const draft: MetricTraceRecord = {
        trace_id: stableTraceId(entity.level, entity.id, metric),
        entity_level: entity.level,
        entity_id: entity.id,
        metric,
        source: "META_MARKETING_API",
        source_level: entity.level,
        source_field: meta.source_field,
        period: {
          since: payload.period.since,
          until: payload.period.until,
        },
        calculation: {
          type: meta.type,
          formula: meta.formula,
          inputs: recomputed.inputs,
          result: recomputed.result,
          unit: meta.unit,
          precision: 6,
          rounding: "half_up_6dp",
        },
        validation: {
          status: "PASS",
          dependencies: dependenciesForMetric(metric),
          check_codes: [],
          reason: null,
        },
        used_by: [],
      };

      const status = computeDeterministicTraceStatus(draft, payload, quality);
      if (status.status !== "PASS") continue;
      draft.validation = {
        status: "PASS",
        dependencies: dependenciesForMetric(metric),
        check_codes: [],
        reason: null,
      };
      records.push(draft);
    }
  }

  return { version: METRIC_TRACEABILITY_VERSION, records };
}

export function availableTraceRefs(
  catalog: MetricTraceability,
  payload: NexMetaAnalysisV1,
): AvailableTraceRef[] {
  const out: AvailableTraceRef[] = [];
  for (const row of catalog.records) {
    if (row.entity_level === "account") continue;
    out.push({
      trace_id: row.trace_id,
      entity_level: row.entity_level,
      entity_id: row.entity_id,
      entity_name: entityName(payload, row.entity_level, row.entity_id),
      metric: normalizeCanonicalMetric(row.metric),
      result: typeof row.calculation.result === "number" ? row.calculation.result : null,
    });
  }
  return out;
}

export function indexCatalogByEntityMetric(catalog: MetricTraceability) {
  const map = new Map<string, MetricTraceRecord>();
  for (const row of catalog.records) {
    const key = `${row.entity_level}:${row.entity_id}:${normalizeCanonicalMetric(row.metric)}`;
    map.set(key, row);
  }
  return map;
}
