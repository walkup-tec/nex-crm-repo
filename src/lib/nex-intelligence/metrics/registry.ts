import type { NexMetaAnalysisV1 } from "@/lib/meta-export";
import type { MetaDataQualityReport, DataQualityStatus } from "@/lib/nex-intelligence/quality/validate-export";
import {
  computeCostPerResult,
  computeCpc,
  computeCpm,
  computeCtr,
} from "@/lib/nex-intelligence/metrics/formulas";
import { normalizeCanonicalMetric } from "@/lib/nex-intelligence/trace";

export type MetricRegistryIntegrity = DataQualityStatus;

export type MetricRegistryEntry = {
  metric_id: string;
  metric: string;
  entity_level: "account" | "campaign" | "adset" | "ad";
  entity_id: string;
  entity_name?: string;
  period_since: string | null;
  period_until: string | null;
  timezone: string;
  source: "meta_ads";
  query_ref: string;
  source_fields: string[];
  operands: Record<string, number | null>;
  formula: string | null;
  value: number | null;
  /** Distingue ausência de zero. */
  value_present: boolean;
  unit: "ratio_pct" | "currency" | "count" | "other";
  precision: number;
  dependencies: string[];
  integrity: MetricRegistryIntegrity;
  integrity_reason: string;
};

function num(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function integrityFor(
  quality: MetaDataQualityReport,
  entityId: string,
  metric: string,
): { integrity: MetricRegistryIntegrity; reason: string } {
  const affected = quality.affected_metrics?.includes(metric);
  if (quality.status === "FAIL" && affected) {
    return { integrity: "FAIL", reason: `quality_fail:${metric}` };
  }
  if (quality.status === "WARNING" && affected) {
    return { integrity: "WARNING", reason: `quality_warning:${metric}` };
  }
  if (quality.status === "NOT_VERIFIABLE") {
    return { integrity: "NOT_VERIFIABLE", reason: "global_not_verifiable" };
  }
  return { integrity: "PASS", reason: "ok" };
}

function pushEntityMetrics(
  out: MetricRegistryEntry[],
  input: {
    entity_level: MetricRegistryEntry["entity_level"];
    entity_id: string;
    entity_name?: string;
    period_since: string | null;
    period_until: string | null;
    timezone: string;
    impressions: number | null;
    clicks: number | null;
    spend: number | null;
    results: number | null;
    quality: MetaDataQualityReport;
  },
) {
  const base = {
    entity_level: input.entity_level,
    entity_id: input.entity_id,
    ...(input.entity_name ? { entity_name: input.entity_name } : {}),
    period_since: input.period_since,
    period_until: input.period_until,
    timezone: input.timezone,
    source: "meta_ads" as const,
    query_ref: `meta:${input.entity_level}:${input.entity_id}`,
  };

  const specs: Array<{
    metric: string;
    value: number | null;
    operands: Record<string, number | null>;
    formula: string | null;
    source_fields: string[];
    unit: MetricRegistryEntry["unit"];
    dependencies: string[];
    precision: number;
  }> = [
    {
      metric: "impressions",
      value: input.impressions,
      operands: { impressions: input.impressions },
      formula: null,
      source_fields: ["impressions"],
      unit: "count",
      dependencies: [],
      precision: 0,
    },
    {
      metric: "clicks",
      value: input.clicks,
      operands: { clicks: input.clicks },
      formula: null,
      source_fields: ["clicks"],
      unit: "count",
      dependencies: [],
      precision: 0,
    },
    {
      metric: "spend",
      value: input.spend,
      operands: { spend: input.spend },
      formula: null,
      source_fields: ["spend"],
      unit: "currency",
      dependencies: [],
      precision: 2,
    },
    {
      metric: "ctr",
      value: computeCtr(input.clicks, input.impressions),
      operands: { clicks: input.clicks, impressions: input.impressions },
      formula: "clicks / impressions * 100",
      source_fields: ["clicks", "impressions"],
      unit: "ratio_pct",
      dependencies: ["clicks", "impressions"],
      precision: 6,
    },
    {
      metric: "cpc",
      value: computeCpc(input.spend, input.clicks),
      operands: { spend: input.spend, clicks: input.clicks },
      formula: "spend / clicks",
      source_fields: ["spend", "clicks"],
      unit: "currency",
      dependencies: ["spend", "clicks"],
      precision: 6,
    },
    {
      metric: "cpm",
      value: computeCpm(input.spend, input.impressions),
      operands: { spend: input.spend, impressions: input.impressions },
      formula: "spend / impressions * 1000",
      source_fields: ["spend", "impressions"],
      unit: "currency",
      dependencies: ["spend", "impressions"],
      precision: 6,
    },
    {
      metric: "cost_per_result",
      value: computeCostPerResult(input.spend, input.results),
      operands: { spend: input.spend, results: input.results },
      formula: "spend / results",
      source_fields: ["spend", "results"],
      unit: "currency",
      dependencies: ["spend", "results"],
      precision: 6,
    },
  ];

  for (const spec of specs) {
    const metric = normalizeCanonicalMetric(spec.metric);
    let { integrity, reason } = integrityFor(input.quality, input.entity_id, metric);
    // Dependência comprometida: CPC/CPM sem spend verificável
    if (
      (metric === "cpc" || metric === "cpm" || metric === "cost_per_result") &&
      input.spend == null
    ) {
      integrity = "NOT_VERIFIABLE";
      reason = "dependency_spend_absent";
    }
    out.push({
      metric_id: `reg:${input.entity_level}:${input.entity_id}:${metric}`,
      metric,
      ...base,
      source_fields: spec.source_fields,
      operands: spec.operands,
      formula: spec.formula,
      value: spec.value,
      value_present: spec.value != null,
      unit: spec.unit,
      precision: spec.precision,
      dependencies: spec.dependencies,
      integrity,
      integrity_reason: reason,
    });
  }
}

/** Registro determinístico de métricas (estágio C) — independente da IA. */
export function buildMetricRegistry(
  payload: NexMetaAnalysisV1,
  quality: MetaDataQualityReport,
): MetricRegistryEntry[] {
  const out: MetricRegistryEntry[] = [];
  const period = payload.period ?? { since: null, until: null, timezone: "America/Sao_Paulo" };
  const account = payload.account;
  if (account?.id) {
    const metrics = (account as { metrics?: Record<string, unknown> }).metrics ?? {};
    pushEntityMetrics(out, {
      entity_level: "account",
      entity_id: String(account.id),
      ...(account.name ? { entity_name: account.name } : {}),
      period_since: period.since ?? null,
      period_until: period.until ?? null,
      timezone: period.timezone ?? "America/Sao_Paulo",
      impressions: num(metrics.impressions),
      clicks: num(metrics.clicks),
      spend: num(metrics.spend),
      results: num(metrics.results),
      quality,
    });
  }

  for (const campaign of payload.campaigns ?? []) {
    const campaignRow = campaign as {
      id: string;
      name?: string;
      metrics?: Record<string, unknown>;
      insights?: Record<string, unknown>;
    };
    const m = campaignRow.metrics ?? campaignRow.insights ?? {};
    pushEntityMetrics(out, {
      entity_level: "campaign",
      entity_id: String(campaignRow.id),
      ...(campaignRow.name ? { entity_name: campaignRow.name } : {}),
      period_since: period.since ?? null,
      period_until: period.until ?? null,
      timezone: period.timezone ?? "America/Sao_Paulo",
      impressions: num(m.impressions),
      clicks: num(m.clicks),
      spend: num(m.spend),
      results: num(m.results),
      quality,
    });
  }

  return out;
}

export function registryByEntityMetric(
  registry: MetricRegistryEntry[],
): Map<string, MetricRegistryEntry> {
  const map = new Map<string, MetricRegistryEntry>();
  for (const row of registry) {
    map.set(`${row.entity_id}::${row.metric}`, row);
  }
  return map;
}
