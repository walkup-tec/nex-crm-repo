import { z } from "zod";
import type { DataQualityStatus, MetaDataQualityReport } from "@/lib/meta-data-quality";
import type { NexMetaAnalysisV1 } from "@/lib/meta-export";
import { computeCtr } from "@/lib/meta-metrics";

export const METRIC_TRACEABILITY_VERSION = "1.0";

const BLOCKING_STATES = new Set<DataQualityStatus>(["FAIL", "WARNING", "NOT_VERIFIABLE"]);

/** Sinônimos → canônico (sem expandir para derivadas). */
const METRIC_SYNONYMS: Record<string, string> = {
  result: "results",
  resultados: "results",
  resultado: "results",
  conversao: "results",
  investimento: "spend",
  gasto: "spend",
  cliques: "clicks",
  click: "clicks",
  impressoes: "impressions",
  impressões: "impressions",
  alcance: "reach",
  frequencia: "frequency",
  frequência: "frequency",
  cpr: "cost_per_result",
  custo_por_resultado: "cost_per_result",
  costperresult: "cost_per_result",
};

/**
 * Dependências matemáticas reais.
 * CTR NÃO depende de spend/results.
 * CPC depende de spend+clicks; CPM de spend+impressions; CPR de spend+results.
 */
export const METRIC_DEPENDENCIES: Record<string, string[]> = {
  ctr: ["clicks", "impressions"],
  cpc: ["spend", "clicks"],
  cpm: ["spend", "impressions"],
  cost_per_result: ["spend", "results"],
  frequency: ["impressions", "reach"],
  clicks: [],
  impressions: [],
  reach: [],
  spend: [],
  results: [],
};

export type TraceCalculationType = "DIRECT" | "RATIO" | "AGGREGATION" | "OTHER";

export const traceCalculationSchema = z.object({
  type: z.enum(["DIRECT", "RATIO", "AGGREGATION", "OTHER"]),
  formula: z.string().min(1),
  inputs: z.record(z.union([z.number(), z.null()])).default({}),
  result: z.union([z.number(), z.null()]),
  participant_entity_ids: z.array(z.string()).optional(),
  coverage: z.enum(["full", "partial", "unknown"]).optional(),
  comparable: z.boolean().optional(),
  currency: z.string().nullable().optional(),
  unit: z.string().nullable().optional(),
  precision: z.number().nullable().optional(),
  rounding: z.string().nullable().optional(),
  result_event: z.string().nullable().optional(),
  action_type: z.string().nullable().optional(),
  attribution: z.string().nullable().optional(),
});

export const traceValidationSchema = z.object({
  status: z.enum(["PASS", "WARNING", "FAIL", "NOT_VERIFIABLE"]),
  dependencies: z.array(z.string()).default([]),
  check_codes: z.array(z.string()).default([]),
  reason: z.string().nullable().optional(),
});

export const metricTraceRecordSchema = z.object({
  trace_id: z.string().min(1),
  entity_level: z.enum(["account", "campaign", "adset", "ad"]),
  entity_id: z.string().min(1),
  metric: z.string().min(1),
  source: z.literal("META_MARKETING_API").default("META_MARKETING_API"),
  source_level: z.enum(["account", "campaign", "adset", "ad"]),
  source_field: z.string().min(1),
  period: z.object({
    since: z.string().nullable(),
    until: z.string().nullable(),
  }),
  calculation: traceCalculationSchema,
  validation: traceValidationSchema,
  used_by: z.array(z.string()).default([]),
});

export type MetricTraceRecord = z.infer<typeof metricTraceRecordSchema>;

export const metricTraceabilitySchema = z.object({
  version: z.string().default(METRIC_TRACEABILITY_VERSION),
  records: z.array(metricTraceRecordSchema).default([]),
});

export type MetricTraceability = z.infer<typeof metricTraceabilitySchema>;

export function normalizeCanonicalMetric(raw: string): string {
  const key = raw
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return METRIC_SYNONYMS[key] ?? key;
}

export function dependenciesForMetric(metricRaw: string): string[] {
  const metric = normalizeCanonicalMetric(metricRaw);
  return METRIC_DEPENDENCIES[metric] ?? [];
}

export function integrityChecksForMetric(metricRaw: string): string[] {
  const metric = normalizeCanonicalMetric(metricRaw);
  return [metric, ...dependenciesForMetric(metric)];
}

