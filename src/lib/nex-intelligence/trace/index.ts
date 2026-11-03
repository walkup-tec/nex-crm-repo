import { z } from "zod";
import type { DataQualityStatus, MetaDataQualityReport } from "@/lib/nex-intelligence/quality/validate-export";
import type { NexMetaAnalysisV1 } from "@/lib/meta-export";
import { computeCostPerResult, computeCpc, computeCpm, computeCtr } from "@/lib/nex-intelligence/metrics/formulas";
import {
  NEX_INTELLIGENCE_ENGINE_VERSION,
  NEX_INTELLIGENCE_TRACEABILITY_VERSION,
} from "@/lib/nex-intelligence/versions";

export const METRIC_TRACEABILITY_VERSION = NEX_INTELLIGENCE_TRACEABILITY_VERSION;
export const METRIC_TRACEABILITY_ENGINE = NEX_INTELLIGENCE_ENGINE_VERSION;

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

function entityName(payload: NexMetaAnalysisV1, level: string, entityId: string): string | null {
  if (level === "account") return payload.account.name || null;
  if (level === "campaign") return payload.campaigns.find((row) => row.id === entityId)?.name ?? null;
  if (level === "adset") return payload.adsets.find((row) => row.id === entityId)?.name ?? null;
  if (level === "ad") return payload.ads.find((row) => row.id === entityId)?.name ?? null;
  return null;
}

function entityPresent(payload: NexMetaAnalysisV1, level: string, entityId: string): boolean {
  if (level === "account") return payload.account.id === entityId;
  if (level === "campaign") return payload.campaigns.some((row) => row.id === entityId);
  if (level === "adset") return payload.adsets.some((row) => row.id === entityId);
  if (level === "ad") return payload.ads.some((row) => row.id === entityId);
  return false;
}

export type NamedEntityHit = {
  id: string;
  level: "campaign" | "adset" | "ad";
  name: string;
};

/** Nomes de entidades citados no texto (maior nome primeiro para evitar colisão parcial). */
export function findNamedEntitiesInText(text: string, payload: NexMetaAnalysisV1): NamedEntityHit[] {
  const lower = text.toLowerCase();
  const candidates: NamedEntityHit[] = [
    ...payload.campaigns.map((row) => ({ id: row.id, level: "campaign" as const, name: row.name })),
    ...payload.adsets.map((row) => ({ id: row.id, level: "adset" as const, name: row.name })),
    ...payload.ads.map((row) => ({ id: row.id, level: "ad" as const, name: row.name })),
  ]
    .filter((row) => row.name.trim().length >= 3)
    .sort((a, b) => b.name.length - a.name.length);

  const hits: NamedEntityHit[] = [];
  for (const candidate of candidates) {
    const key = candidate.name.toLowerCase();
    if (!lower.includes(key)) continue;
    // Já capturou nome mais longo que contém este (ordenados do maior para o menor).
    if (hits.some((hit) => hit.name.toLowerCase().includes(key))) continue;
    hits.push(candidate);
  }
  return hits;
}

type MetaDerived = {
  inputs: Record<string, number | null>;
  result: number | null;
};

/** Recalcula métrica derivada a partir dos insights Meta da entidade do trace. */
export function recomputeMetricFromMeta(
  payload: NexMetaAnalysisV1,
  level: string,
  entityId: string,
  metricRaw: string,
): MetaDerived | null {
  const metric = normalizeCanonicalMetric(metricRaw);
  const insights = insightsForEntity(payload, level, entityId);
  if (!insights) return null;

  if (metric === "ctr") {
    return {
      inputs: { clicks: insights.clicks, impressions: insights.impressions },
      result: computeCtr(insights.clicks, insights.impressions),
    };
  }
  if (metric === "cpc") {
    return {
      inputs: { spend: insights.spend, clicks: insights.clicks },
      result: computeCpc(insights.spend, insights.clicks),
    };
  }
  if (metric === "cpm") {
    return {
      inputs: { spend: insights.spend, impressions: insights.impressions },
      result: computeCpm(insights.spend, insights.impressions),
    };
  }
  if (metric === "cost_per_result") {
    return {
      inputs: { spend: insights.spend, results: insights.results },
      result: computeCostPerResult(insights.spend, insights.results),
    };
  }
  if (metric === "clicks" || metric === "impressions" || metric === "spend" || metric === "results" || metric === "reach" || metric === "frequency") {
    const value = (insights as Record<string, number | null>)[metric] ?? null;
    return { inputs: { [metric]: value }, result: value };
  }
  return null;
}

function numbersClose(a: number | null | undefined, b: number | null | undefined, tol = 0.05): boolean {
  if (a == null || b == null) return a == null && b == null;
  return Math.abs(a - b) <= tol;
}

