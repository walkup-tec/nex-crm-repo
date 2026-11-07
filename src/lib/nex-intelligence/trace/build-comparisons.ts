import type { MetaDataQualityReport } from "@/lib/nex-intelligence/quality/validate-export";
import type { NexMetaAnalysisV1 } from "@/lib/meta-export";
import type { AnalysisObjectives } from "@/lib/nex-intelligence/goals/types";
import { composeGoalAnalysis } from "@/lib/nex-intelligence/goals/compose";
import {
  METRIC_TRACEABILITY_VERSION,
  normalizeCanonicalMetric,
  recomputeMetricFromMeta,
  type MetricTraceRecord,
  type MetricTraceability,
} from "@/lib/nex-intelligence/trace/index";
import {
  BACKEND_CATALOG_METRICS,
  buildBackendMetricTraceCatalog,
  hasPassScalarTrace,
  type BackendCatalogEntityLevel,
} from "@/lib/nex-intelligence/trace/build-catalog";

export type ValidatedComparisonRef = {
  comparison_ref: string;
  kind: "ENTITY" | "PERIOD";
  entity_level: BackendCatalogEntityLevel;
  entity_id: string;
  other_entity_id?: string;
  metric: string;
  baseline_period?: string;
  current_period?: string;
  operator: "delta_pct" | "delta_abs";
  left_value: number;
  right_value: number;
  delta: number;
  result_event: string | null;
};

const DEFAULT_COMPARISON_METRICS = [
  "results",
  "cost_per_result",
  "spend",
  "ctr",
  "cpc",
  "cpm",
  "impressions",
  "clicks",
] as const;

function resultEventFor(
  payload: NexMetaAnalysisV1,
  level: BackendCatalogEntityLevel,
  entityId: string,
): string | null {
  if (level === "campaign") {
    return payload.campaigns.find((row) => row.id === entityId)?.result_metric?.trim() || null;
  }
  if (level === "adset") {
    const adset = payload.adsets.find((row) => row.id === entityId);
    if (!adset) return null;
    return (
      payload.campaigns.find((row) => row.id === adset.campaign_id)?.result_metric?.trim() || null
    );
  }
  const ad = payload.ads.find((row) => row.id === entityId);
  if (!ad) return null;
  return (
    payload.campaigns.find((row) => row.id === ad.campaign_id)?.result_metric?.trim() || null
  );
}

function isTechnicalResultEvent(value: string | null | undefined): value is string {
  if (!value) return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (/^convers[oõ]es$/i.test(trimmed)) return false;
  return true;
}

function metricsForObjectives(objectives?: AnalysisObjectives | null): string[] {
  if (!objectives?.selectedGoals?.length) return [...DEFAULT_COMPARISON_METRICS];
  const composed = composeGoalAnalysis(objectives);
  const set = new Set(composed.requiredMetrics.map(normalizeCanonicalMetric));
  for (const metric of DEFAULT_COMPARISON_METRICS) set.add(metric);
  return [...set].filter((metric) =>
    (BACKEND_CATALOG_METRICS as readonly string[]).includes(metric),
  );
}

function needsCompatibleResultEvent(metric: string): boolean {
  return metric === "results" || metric === "cost_per_result";
}

function entityPairs(
  payload: NexMetaAnalysisV1,
  level: BackendCatalogEntityLevel,
): Array<[string, string]> {
  const ids =
    level === "campaign"
      ? payload.campaigns.map((row) => row.id)
      : level === "adset"
        ? payload.adsets.map((row) => row.id)
        : payload.ads.map((row) => row.id);
  const pairs: Array<[string, string]> = [];
  for (let i = 0; i < ids.length; i += 1) {
    for (let j = i + 1; j < ids.length; j += 1) {
      pairs.push([ids[i]!, ids[j]!]);
    }
  }
  return pairs;
}

function splitDailyWindow(dates: string[]): { baseline: string[]; current: string[] } | null {
  const unique = [...new Set(dates)].sort();
  if (unique.length < 4) return null;
  const mid = Math.floor(unique.length / 2);
  const baseline = unique.slice(0, mid);
  const current = unique.slice(mid);
  if (!baseline.length || !current.length) return null;
  return { baseline, current };
}

function sumDailyMetric(
  rows: Array<{ date: string; spend: number; impressions: number; clicks: number; results: number }>,
  dates: string[],
  metric: string,
): number | null {
  const set = new Set(dates);
  const scoped = rows.filter((row) => set.has(row.date));
  if (!scoped.length) return null;
  const spend = scoped.reduce((acc, row) => acc + row.spend, 0);
  const impressions = scoped.reduce((acc, row) => acc + row.impressions, 0);
  const clicks = scoped.reduce((acc, row) => acc + row.clicks, 0);
  const results = scoped.reduce((acc, row) => acc + row.results, 0);
  switch (metric) {
    case "spend":
      return spend;
    case "impressions":
      return impressions;
    case "clicks":
      return clicks;
    case "results":
      return results;
    case "ctr":
      return impressions > 0 ? (clicks / impressions) * 100 : null;
    case "cpc":
      return clicks > 0 ? spend / clicks : null;
    case "cpm":
      return impressions > 0 ? (spend / impressions) * 1000 : null;
    case "cost_per_result":
      return results > 0 ? spend / results : null;
    default:
      return null;
  }
}