export function buildCompromisedMetricIndex(report: MetaDataQualityReport) {
  const byEntity = new Map<string, Map<string, { code: string; state: DataQualityStatus }>>();
  const accountWide = new Map<string, { code: string; state: DataQualityStatus }>();

  for (const check of report.checks) {
    if (!BLOCKING_STATES.has(check.state)) continue;
    const metric = normalizeCanonicalMetric(check.metric);
    const entry = { code: check.code, state: check.state };
    // Indexa apenas a métrica canônica do check — sem espalhar para CTR/CPC.
    if (check.level === "account" || !check.entity_id) {
      accountWide.set(metric, entry);
      continue;
    }
    if (!byEntity.has(check.entity_id)) byEntity.set(check.entity_id, new Map());
    byEntity.get(check.entity_id)!.set(metric, entry);
  }

  return { byEntity, accountWide };
}

export function metricIntegrityForEntity(
  index: ReturnType<typeof buildCompromisedMetricIndex>,
  entityId: string,
  metricRaw: string,
): { blocked: boolean; metric: string; code: string | null; state: DataQualityStatus | null } {
  for (const candidate of integrityChecksForMetric(metricRaw)) {
    const local = index.byEntity.get(entityId)?.get(candidate);
    if (local) return { blocked: true, metric: candidate, code: local.code, state: local.state };
    const account = index.accountWide.get(candidate);
    if (account) return { blocked: true, metric: candidate, code: account.code, state: account.state };
  }
  return { blocked: false, metric: normalizeCanonicalMetric(metricRaw), code: null, state: null };
}

export function metricIntegrityForAccountClaim(
  index: ReturnType<typeof buildCompromisedMetricIndex>,
  metricRaw: string,
): { blocked: boolean; metric: string; code: string | null; state: DataQualityStatus | null } {
  for (const candidate of integrityChecksForMetric(metricRaw)) {
    const account = index.accountWide.get(candidate);
    if (account) return { blocked: true, metric: candidate, code: account.code, state: account.state };
  }
  return { blocked: false, metric: normalizeCanonicalMetric(metricRaw), code: null, state: null };
}

function insightsForEntity(payload: NexMetaAnalysisV1, level: string, entityId: string) {
  if (level === "campaign") return payload.campaigns.find((row) => row.id === entityId)?.insights ?? null;
  if (level === "adset") return payload.adsets.find((row) => row.id === entityId)?.insights ?? null;
  if (level === "ad") return payload.ads.find((row) => row.id === entityId)?.insights ?? null;
  return null;
}

function entityPresent(payload: NexMetaAnalysisV1, level: string, entityId: string): boolean {
  if (level === "account") return payload.account.id === entityId;
  if (level === "campaign") return payload.campaigns.some((row) => row.id === entityId);
  if (level === "adset") return payload.adsets.some((row) => row.id === entityId);
  if (level === "ad") return payload.ads.some((row) => row.id === entityId);
  return false;
}

const SIMPLE_AVERAGE_CTR_RE =
  /\b(ctr\s+m[eé]dio|m[eé]dia\s+(simples\s+)?(de\s+)?ctr|average\s+ctr|mean\s+ctr)\b/i;

export function mentionsSimpleAverageCtr(text: string): boolean {
  return SIMPLE_AVERAGE_CTR_RE.test(text);
}

export function mentionsNumericClaim(text: string): boolean {
  return /\d+([.,]\d+)?\s*%?/.test(text) || /\b(ctr|cpc|cpm|cpr|investimento|impress|clique)/i.test(text);
}

export type TraceValidationIssue = {
  trace_id: string;
  reason: string;
};