/** Status determinístico — não confia no PASS informado pela IA. */
export function computeDeterministicTraceStatus(
  record: MetricTraceRecord,
  payload: NexMetaAnalysisV1,
  quality: MetaDataQualityReport,
): { status: DataQualityStatus; reasons: string[] } {
  const reasons: string[] = [];
  const metric = normalizeCanonicalMetric(record.metric);
  const integrity = buildCompromisedMetricIndex(quality);

  if (record.period.since !== payload.period.since || record.period.until !== payload.period.until) {
    reasons.push("trace_period_mismatch_execution");
  }

  if (!entityPresent(payload, record.entity_level, record.entity_id)) {
    reasons.push(`entity_missing:${record.entity_id}`);
  }

  if (record.entity_level !== "account" && record.source_level !== record.entity_level) {
    reasons.push(`source_level_mismatch:${record.source_level}!=${record.entity_level}`);
  }

  for (const dep of integrityChecksForMetric(metric)) {
    if (record.entity_level === "account") {
      const hit = metricIntegrityForAccountClaim(integrity, dep);
      if (hit.blocked && hit.state) reasons.push(`dependency_compromised:${hit.metric}:${hit.state}`);
    } else {
      const hit = metricIntegrityForEntity(integrity, record.entity_id, dep);
      if (hit.blocked && hit.state) reasons.push(`dependency_compromised:${hit.metric}:${hit.state}`);
    }
  }

  // Backend recalcula sempre que a métrica for derivável — inclusive OTHER forjado pela IA.
  if (
    record.calculation.type === "RATIO" ||
    record.calculation.type === "DIRECT" ||
    record.calculation.type === "OTHER"
  ) {
    const recomputed = recomputeMetricFromMeta(payload, record.entity_level, record.entity_id, metric);
    if (!recomputed) {
      if (record.calculation.type !== "OTHER") {
        reasons.push("meta_insights_unavailable_for_recompute");
      } else {
        reasons.push("forged_other_trace_not_recomputable");
      }
    } else {
      for (const [key, value] of Object.entries(recomputed.inputs)) {
        const claimed = record.calculation.inputs[key];
        if (typeof claimed === "number" || claimed === null) {
          if (!numbersClose(claimed, value, metric === "spend" ? 0.02 : 0.05)) {
            reasons.push(`meta_input_mismatch:${key}`);
          }
        }
      }
      if (
        typeof record.calculation.result === "number" &&
        recomputed.result != null &&
        !numbersClose(record.calculation.result, recomputed.result, 0.05)
      ) {
        reasons.push("meta_result_mismatch");
      }
    }
  }

  if (reasons.some((r) => r.startsWith("dependency_compromised"))) {
    return { status: "NOT_VERIFIABLE", reasons };
  }
  if (reasons.length) return { status: "FAIL", reasons };
  return { status: "PASS", reasons: [] };
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

  // Recálculo determinístico a partir do payload Meta desta execução (não confia no PASS da IA).
  const deterministic = computeDeterministicTraceStatus(record, payload, quality);
  for (const reason of deterministic.reasons) {
    issues.push({ trace_id: record.trace_id, reason });
  }
  if (record.validation.status === "PASS" && deterministic.status !== "PASS") {
    issues.push({
      trace_id: record.trace_id,
      reason: `ai_pass_overridden:${deterministic.status}`,
    });
  }
  if (deterministic.status === "FAIL" || deterministic.status === "NOT_VERIFIABLE") {
    issues.push({
      trace_id: record.trace_id,
      reason: `deterministic_${deterministic.status.toLowerCase()}`,
    });
  }

  if (record.calculation.type === "DIRECT") {
    const insights = insightsForEntity(payload, record.source_level, record.entity_id);
    if (!insights && record.entity_level !== "account") {
      issues.push({ trace_id: record.trace_id, reason: "insights_absent" });
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
    if (
      !/\(?\s*clicks\s*\/\s*impressions/i.test(record.calculation.formula) &&
      !/sum\(clicks\).*sum\(impressions\)/i.test(record.calculation.formula)
    ) {
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

  return issues;
}

export type MetricTraceParseIssue = {
  path: string;
  message: string;
};

export function parseMetricTraceability(raw: unknown): {
  ok: boolean;
  value: MetricTraceability;
  error?: string;
  issues?: MetricTraceParseIssue[];
} {
  if (raw == null) {
    return { ok: true, value: { version: METRIC_TRACEABILITY_VERSION, records: [] }, issues: [] };
  }
  const parsed = metricTraceabilitySchema.safeParse(raw);
  if (parsed.success) {
    return { ok: true, value: parsed.data, issues: [] };
  }

  // Recuperação parcial: aceita records individuais válidos quando o bloco falha.
  const issues: MetricTraceParseIssue[] = parsed.error.issues.map((issue) => ({
    path: issue.path.length ? `metric_traceability.${issue.path.join(".")}` : "metric_traceability",
    message: issue.message,
  }));
  const version =
    raw && typeof raw === "object" && typeof (raw as { version?: unknown }).version === "string"
      ? String((raw as { version: string }).version)
      : METRIC_TRACEABILITY_VERSION;
  const rawRecords =
    raw && typeof raw === "object" && Array.isArray((raw as { records?: unknown }).records)
      ? ((raw as { records: unknown[] }).records)
      : null;

  if (!rawRecords) {
    return {
      ok: false,
      value: { version: METRIC_TRACEABILITY_VERSION, records: [] },
      error: issues[0] ? `${issues[0].path}: ${issues[0].message}` : "traceability_schema_invalid",
      issues,
    };
  }

  const records: MetricTraceRecord[] = [];
  for (let i = 0; i < rawRecords.length; i++) {
    const item = metricTraceRecordSchema.safeParse(rawRecords[i]);
    if (item.success) {
      records.push(item.data);
      continue;
    }
    for (const issue of item.error.issues) {
      issues.push({
        path: `metric_traceability.records[${i}]${issue.path.length ? `.${issue.path.join(".")}` : ""}`,
        message: issue.message,
      });
    }
  }

  if (records.length === 0 && rawRecords.length > 0) {
    return {
      ok: false,
      value: { version, records: [] },
      error: issues[0] ? `${issues[0].path}: ${issues[0].message}` : "traceability_records_invalid",
      issues,
    };
  }

  return {
    ok: true,
    value: { version, records },
    error: issues.length ? issues.map((i) => `${i.path}: ${i.message}`).join("; ") : undefined,
    issues,
  };
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
  claimEntityId?: string | null;
  claimLevel?: "account" | "campaign" | "adset" | "ad";
}): string[] {
  const reasons: string[] = [];
  const metrics = input.metricsUsed.map(normalizeCanonicalMetric);
  const namedHits = findNamedEntitiesInText(input.text, input.payload);
  const claimEntityId = input.claimEntityId ?? null;
  const claimLevel = input.claimLevel ?? "account";

  if (mentionsSimpleAverageCtr(input.text)) {
    reasons.push("simple_average_ctr_forbidden");
  }

  // Nome citado no texto deve coincidir com o entity_id da conclusão.
  if (claimEntityId && claimLevel !== "account" && namedHits.length) {
    const mismatch = namedHits.find((hit) => hit.id !== claimEntityId);
    if (mismatch) {
      reasons.push(`claim_text_entity_mismatch:${mismatch.name}->${mismatch.id}!=${claimEntityId}`);
    }
  }

  // Se o texto cita um nome e o claim não tem entity_id, exige vínculo explícito.
  if (!claimEntityId && namedHits.length === 1 && claimLevel !== "account") {
    reasons.push(`claim_missing_entity_for_named:${namedHits[0]!.name}`);
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

    // Não confia no status da IA: usa apenas o determinístico.
    const deterministic = computeDeterministicTraceStatus(record, input.payload, input.quality);
    if (deterministic.status === "FAIL" || deterministic.status === "NOT_VERIFIABLE") {
      reasons.push(`trace_validation_${deterministic.status.toLowerCase()}:${traceId}`);
    }

    // Trace deve apontar para a mesma entidade da conclusão (exceto agregação de conta).
    if (claimEntityId && claimLevel !== "account") {
      if (record.entity_id !== claimEntityId) {
        reasons.push(`trace_entity_id_mismatch:${traceId}:${record.entity_id}!=${claimEntityId}`);
      }
      if (record.entity_level !== claimLevel) {
        reasons.push(`trace_entity_level_mismatch:${traceId}:${record.entity_level}!=${claimLevel}`);
      }
    }

    // Nome no texto vs entidade do trace.
    if (namedHits.length) {
      const wrong = namedHits.find((hit) => hit.id !== record.entity_id && record.entity_level !== "account");
      if (wrong && record.calculation.type !== "AGGREGATION") {
        reasons.push(`trace_text_entity_mismatch:${wrong.name}->${record.entity_id}`);
      }
    }

    const expectedName = entityName(input.payload, record.entity_level, record.entity_id);
    if (
      expectedName &&
      claimEntityId === record.entity_id &&
      namedHits.length === 1 &&
      namedHits[0]!.id === claimEntityId &&
      namedHits[0]!.name.toLowerCase() !== expectedName.toLowerCase()
    ) {
      reasons.push(`entity_name_mismatch:${namedHits[0]!.name}!=${expectedName}`);
    }

    const recordMetric = normalizeCanonicalMetric(record.metric);
    if (
      metrics.length &&
      !metrics.includes(recordMetric) &&
      !metrics.some((m) => dependenciesForMetric(m).includes(recordMetric))
    ) {
      if (!metrics.some((m) => integrityChecksForMetric(m).includes(recordMetric))) {
        reasons.push(`trace_metric_mismatch:${traceId}:${recordMetric}`);
      }
    }
    // used_by é preenchido pelo backend após rebind; ausência não rejeita (IA não é fonte).
    if (
      record.used_by.length &&
      !record.used_by.includes(input.claimId) &&
      !record.trace_id.startsWith("nx-tr-")
    ) {
      reasons.push(`trace_not_linked_to_claim:${traceId}`);
    }
  }

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