function deltaPct(left: number, right: number): number | null {
  if (!Number.isFinite(left) || !Number.isFinite(right) || left === 0) return null;
  return ((right - left) / Math.abs(left)) * 100;
}

/**
 * Comparações determinísticas (entidade×entidade e período) anexadas ao catálogo.
 * A IA só referencia comparison_ref; não inventa evidência E2/E3.
 */
export function buildValidatedComparisonRecords(input: {
  payload: NexMetaAnalysisV1;
  quality: MetaDataQualityReport;
  objectives?: AnalysisObjectives | null;
  /** Catálogo scalar pré-computado; se omitido, é gerado aqui. */
  scalarCatalog?: MetricTraceability;
}): { records: MetricTraceRecord[]; refs: ValidatedComparisonRef[] } {
  const metrics = metricsForObjectives(input.objectives);
  const records: MetricTraceRecord[] = [];
  const refs: ValidatedComparisonRef[] = [];
  const preferredEvent = isTechnicalResultEvent(input.objectives?.resultEventKey)
    ? input.objectives!.resultEventKey!.trim()
    : null;
  const scalarCatalog =
    input.scalarCatalog ?? buildBackendMetricTraceCatalog(input.payload, input.quality);

  for (const level of ["campaign", "adset", "ad"] as const) {
    for (const [leftId, rightId] of entityPairs(input.payload, level)) {
      const leftEvent = resultEventFor(input.payload, level, leftId);
      const rightEvent = resultEventFor(input.payload, level, rightId);

      for (const metricRaw of metrics) {
        const metric = normalizeCanonicalMetric(metricRaw);
        if (needsCompatibleResultEvent(metric)) {
          if (!isTechnicalResultEvent(leftEvent) || !isTechnicalResultEvent(rightEvent)) continue;
          if (leftEvent !== rightEvent) continue;
          if (preferredEvent && leftEvent !== preferredEvent) continue;
        }

        // Simetria: sem scalar PASS dos dois lados, não emitir nx-cmp (evita E2 fantasma).
        if (
          !hasPassScalarTrace(scalarCatalog, level, leftId, metric) ||
          !hasPassScalarTrace(scalarCatalog, level, rightId, metric)
        ) {
          continue;
        }

        const left = recomputeMetricFromMeta(input.payload, level, leftId, metric);
        const right = recomputeMetricFromMeta(input.payload, level, rightId, metric);
        if (!left || left.result == null || !right || right.result == null) continue;

        const delta = right.result - left.result;
        const pct = deltaPct(left.result, right.result);
        const operator = pct == null ? "delta_abs" : "delta_pct";
        const comparisonValue = pct ?? delta;
        const comparison_ref = `nx-cmp-entity-${level}-${leftId}-vs-${rightId}-${metric}`;

        records.push({
          trace_id: comparison_ref,
          entity_level: level,
          entity_id: leftId,
          metric,
          source: "META_MARKETING_API",
          source_level: level,
          source_field: `insights.${metric}`,
          period: {
            since: input.payload.period.since,
            until: input.payload.period.until,
          },
          calculation: {
            type: "OTHER",
            formula: `${metric}(${rightId}) - ${metric}(${leftId})`,
            inputs: {
              left_value: left.result,
              right_value: right.result,
              delta,
              delta_pct: pct,
            },
            result: comparisonValue,
            participant_entity_ids: [leftId, rightId],
            coverage: "full",
            comparable: true,
            unit: metric === "ctr" ? "percent" : null,
            precision: 6,
            rounding: "half_up_6dp",
            result_event: leftEvent,
          },
          validation: {
            status: "PASS",
            dependencies: [metric],
            check_codes: [],
            reason: null,
          },
          used_by: [],
        });

        refs.push({
          comparison_ref,
          kind: "ENTITY",
          entity_level: level,
          entity_id: leftId,
          other_entity_id: rightId,
          metric,
          operator,
          left_value: left.result,
          right_value: right.result,
          delta: comparisonValue,
          result_event: leftEvent,
        });
      }
    }
  }

  // Período: primeira metade vs segunda metade dos daily_insights por campanha.
  for (const campaign of input.payload.campaigns) {
    const daily = campaign.daily_insights ?? [];
    if (daily.length < 4) continue;
    const window = splitDailyWindow(daily.map((row) => row.date));
    if (!window) continue;
    const event = campaign.result_metric?.trim() || null;
    if (preferredEvent && isTechnicalResultEvent(event) && event !== preferredEvent) continue;

    for (const metricRaw of metrics) {
      const metric = normalizeCanonicalMetric(metricRaw);
      if (needsCompatibleResultEvent(metric) && !isTechnicalResultEvent(event)) continue;
      if (!hasPassScalarTrace(scalarCatalog, "campaign", campaign.id, metric)) continue;

      const baselineValue = sumDailyMetric(daily, window.baseline, metric);
      const currentValue = sumDailyMetric(daily, window.current, metric);
      if (baselineValue == null || currentValue == null) continue;

      const delta = currentValue - baselineValue;
      const pct = deltaPct(baselineValue, currentValue);
      const operator = pct == null ? "delta_abs" : "delta_pct";
      const comparisonValue = pct ?? delta;
      const baselinePeriod = `${window.baseline[0]}..${window.baseline[window.baseline.length - 1]}`;
      const currentPeriod = `${window.current[0]}..${window.current[window.current.length - 1]}`;
      const comparison_ref = `nx-cmp-period-campaign-${campaign.id}-${metric}-${window.baseline[0]}-${window.current[window.current.length - 1]}`;

      records.push({
        trace_id: comparison_ref,
        entity_level: "campaign",
        entity_id: campaign.id,
        metric,
        source: "META_MARKETING_API",
        source_level: "campaign",
        source_field: `daily_insights.${metric}`,
        period: {
          since: input.payload.period.since,
          until: input.payload.period.until,
        },
        calculation: {
          type: "OTHER",
          formula: `${metric}(${currentPeriod}) - ${metric}(${baselinePeriod})`,
          inputs: {
            left_value: baselineValue,
            right_value: currentValue,
            delta,
            delta_pct: pct,
          },
          result: comparisonValue,
          participant_entity_ids: [campaign.id],
          coverage: "full",
          comparable: true,
          unit: metric === "ctr" ? "percent" : null,
          precision: 6,
          rounding: "half_up_6dp",
          result_event: event,
        },
        validation: {
          status: "PASS",
          dependencies: [metric],
          check_codes: [],
          reason: null,
        },
        used_by: [],
      });

      refs.push({
        comparison_ref,
        kind: "PERIOD",
        entity_level: "campaign",
        entity_id: campaign.id,
        metric,
        baseline_period: baselinePeriod,
        current_period: currentPeriod,
        operator,
        left_value: baselineValue,
        right_value: currentValue,
        delta: comparisonValue,
        result_event: event,
      });
    }
  }

  return { records, refs };
}