export function validateMetricTraceRecord(
  record: MetricTraceRecord,
  payload: NexMetaAnalysisV1,
  quality: MetaDataQualityReport,
): TraceValidationIssue[] {
  const issues: TraceValidationIssue[] = [];
  const metric = normalizeCanonicalMetric(record.metric);
  const integrity = buildCompromisedMetricIndex(quality);

  if (record.source !== "META_MARKETING_API") {
    issues.push({ trace_id: record.trace_id, reason: "source_not_meta" });
  }

  if (!entityPresent(payload, record.entity_level, record.entity_id)) {
    issues.push({ trace_id: record.trace_id, reason: `entity_missing:${record.entity_id}` });
  }

  if (record.entity_level !== "account") {
    for (const dep of integrityChecksForMetric(metric)) {
      const hit = metricIntegrityForEntity(integrity, record.entity_id, dep);
      if (hit.blocked && hit.state) {
        // Só bloqueia o próprio registro se a dependência real estiver comprometida.
        if (integrityChecksForMetric(metric).includes(hit.metric) || hit.metric === metric) {
          if (record.validation.status === "PASS") {
            issues.push({
              trace_id: record.trace_id,
              reason: `validation_pass_but_dependency_compromised:${hit.metric}:${hit.state}`,
            });
          }
        }
      }
    }
  }

  if (record.calculation.type === "DIRECT") {
    const insights = insightsForEntity(payload, record.source_level, record.entity_id);
    if (!insights && record.entity_level !== "account") {
      issues.push({ trace_id: record.trace_id, reason: "insights_absent" });
    }
  }

  if (metric === "ctr" && record.calculation.type === "RATIO") {
    const clicks = record.calculation.inputs.clicks;
    const impressions = record.calculation.inputs.impressions;
    if (typeof clicks !== "number" || typeof impressions !== "number" || impressions <= 0) {
      issues.push({ trace_id: record.trace_id, reason: "ctr_ratio_inputs_invalid" });
    } else {
      const expected = computeCtr(clicks, impressions);
      if (
        expected != null &&
        typeof record.calculation.result === "number" &&
        Math.abs(expected - record.calculation.result) > 0.05
      ) {
        issues.push({ trace_id: record.trace_id, reason: "ctr_ratio_result_mismatch" });
      }
    }
  }

  if (metric === "ctr" && record.calculation.type === "AGGREGATION") {
    const participants = record.calculation.participant_entity_ids ?? [];
    if (!participants.length) {
      issues.push({ trace_id: record.trace_id, reason: "aggregation_missing_participants" });
    }
    if (record.calculation.coverage !== "full") {
      issues.push({ trace_id: record.trace_id, reason: "aggregation_coverage_not_full" });
    }
    if (record.calculation.comparable === false) {
      issues.push({ trace_id: record.trace_id, reason: "aggregation_not_comparable" });
    }
    // Proíbe média simples: fórmula deve ser ratio de totais.
    if (!/\(?\s*clicks\s*\/\s*impressions/i.test(record.calculation.formula) && !/sum\(clicks\).*sum\(impressions\)/i.test(record.calculation.formula)) {
      issues.push({ trace_id: record.trace_id, reason: "aggregation_not_weighted_ctr" });
    }

    let clicksTotal = 0;
    let impressionsTotal = 0;
    let seen = 0;
    for (const id of participants) {
      const campaign = payload.campaigns.find((row) => row.id === id);
      const clicks = campaign?.insights?.clicks;
      const impressions = campaign?.insights?.impressions;
      if (clicks == null || impressions == null) {
        issues.push({ trace_id: record.trace_id, reason: `aggregation_missing_insights:${id}` });
        continue;
      }
      const clickHit = metricIntegrityForEntity(integrity, id, "clicks");
      const imprHit = metricIntegrityForEntity(integrity, id, "impressions");
      if (clickHit.blocked || imprHit.blocked) {
        issues.push({
          trace_id: record.trace_id,
          reason: `aggregation_component_compromised:${id}`,
        });
        continue;
      }
      clicksTotal += clicks;
      impressionsTotal += impressions;
      seen += 1;
    }
    if (seen !== participants.length) {
      issues.push({ trace_id: record.trace_id, reason: "aggregation_incomplete_coverage" });
    } else {
      const expected = computeCtr(clicksTotal, impressionsTotal);
      const claimedClicks = record.calculation.inputs.clicks;
      const claimedImpr = record.calculation.inputs.impressions;
      if (typeof claimedClicks === "number" && claimedClicks !== clicksTotal) {
        issues.push({ trace_id: record.trace_id, reason: "aggregation_clicks_mismatch" });
      }
      if (typeof claimedImpr === "number" && claimedImpr !== impressionsTotal) {
        issues.push({ trace_id: record.trace_id, reason: "aggregation_impressions_mismatch" });
      }
      if (
        expected != null &&
        typeof record.calculation.result === "number" &&
        Math.abs(expected - record.calculation.result) > 0.05
      ) {
        issues.push({ trace_id: record.trace_id, reason: "aggregation_ctr_result_mismatch" });
      }
    }
  }

  if (record.validation.status !== "PASS" && record.validation.status !== "WARNING") {
    // FAIL/NOT_VERIFIABLE não podem sustentar conclusão APPROVED (avaliado no consumidor).
  }

  return issues;
}

export function parseMetricTraceability(raw: unknown): {
  ok: boolean;
  value: MetricTraceability;
  error?: string;
} {
  if (raw == null) {
    return { ok: true, value: { version: METRIC_TRACEABILITY_VERSION, records: [] } };
  }
  const parsed = metricTraceabilitySchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      value: { version: METRIC_TRACEABILITY_VERSION, records: [] },
      error: parsed.error.issues[0]?.message ?? "traceability_schema_invalid",
    };
  }
  return { ok: true, value: parsed.data };
}

export function indexTracesById(traceability: MetricTraceability): Map<string, MetricTraceRecord> {
  return new Map(traceability.records.map((row) => [row.trace_id, row]));
}