/** Limita o prompt às comparações mais relevantes aos objetivos (sem perder o catálogo completo). */
export function prioritizeComparisonsForPrompt(
  refs: ValidatedComparisonRef[],
  objectives?: AnalysisObjectives | null,
  limit = 40,
): ValidatedComparisonRef[] {
  const preferred = new Set(
    metricsForObjectives(objectives).map((metric) => normalizeCanonicalMetric(metric)),
  );
  const ranked = [...refs].sort((a, b) => {
    const aPref = preferred.has(a.metric) ? 0 : 1;
    const bPref = preferred.has(b.metric) ? 0 : 1;
    if (aPref !== bPref) return aPref - bPref;
    const levelRank = (level: string) =>
      level === "campaign" ? 0 : level === "adset" ? 1 : 2;
    const levelDiff = levelRank(a.entity_level) - levelRank(b.entity_level);
    if (levelDiff !== 0) return levelDiff;
    return Math.abs(b.delta) - Math.abs(a.delta);
  });
  return ranked.slice(0, limit);
}

export function buildBackendTraceabilityWithComparisons(input: {
  payload: NexMetaAnalysisV1;
  quality: MetaDataQualityReport;
  objectives?: AnalysisObjectives | null;
}): { catalog: MetricTraceability; comparisons: ValidatedComparisonRef[] } {
  const base = buildBackendMetricTraceCatalog(input.payload, input.quality);
  const { records, refs } = buildValidatedComparisonRecords({
    ...input,
    scalarCatalog: base,
  });
  const byId = new Map(base.records.map((row) => [row.trace_id, row]));
  for (const row of records) byId.set(row.trace_id, row);
  return {
    catalog: {
      version: METRIC_TRACEABILITY_VERSION,
      records: [...byId.values()],
    },
    comparisons: prioritizeComparisonsForPrompt(refs, input.objectives),
  };
}

export function summarizeAvailableComparisonsForPrompt(
  refs: ValidatedComparisonRef[],
): string {
  if (!refs.length) {
    return [
      "available_comparisons: []",
      "Sem comparações E2/E3 verificáveis neste export. NÃO invente comparison_ref. Propostas operacionais sem comparação devem permanecer como investigação/MONITOR, nunca como ação E3 aprovável.",
    ].join("\n");
  }
  return [
    "available_comparisons (use APENAS estes comparison_ref em PERIOD_COMPARISON / ENTITY_COMPARISON / STRATEGIC_TEST / CAUSAL_HYPOTHESIS):",
    JSON.stringify(refs, null, 2),
    "NÃO invente comparison_ref. Sem comparison_ref listado aqui, não publique ação operacional E3.",
  ].join("\n");
}

export { isTechnicalResultEvent };