export function validateTraceIdsForClaim(input: {
  claimId: string;
  metricsUsed: string[];
  traceIds: string[];
  text: string;
  requireTraces: boolean;
  traces: Map<string, MetricTraceRecord>;
  payload: NexMetaAnalysisV1;
  quality: MetaDataQualityReport;
}): string[] {
  const reasons: string[] = [];
  const metrics = input.metricsUsed.map(normalizeCanonicalMetric);

  if (mentionsSimpleAverageCtr(input.text)) {
    reasons.push("simple_average_ctr_forbidden");
  }

  const needsTrace =
    input.requireTraces ||
    mentionsNumericClaim(input.text) ||
    metrics.some((m) => ["ctr", "cpc", "cpm", "cost_per_result", "spend", "results"].includes(m));

  if (needsTrace && input.traceIds.length === 0) {
    reasons.push("missing_metric_traceability");
  }

  for (const traceId of input.traceIds) {
    const record = input.traces.get(traceId);
    if (!record) {
      reasons.push(`trace_id_not_found:${traceId}`);
      continue;
    }
    const recordIssues = validateMetricTraceRecord(record, input.payload, input.quality);
    for (const issue of recordIssues) reasons.push(issue.reason);
    if (record.validation.status === "FAIL" || record.validation.status === "NOT_VERIFIABLE") {
      reasons.push(`trace_validation_${record.validation.status.toLowerCase()}:${traceId}`);
    }
    const recordMetric = normalizeCanonicalMetric(record.metric);
    if (metrics.length && !metrics.includes(recordMetric) && !metrics.some((m) => dependenciesForMetric(m).includes(recordMetric))) {
      // allow dependency traces (clicks/impressions for ctr)
      if (!metrics.some((m) => integrityChecksForMetric(m).includes(recordMetric))) {
        reasons.push(`trace_metric_mismatch:${traceId}:${recordMetric}`);
      }
    }
    if (!record.used_by.includes(input.claimId) && record.used_by.length > 0) {
      // soft: prefer used_by linkage; if used_by empty, still ok if referenced
    }
    if (record.used_by.length && !record.used_by.includes(input.claimId)) {
      reasons.push(`trace_not_linked_to_claim:${traceId}`);
    }
  }

  // Toda métrica usada precisa de ao menos um trace correspondente (ou de dependência).
  if (needsTrace && input.traceIds.length) {
    for (const metric of metrics) {
      const covered = input.traceIds.some((id) => {
        const record = input.traces.get(id);
        if (!record) return false;
        const rm = normalizeCanonicalMetric(record.metric);
        return rm === metric || integrityChecksForMetric(metric).includes(rm);
      });
      if (!covered) reasons.push(`metric_without_trace:${metric}`);
    }
  }

  return [...new Set(reasons)];
}

/** Monta CTR agregado ponderado a partir de campanhas do payload (helper de teste/auditoria). */
export function buildWeightedCtrAggregationTrace(input: {
  traceId: string;
  claimId: string;
  payload: NexMetaAnalysisV1;
  quality: MetaDataQualityReport;
  campaignIds: string[];
}): MetricTraceRecord | null {
  const integrity = buildCompromisedMetricIndex(input.quality);
  let clicks = 0;
  let impressions = 0;
  for (const id of input.campaignIds) {
    const campaign = input.payload.campaigns.find((row) => row.id === id);
    if (!campaign?.insights) return null;
    if (campaign.insights.clicks == null || campaign.insights.impressions == null) return null;
    if (metricIntegrityForEntity(integrity, id, "clicks").blocked) return null;
    if (metricIntegrityForEntity(integrity, id, "impressions").blocked) return null;
    clicks += campaign.insights.clicks;
    impressions += campaign.insights.impressions;
  }
  const result = computeCtr(clicks, impressions);
  if (result == null) return null;
  return {
    trace_id: input.traceId,
    entity_level: "account",
    entity_id: input.payload.account.id,
    metric: "ctr",
    source: "META_MARKETING_API",
    source_level: "campaign",
    source_field: "insights.clicks+insights.impressions",
    period: {
      since: input.payload.period.since,
      until: input.payload.period.until,
    },
    calculation: {
      type: "AGGREGATION",
      formula: "(sum(clicks) / sum(impressions)) * 100",
      inputs: { clicks, impressions },
      result,
      participant_entity_ids: input.campaignIds,
      coverage: "full",
      comparable: true,
      unit: "percent",
      precision: 6,
      rounding: "half_up_6dp",
    },
    validation: {
      status: "PASS",
      dependencies: ["clicks", "impressions"],
      check_codes: [],
      reason: null,
    },
    used_by: [input.claimId],
  };
}
