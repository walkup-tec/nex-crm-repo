import { z } from "zod";
import type { MetaDataQualityReport, DataQualityStatus } from "@/lib/meta-data-quality";
import type { NexMetaAnalysisV1 } from "@/lib/meta-export";
import {
  buildCompromisedMetricIndex,
  indexTracesById,
  mentionsNumericClaim,
  mentionsSimpleAverageCtr,
  metricIntegrityForAccountClaim,
  metricIntegrityForEntity,
  normalizeCanonicalMetric,
  parseMetricTraceability,
  validateTraceIdsForClaim,
  type MetricTraceability,
} from "@/lib/meta-metric-traceability";

export {
  buildCompromisedMetricIndex,
  metricIntegrityForAccountClaim,
  metricIntegrityForEntity,
  normalizeCanonicalMetric,
} from "@/lib/meta-metric-traceability";

export const META_AI_RECOMMENDATION_ENGINE = "1.1.5";

export type RecommendationLevel = "campaign" | "adset" | "ad";
export type ClaimLevel = "account" | RecommendationLevel;
export type RecommendationVerdict = "APPROVED" | "REJECTED" | "NEEDS_REVIEW";
export type RecommendationActionKind =
  | "scale_budget"
  | "pause"
  | "replace_creative"
  | "test"
  | "monitor"
  | "other";
export type ClaimKind = "descriptive" | "performance_judgment" | "indirect_recommendation";

const EXTERNAL_COMMERCIAL_MARKERS =
  /\b(crm|vendas?|receita|roi\b|roas\b|faturamento|agendamento|whatsapp\s+oficial\s+do\s+crm|lead\s+qualificado\s+no\s+crm|ticket\s+m[eé]dio)\b/i;

const PERFORMANCE_JUDGMENT_RE =
  /\b(desempenho\s+insuficiente|performance\s+(ruim|insuficiente|fraca)|convers[aã]o\s+insatisfat[oó]ria|inefici[eê]n(te|cia)|retorno\s+(inadequado|baixo|ruim)|baixo\s+retorno|custo\s+por\s+resultado\s+(alto|elevado|ruim)|cpr\s+(alto|elevado)|n[aã]o\s+est[aá]\s+performando|resultados?\s+(ruins|fracos|insuficientes)|investimento\s+ineficiente|sem\s+retorno\s+adequado)\b/i;

const INDIRECT_RECOMMENDATION_RE =
  /\b(recomend(a|amos|a-se)|suger(e|imos|e-se)|vale\s+(a\s+pena\s+)?(aumentar|escalar|pausar|investir)|deve(-se)?\s+(aumentar|escalar|pausar|investir)|aument(ar|e)\s+(o\s+)?or[cç]amento|escal(ar|e)\s+(a\s+)?(campanha|conjunto|investimento)|paus(ar|e)\s+(a\s+)?(campanha|conjunto|an[uú]ncio)|substitu(ir|a)\s+(o\s+)?criativo|investir\s+mais)\b/i;

const METRIC_MENTION_PATTERNS: Array<{ metric: string; re: RegExp }> = [
  { metric: "results", re: /\b(resultados?|convers[aã]o|leads?\s+gerados?)\b/i },
  { metric: "cost_per_result", re: /\b(custo\s+por\s+resultado|cpr|cost\s*per\s*result)\b/i },
  { metric: "spend", re: /\b(investimento|spend|gasto|or[cç]amento\s+consumido)\b/i },
  { metric: "ctr", re: /\bctr\b/i },
  { metric: "cpc", re: /\bcpc\b/i },
  { metric: "cpm", re: /\bcpm\b/i },
  { metric: "frequency", re: /\b(frequ[eê]ncia|satura)/i },
  { metric: "impressions", re: /\bimpress[oõ]es\b/i },
  { metric: "reach", re: /\balcance\b/i },
  { metric: "clicks", re: /\b(cliques?|clicks?)\b/i },
];

export const structuredRecommendationSchema = z.object({
  id: z.string().min(1),
  entity_id: z.string().min(1),
  level: z.enum(["campaign", "adset", "ad"]),
  indicators_used: z.array(z.string().min(1)).min(1),
  evidence: z.array(z.string().min(1)).default([]),
  hypothesis: z.string().nullable().optional(),
  confidence: z.enum(["low", "medium", "high"]),
  recommended_action: z.string().min(1),
  action_kind: z.enum(["scale_budget", "pause", "replace_creative", "test", "monitor", "other"]),
  validation_criterion: z.string().min(1),
  trace_ids: z.array(z.string()).optional().default([]),
  arbitrary_targets: z
    .array(
      z.object({
        metric: z.string().min(1),
        value: z.number(),
        foundation: z.string().nullable().optional(),
      }),
    )
    .optional()
    .default([]),
  uses_external_commercial_data: z.boolean().optional().default(false),
});

export type StructuredRecommendation = z.infer<typeof structuredRecommendationSchema>;

export const structuredClaimSchema = z.object({
  id: z.string().min(1),
  entity_id: z.string().nullable().optional().default(null),
  level: z.enum(["account", "campaign", "adset", "ad"]).default("account"),
  metrics_used: z.array(z.string()).default([]),
  trace_ids: z.array(z.string()).optional().default([]),
  claim_kind: z.enum(["descriptive", "performance_judgment", "indirect_recommendation"]),
  text: z.string().min(1),
});

export type StructuredClaim = z.infer<typeof structuredClaimSchema>;

export const structuredAnalysisSchema = z.object({
  format: z.string().optional(),
  stage1_markdown: z.string().default(""),
  stage2_markdown: z.string().default(""),
  observations: z.array(z.unknown()).optional().default([]),
  recommendations: z.array(z.unknown()).default([]),
  executive_points: z.array(z.unknown()).optional().default([]),
  stage4_markdown: z.string().default(""),
  metric_traceability: z.unknown().optional(),
});

export type StructuredAnalysisPayload = {
  format?: string;
  stage1_markdown: string;
  stage2_markdown: string;
  observations: StructuredClaim[];
  recommendations: StructuredRecommendation[];
  executive_points: StructuredClaim[];
  stage4_markdown: string;
  metric_traceability: MetricTraceability;
  parse_ok: boolean;
  parse_error?: string;
};

export type ValidatedRecommendation = StructuredRecommendation & {
  verdict: RecommendationVerdict;
  rejection_reasons: string[];
  trace_ids: string[];
  blocked_by: Array<{
    entity_id: string;
    metric: string;
    check_code: string | null;
    state: DataQualityStatus;
  }>;
};

export type ValidatedClaim = StructuredClaim & {
  verdict: RecommendationVerdict;
  rejection_reasons: string[];
  trace_ids: string[];
  blocked_by: Array<{
    entity_id: string;
    metric: string;
    check_code: string | null;
    state: DataQualityStatus;
  }>;
};

export type NarrativeSanitizationAudit = {
  stage2_dropped: number;
  stage4_dropped: number;
  stage2_source: "structured" | "sanitized_markdown" | "empty";
  stage4_source: "structured" | "sanitized_markdown" | "approved_only";
};

export type RecommendationValidationAudit = {
  engine_version: string;
  validated_at: string;
  parse_ok: boolean;
  parse_error?: string;
  regeneration_attempted: boolean;
  recommendations: ValidatedRecommendation[];
  observations: ValidatedClaim[];
  executive_points: ValidatedClaim[];
  published_recommendation_ids: string[];
  rejected_recommendation_ids: string[];
  needs_review_ids: string[];
  narrative_sanitization: NarrativeSanitizationAudit;
  metric_traceability: MetricTraceability;
};

export type ProcessRecommendationsResult = {
  publishedMarkdown: string;
  audit: RecommendationValidationAudit;
  approved: ValidatedRecommendation[];
  rejected: ValidatedRecommendation[];
  needsReview: ValidatedRecommendation[];
};

export function buildEntityIndex(payload: NexMetaAnalysisV1) {
  const campaigns = new Map(payload.campaigns.map((row) => [row.id, row]));
  const adsets = new Map(payload.adsets.map((row) => [row.id, row]));
  const ads = new Map(payload.ads.map((row) => [row.id, row]));
  const nameToId = new Map<string, { id: string; level: RecommendationLevel }>();
  for (const row of payload.campaigns) {
    if (row.name) nameToId.set(row.name.trim().toLowerCase(), { id: row.id, level: "campaign" });
  }
  for (const row of payload.adsets) {
    if (row.name) nameToId.set(row.name.trim().toLowerCase(), { id: row.id, level: "adset" });
  }
  for (const row of payload.ads) {
    if (row.name) nameToId.set(row.name.trim().toLowerCase(), { id: row.id, level: "ad" });
  }
  return { campaigns, adsets, ads, accountId: payload.account.id, nameToId };
}

function entityExists(
  index: ReturnType<typeof buildEntityIndex>,
  level: RecommendationLevel,
  entityId: string,
): boolean {
  if (level === "campaign") return index.campaigns.has(entityId);
  if (level === "adset") return index.adsets.has(entityId);
  return index.ads.has(entityId);
}

function hasArbitraryUnfoundedTargets(rec: StructuredRecommendation): boolean {
  return (rec.arbitrary_targets ?? []).some((target) => !target.foundation || !String(target.foundation).trim());
}

function mentionsArbitraryTargetInText(rec: StructuredRecommendation): boolean {
  const blob = `${rec.recommended_action} ${rec.validation_criterion} ${rec.hypothesis ?? ""}`;
  return /(?:meta|alvo|target|abaixo de|acima de|menor que|maior que)\s*(?:de\s*)?R?\$?\s*\d+([.,]\d+)?/i.test(
    blob,
  );
}

function evidenceSufficient(rec: StructuredRecommendation): boolean {
  const evidences = (rec.evidence ?? []).filter((item) => item.trim().length > 0);
  if (rec.action_kind === "monitor" || rec.action_kind === "test") return evidences.length >= 1;
  if (rec.action_kind === "scale_budget" || rec.action_kind === "pause" || rec.action_kind === "replace_creative") {
    return evidences.length >= 2 && rec.indicators_used.length >= 2;
  }
  return evidences.length >= 1 && rec.indicators_used.length >= 1;
}

function usesExternalCommercial(rec: StructuredRecommendation): boolean {
  if (rec.uses_external_commercial_data) return true;
  const blob = [
    rec.recommended_action,
    rec.validation_criterion,
    rec.hypothesis ?? "",
    ...(rec.evidence ?? []),
  ].join(" ");
  return EXTERNAL_COMMERCIAL_MARKERS.test(blob);
}

export function inferMetricsFromText(text: string): string[] {
  const found = new Set<string>();
  for (const item of METRIC_MENTION_PATTERNS) {
    if (item.re.test(text)) found.add(item.metric);
  }
  if (PERFORMANCE_JUDGMENT_RE.test(text) && found.size === 0) {
    found.add("results");
    found.add("cost_per_result");
  }
  return [...found];
}

export function detectClaimKindFromText(text: string): ClaimKind {
  if (INDIRECT_RECOMMENDATION_RE.test(text)) return "indirect_recommendation";
  if (PERFORMANCE_JUDGMENT_RE.test(text)) return "performance_judgment";
  return "descriptive";
}

export function resolveEntityFromText(
  text: string,
  payload: NexMetaAnalysisV1,
): { entity_id: string | null; level: ClaimLevel } {
  const index = buildEntityIndex(payload);
  for (const id of [...index.campaigns.keys(), ...index.adsets.keys(), ...index.ads.keys()]) {
    if (text.includes(id)) {
      if (index.campaigns.has(id)) return { entity_id: id, level: "campaign" };
      if (index.adsets.has(id)) return { entity_id: id, level: "adset" };
      return { entity_id: id, level: "ad" };
    }
  }
  const lower = text.toLowerCase();
  for (const [name, ref] of index.nameToId) {
    if (name.length >= 3 && lower.includes(name)) return { entity_id: ref.id, level: ref.level };
  }
  return { entity_id: null, level: "account" };
}

export function validateStructuredRecommendation(
  raw: unknown,
  payload: NexMetaAnalysisV1,
  quality: MetaDataQualityReport,
  traces: Map<string, import("@/lib/meta-metric-traceability").MetricTraceRecord> = new Map(),
): ValidatedRecommendation {
  const parsed = structuredRecommendationSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      id: typeof (raw as { id?: unknown })?.id === "string" ? String((raw as { id: string }).id) : "invalid",
      entity_id: "",
      level: "campaign",
      indicators_used: [],
      evidence: [],
      hypothesis: null,
      confidence: "low",
      recommended_action: "",
      action_kind: "other",
      validation_criterion: "",
      trace_ids: [],
      arbitrary_targets: [],
      uses_external_commercial_data: false,
      verdict: "REJECTED",
      rejection_reasons: [`schema_invalid: ${parsed.error.issues.map((i) => i.message).join("; ")}`],
      blocked_by: [],
    };
  }

  const rec = parsed.data;
  const reasons: string[] = [];
  const blockedBy: ValidatedRecommendation["blocked_by"] = [];
  const entities = buildEntityIndex(payload);
  const integrity = buildCompromisedMetricIndex(quality);
  const traceIds = rec.trace_ids ?? [];

  if (!entityExists(entities, rec.level, rec.entity_id)) {
    reasons.push(`entity_not_found:${rec.level}:${rec.entity_id}`);
  }

  for (const indicator of rec.indicators_used) {
    const hit = metricIntegrityForEntity(integrity, rec.entity_id, indicator);
    if (hit.blocked && hit.state) {
      reasons.push(`metric_compromised:${hit.metric}:${hit.state}`);
      blockedBy.push({
        entity_id: rec.entity_id,
        metric: hit.metric,
        check_code: hit.code,
        state: hit.state,
      });
    }
  }

  reasons.push(
    ...validateTraceIdsForClaim({
      claimId: rec.id,
      metricsUsed: rec.indicators_used,
      traceIds,
      text: `${rec.recommended_action} ${rec.evidence.join(" ")}`,
      requireTraces: true,
      traces,
      payload,
      quality,
      claimEntityId: rec.entity_id,
      claimLevel: rec.level,
    }),
  );

  if (rec.action_kind === "scale_budget") {
    const resultsHit = metricIntegrityForEntity(integrity, rec.entity_id, "results");
    const spendHit = metricIntegrityForEntity(integrity, rec.entity_id, "spend");
    const cprHit = metricIntegrityForEntity(integrity, rec.entity_id, "cost_per_result");
    if (resultsHit.blocked || spendHit.blocked || cprHit.blocked) {
      reasons.push("scale_blocked_by_compromised_results_or_spend");
    }
  }

  if (rec.action_kind === "pause" && rec.indicators_used.length < 2) {
    reasons.push("pause_on_single_indicator");
  }

  if (!evidenceSufficient(rec)) {
    reasons.push("insufficient_evidence");
  }

  if (
    hasArbitraryUnfoundedTargets(rec) ||
    (mentionsArbitraryTargetInText(rec) && !(rec.arbitrary_targets ?? []).some((t) => t.foundation))
  ) {
    reasons.push("arbitrary_target_without_foundation");
  }

  if (usesExternalCommercial(rec)) {
    reasons.push("external_commercial_data");
  }

  if (
    /\b(comprovado|prova(do)?|causalidade certa|erro comprovado)\b/i.test(rec.hypothesis ?? "") &&
    (rec.evidence?.length ?? 0) < 2
  ) {
    reasons.push("causality_without_evidence");
  }

  if (
    /\bsatura/i.test(`${rec.recommended_action} ${rec.hypothesis ?? ""}`) &&
    !rec.indicators_used.map(normalizeCanonicalMetric).includes("frequency")
  ) {
    reasons.push("saturation_without_frequency");
  }

  const uniqueReasons = [...new Set(reasons)];
  let verdict: RecommendationVerdict = "APPROVED";
  if (uniqueReasons.length) {
    const softOnly =
      uniqueReasons.every((r) => r === "arbitrary_target_without_foundation") &&
      !uniqueReasons.some(
        (r) =>
          r.startsWith("metric_compromised") || r === "entity_not_found" || r === "external_commercial_data",
      );
    verdict = softOnly ? "NEEDS_REVIEW" : "REJECTED";
  }

  return {
    ...rec,
    trace_ids: traceIds,
    verdict,
    rejection_reasons: uniqueReasons,
    blocked_by: blockedBy,
  };
}

export function validateStructuredClaim(
  raw: unknown,
  payload: NexMetaAnalysisV1,
  quality: MetaDataQualityReport,
  approvedActions: string[] = [],
  traces: Map<string, import("@/lib/meta-metric-traceability").MetricTraceRecord> = new Map(),
): ValidatedClaim {
  const parsed = structuredClaimSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      id: "invalid-claim",
      entity_id: null,
      level: "account",
      metrics_used: [],
      trace_ids: [],
      claim_kind: "descriptive",
      text: "",
      verdict: "REJECTED",
      rejection_reasons: [`schema_invalid: ${parsed.error.issues.map((i) => i.message).join("; ")}`],
      blocked_by: [],
    };
  }

  const claim = parsed.data;
  const reasons: string[] = [];
  const blockedBy: ValidatedClaim["blocked_by"] = [];
  const integrity = buildCompromisedMetricIndex(quality);
  const entities = buildEntityIndex(payload);
  const metrics = (claim.metrics_used.length ? claim.metrics_used : inferMetricsFromText(claim.text)).map(
    normalizeCanonicalMetric,
  );
  const traceIds = claim.trace_ids ?? [];
  const kind =
    claim.claim_kind === "descriptive" && detectClaimKindFromText(claim.text) !== "descriptive"
      ? detectClaimKindFromText(claim.text)
      : claim.claim_kind;

  if (claim.level !== "account" && claim.entity_id) {
    if (!entityExists(entities, claim.level, claim.entity_id)) {
      reasons.push(`entity_not_found:${claim.level}:${claim.entity_id}`);
    }
  }

  if (kind === "indirect_recommendation") {
    const allowed = approvedActions.some(
      (action) => action && claim.text.toLowerCase().includes(action.toLowerCase()),
    );
    if (!allowed) reasons.push("indirect_recommendation_unvalidated");
  }

  if (kind === "performance_judgment" || kind === "descriptive") {
    const scopedEntity = claim.entity_id && claim.level !== "account" ? claim.entity_id : null;

    for (const metric of metrics) {
      if (scopedEntity) {
        const hit = metricIntegrityForEntity(integrity, scopedEntity, metric);
        if (hit.blocked && hit.state) {
          reasons.push(`metric_compromised:${hit.metric}:${hit.state}`);
          blockedBy.push({
            entity_id: scopedEntity,
            metric: hit.metric,
            check_code: hit.code,
            state: hit.state,
          });
        }
      } else {
        const hit = metricIntegrityForAccountClaim(integrity, metric);
        if (hit.blocked && hit.state) {
          reasons.push(`metric_compromised:${hit.metric}:${hit.state}`);
          blockedBy.push({
            entity_id: payload.account.id,
            metric: hit.metric,
            check_code: hit.code,
            state: hit.state,
          });
        }
      }
    }

    // Julgamentos de conversão: só se metrics_used incluir results/spend/CPR (não CTR/CPC).
    if (kind === "performance_judgment" && scopedEntity) {
      for (const metric of metrics) {
        if (!["results", "spend", "cost_per_result"].includes(metric)) continue;
        const hit = metricIntegrityForEntity(integrity, scopedEntity, metric);
        if (hit.blocked && hit.state && !reasons.some((r) => r.includes(`metric_compromised:${hit.metric}`))) {
          reasons.push(`metric_compromised:${hit.metric}:${hit.state}`);
          blockedBy.push({
            entity_id: scopedEntity,
            metric: hit.metric,
            check_code: hit.code,
            state: hit.state,
          });
        }
      }
    }

    if (kind === "performance_judgment" && !scopedEntity) {
      const judgmentMetrics = metrics.length ? metrics : ["results", "cost_per_result", "spend"];
      for (const metric of judgmentMetrics) {
        // CTR/CPC não disparam bloqueio account-wide por results/spend de campanhas.
        if (metric === "ctr" || metric === "cpc" || metric === "cpm" || metric === "clicks" || metric === "impressions") {
          continue;
        }
        for (const [entityId, map] of integrity.byEntity) {
          const canonical = normalizeCanonicalMetric(metric);
          if (map.has(canonical)) {
            reasons.push(`account_judgment_depends_on_compromised_entity:${entityId}:${canonical}`);
          }
        }
      }
    }
  }

  reasons.push(
    ...validateTraceIdsForClaim({
      claimId: claim.id,
      metricsUsed: metrics,
      traceIds,
      text: claim.text,
      requireTraces: mentionsNumericClaim(claim.text) || mentionsSimpleAverageCtr(claim.text),
      traces,
      payload,
      quality,
      claimEntityId: claim.entity_id,
      claimLevel: claim.level,
    }),
  );

  if (EXTERNAL_COMMERCIAL_MARKERS.test(claim.text)) {
    reasons.push("external_commercial_data");
  }

  return {
    ...claim,
    claim_kind: kind,
    metrics_used: metrics,
    trace_ids: traceIds,
    verdict: reasons.length ? "REJECTED" : "APPROVED",
    rejection_reasons: [...new Set(reasons)],
    blocked_by: blockedBy,
  };
}

export function validateRecommendationList(
  items: unknown[],
  payload: NexMetaAnalysisV1,
  quality: MetaDataQualityReport,
  traces: Map<string, import("@/lib/meta-metric-traceability").MetricTraceRecord> = new Map(),
): ValidatedRecommendation[] {
  return items.map((item) => validateStructuredRecommendation(item, payload, quality, traces));
}

export function validateClaimList(
  items: unknown[],
  payload: NexMetaAnalysisV1,
  quality: MetaDataQualityReport,
  approvedActions: string[] = [],
  traces: Map<string, import("@/lib/meta-metric-traceability").MetricTraceRecord> = new Map(),
): ValidatedClaim[] {
  return items.map((item) => validateStructuredClaim(item, payload, quality, approvedActions, traces));
}

export function extractJsonObject(text: string): unknown | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    /* continue */
  }
  const fence = trimmed.match(/```(?:json|nex-intelligence)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) {
    try {
      return JSON.parse(fence[1].trim());
    } catch {
      /* continue */
    }
  }
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(trimmed.slice(start, end + 1));
    } catch {
      return null;
    }
  }
  return null;
}

function parseClaimArray(items: unknown[]): StructuredClaim[] {
  const out: StructuredClaim[] = [];
  for (const item of items) {
    const parsed = structuredClaimSchema.safeParse(item);
    if (parsed.success) out.push(parsed.data);
  }
  return out;
}

export function parseStructuredAnalysis(text: string): StructuredAnalysisPayload {
  const emptyTrace: MetricTraceability = { version: "1.0", records: [] };
  const raw = extractJsonObject(text);
  if (!raw || typeof raw !== "object") {
    return {
      stage1_markdown: "",
      stage2_markdown: "",
      observations: [],
      recommendations: [],
      executive_points: [],
      stage4_markdown: "",
      metric_traceability: emptyTrace,
      parse_ok: false,
      parse_error: "structured_json_missing",
    };
  }
  const base = structuredAnalysisSchema.safeParse(raw);
  if (!base.success) {
    return {
      stage1_markdown: "",
      stage2_markdown: "",
      observations: [],
      recommendations: [],
      executive_points: [],
      stage4_markdown: "",
      metric_traceability: emptyTrace,
      parse_ok: false,
      parse_error: `structured_schema_invalid: ${base.error.issues[0]?.message ?? "unknown"}`,
    };
  }
  const traceParsed = parseMetricTraceability(base.data.metric_traceability);
  const recommendations: StructuredRecommendation[] = [];
  for (const item of base.data.recommendations) {
    const parsed = structuredRecommendationSchema.safeParse(item);
    if (parsed.success) recommendations.push(parsed.data);
  }
  if (base.data.recommendations.length > 0 && recommendations.length === 0) {
    return {
      stage1_markdown: base.data.stage1_markdown,
      stage2_markdown: base.data.stage2_markdown,
      observations: [],
      recommendations: [],
      executive_points: [],
      stage4_markdown: base.data.stage4_markdown,
      metric_traceability: emptyTrace,
      parse_ok: false,
      parse_error: "recommendations_failed_schema",
    };
  }
  if (!traceParsed.ok) {
    return {
      stage1_markdown: base.data.stage1_markdown,
      stage2_markdown: base.data.stage2_markdown,
      observations: [],
      recommendations: [],
      executive_points: [],
      stage4_markdown: base.data.stage4_markdown,
      metric_traceability: emptyTrace,
      parse_ok: false,
      parse_error: `metric_traceability_invalid: ${traceParsed.error}`,
    };
  }
  return {
    format: base.data.format,
    stage1_markdown: base.data.stage1_markdown,
    stage2_markdown: base.data.stage2_markdown,
    observations: parseClaimArray(base.data.observations ?? []),
    recommendations,
    executive_points: parseClaimArray(base.data.executive_points ?? []),
    stage4_markdown: base.data.stage4_markdown,
    metric_traceability: traceParsed.value,
    parse_ok: true,
  };
}

function splitNarrativeUnits(text: string): string[] {
  return text
    .split(/\n{2,}|(?<=[.!?])\s+(?=[A-ZÀ-Ú])/)
    .map((unit) => unit.trim())
    .filter(Boolean);
}

/**
 * Sanitiza narrativa livre: remove julgamentos/recomendações indiretas
 * dependentes de métricas comprometidas na entidade referida.
 */
export function sanitizeNarrativeText(
  text: string,
  payload: NexMetaAnalysisV1,
  quality: MetaDataQualityReport,
  approvedActions: string[] = [],
): { text: string; dropped: number } {
  if (!text.trim()) return { text: "", dropped: 0 };
  const units = splitNarrativeUnits(text);
  const kept: string[] = [];
  let dropped = 0;

  for (const unit of units) {
    const resolved = resolveEntityFromText(unit, payload);
    const kind = detectClaimKindFromText(unit);
    const metrics = inferMetricsFromText(unit);
    const validated = validateStructuredClaim(
      {
        id: `narr-${kept.length + dropped + 1}`,
        entity_id: resolved.entity_id,
        level: resolved.level,
        metrics_used: metrics,
        claim_kind: kind,
        text: unit,
      },
      payload,
      quality,
      approvedActions,
    );
    if (validated.verdict === "APPROVED") kept.push(unit);
    else dropped += 1;
  }

  return { text: kept.join("\n\n"), dropped };
}

function renderApprovedMarkdown(approved: ValidatedRecommendation[]): string {
  if (!approved.length) {
    return "_Nenhuma recomendação aprovada após validação determinística pós-IA._";
  }
  return approved
    .map((rec, index) => {
      return [
        `### ${index + 1}. ${rec.recommended_action}`,
        `- Entidade: ${rec.level} \`${rec.entity_id}\``,
        `- Indicadores: ${rec.indicators_used.join(", ")}`,
        `- Evidências: ${rec.evidence.join(" | ")}`,
        `- Hipótese: ${rec.hypothesis ?? "—"}`,
        `- Confiança: ${rec.confidence}`,
        `- Critério de validação: ${rec.validation_criterion}`,
        `- Status: APPROVED`,
      ].join("\n");
    })
    .join("\n\n");
}

function renderClaimsMarkdown(claims: ValidatedClaim[], emptyLabel: string): string {
  const approved = claims.filter((c) => c.verdict === "APPROVED");
  if (!approved.length) return emptyLabel;
  return approved.map((claim) => `- ${claim.text}`).join("\n");
}

function renderLimitations(
  quality: MetaDataQualityReport,
  rejected: ValidatedRecommendation[],
  needsReview: ValidatedRecommendation[],
  rejectedClaims: ValidatedClaim[],
  parseError?: string,
  narrativeNote?: string,
): string {
  const lines: string[] = [];
  if (parseError) {
    lines.push(
      `- Falha estrutural na resposta da IA: \`${parseError}\`. Recomendações não verificadas não foram publicadas.`,
    );
  }
  if (quality.status !== "PASS") {
    lines.push(
      `- data_quality.status = ${quality.status}; métricas afetadas: ${quality.affected_metrics.join(", ") || "n/d"}.`,
    );
  }
  if (narrativeNote) lines.push(`- ${narrativeNote}`);
  for (const rec of [...rejected, ...needsReview]) {
    lines.push(
      `- Recomendação \`${rec.id}\` (${rec.verdict}) omitida: ${rec.rejection_reasons.join("; ") || "sem justificativa"}.`,
    );
  }
  for (const claim of rejectedClaims) {
    if (!claim.id || claim.id === "invalid-claim") continue;
    lines.push(
      `- Conclusão/trecho \`${claim.id}\` omitido: ${claim.rejection_reasons.join("; ") || "sem justificativa"}.`,
    );
  }
  if (!lines.length) return "_Sem limitações adicionais registradas._";
  return lines.join("\n");
}

function composeExecutiveFromApproved(
  approvedClaims: ValidatedClaim[],
  approvedRecs: ValidatedRecommendation[],
  sanitizedFallback: string,
): string {
  const diagnosis = approvedClaims.map((c) => `- ${c.text}`);
  const actions = approvedRecs.map((rec) => `- ${rec.recommended_action} (\`${rec.entity_id}\`)`);
  const parts = [
    diagnosis.length ? diagnosis.join("\n") : sanitizedFallback || "_Sem conclusões verificáveis disponíveis._",
    "",
    "**Recomendações aprovadas (somente estas são ações válidas):**",
    actions.length ? actions.join("\n") : "- Nenhuma recomendação aprovada.",
  ];
  return parts.join("\n");
}

export function composePublishedMarkdown(input: {
  stage1: string;
  stage2: string;
  stage4: string;
  approved: ValidatedRecommendation[];
  rejected: ValidatedRecommendation[];
  needsReview: ValidatedRecommendation[];
  approvedObservations?: ValidatedClaim[];
  rejectedClaims?: ValidatedClaim[];
  quality: MetaDataQualityReport;
  parseError?: string;
  narrativeNote?: string;
}): string {
  const stage2Body =
    input.approvedObservations && input.approvedObservations.length
      ? renderClaimsMarkdown(input.approvedObservations, "_Sem observações verificáveis._")
      : input.stage2.trim() || "_Análise descritiva indisponível._";

  return [
    "## Etapa 1 — Validação dos dados",
    input.stage1.trim() || `_Status determinístico: ${input.quality.status}._`,
    "",
    "## Etapa 2 — Análise independente",
    stage2Body,
    "",
    "## Etapa 3 — Recomendações",
    "### Recomendações aprovadas",
    renderApprovedMarkdown(input.approved),
    "",
    "### Limitações relevantes",
    renderLimitations(
      input.quality,
      input.rejected,
      input.needsReview,
      input.rejectedClaims ?? [],
      input.parseError,
      input.narrativeNote,
    ),
    "",
    "## Etapa 4 — Resumo executivo",
    input.stage4.trim() || "_Resumo indisponível._",
  ].join("\n");
}

export async function processMetaAiRecommendations(input: {
  rawText: string;
  payload: NexMetaAnalysisV1;
  quality: MetaDataQualityReport;
  now?: string;
  regenerate?: (invalid: ValidatedRecommendation[]) => Promise<string>;
}): Promise<ProcessRecommendationsResult> {
  const now = input.now ?? new Date().toISOString();
  const parsed = parseStructuredAnalysis(input.rawText);

  if (!parsed.parse_ok) {
    const stage1 = sanitizeNarrativeText(parsed.stage1_markdown, input.payload, input.quality).text;
    const audit: RecommendationValidationAudit = {
      engine_version: META_AI_RECOMMENDATION_ENGINE,
      validated_at: now,
      parse_ok: false,
      parse_error: parsed.parse_error,
      regeneration_attempted: false,
      recommendations: [],
      observations: [],
      executive_points: [],
      published_recommendation_ids: [],
      rejected_recommendation_ids: [],
      needs_review_ids: [],
      narrative_sanitization: {
        stage2_dropped: 0,
        stage4_dropped: 0,
        stage2_source: "empty",
        stage4_source: "approved_only",
      },
      metric_traceability: parsed.metric_traceability,
    };
    return {
      publishedMarkdown: composePublishedMarkdown({
        stage1,
        stage2: "_Sem observações verificáveis — resposta estruturada inválida._",
        stage4: composeExecutiveFromApproved([], [], ""),
        approved: [],
        rejected: [],
        needsReview: [],
        quality: input.quality,
        parseError: parsed.parse_error,
        narrativeNote: "Markdown bruto da IA não foi publicado.",
      }),
      audit,
      approved: [],
      rejected: [],
      needsReview: [],
    };
  }

  const traces = indexTracesById(parsed.metric_traceability);
  let validated = validateRecommendationList(parsed.recommendations, input.payload, input.quality, traces);
  let regenerationAttempted = false;

  const invalid = validated.filter((row) => row.verdict !== "APPROVED");
  if (invalid.length && input.regenerate) {
    regenerationAttempted = true;
    try {
      const regeneratedText = await input.regenerate(invalid);
      const regeneratedParsed = extractJsonObject(regeneratedText);
      let candidates: unknown[] = [];
      if (Array.isArray(regeneratedParsed)) {
        candidates = regeneratedParsed;
      } else if (regeneratedParsed && typeof regeneratedParsed === "object") {
        const row = regeneratedParsed as { recommendations?: unknown[] };
        if (Array.isArray(row.recommendations)) candidates = row.recommendations;
      }
      const revalidated = validateRecommendationList(candidates, input.payload, input.quality, traces);
      const byId = new Map(validated.map((row) => [row.id, row]));
      for (const row of revalidated) byId.set(row.id, row);
      for (const original of invalid) {
        const current = byId.get(original.id);
        if (!current || current.verdict !== "APPROVED") byId.set(original.id, current ?? original);
      }
      validated = [...byId.values()];
    } catch {
      regenerationAttempted = true;
    }
  }

  const approved = validated.filter((row) => row.verdict === "APPROVED");
  const rejected = validated.filter((row) => row.verdict === "REJECTED");
  const needsReview = validated.filter((row) => row.verdict === "NEEDS_REVIEW");
  const approvedActions = approved.map((row) => row.recommended_action);

  let observations = validateClaimList(
    parsed.observations,
    input.payload,
    input.quality,
    approvedActions,
    traces,
  );
  let executivePoints = validateClaimList(
    parsed.executive_points,
    input.payload,
    input.quality,
    approvedActions,
    traces,
  );

  let stage2Source: NarrativeSanitizationAudit["stage2_source"] = "structured";
  let stage4Source: NarrativeSanitizationAudit["stage4_source"] = "structured";
  let stage2Dropped = observations.filter((c) => c.verdict !== "APPROVED").length;
  let stage4Dropped = executivePoints.filter((c) => c.verdict !== "APPROVED").length;

  let stage2Text = renderClaimsMarkdown(
    observations.filter((c) => c.verdict === "APPROVED"),
    "",
  );
  if (!parsed.observations.length) {
    const sanitized = sanitizeNarrativeText(
      parsed.stage2_markdown,
      input.payload,
      input.quality,
      approvedActions,
    );
    stage2Text = sanitized.text;
    stage2Dropped = sanitized.dropped;
    stage2Source = sanitized.text ? "sanitized_markdown" : "empty";
  } else if (!stage2Text) {
    stage2Source = "empty";
    stage2Text = "_Sem observações verificáveis após validação de integridade._";
  }

  const approvedExec = executivePoints.filter((c) => c.verdict === "APPROVED");
  let stage4Text = "";
  if (parsed.executive_points.length) {
    stage4Text = composeExecutiveFromApproved(approvedExec, approved, "");
    stage4Source = "structured";
  } else {
    const sanitized = sanitizeNarrativeText(
      parsed.stage4_markdown,
      input.payload,
      input.quality,
      approvedActions,
    );
    stage4Dropped = sanitized.dropped;
    stage4Text = composeExecutiveFromApproved([], approved, sanitized.text);
    stage4Source = sanitized.text ? "sanitized_markdown" : "approved_only";
  }

  // stage1: sanitiza julgamentos indevidos, preserva diagnóstico de data_quality.
  const stage1Sanitized = sanitizeNarrativeText(
    parsed.stage1_markdown,
    input.payload,
    input.quality,
    approvedActions,
  );

  const rejectedClaims = [
    ...observations.filter((c) => c.verdict !== "APPROVED"),
    ...executivePoints.filter((c) => c.verdict !== "APPROVED"),
  ];

  const audit: RecommendationValidationAudit = {
    engine_version: META_AI_RECOMMENDATION_ENGINE,
    validated_at: now,
    parse_ok: true,
    regeneration_attempted: regenerationAttempted,
    recommendations: validated,
    observations,
    executive_points: executivePoints,
    published_recommendation_ids: approved.map((row) => row.id),
    rejected_recommendation_ids: rejected.map((row) => row.id),
    needs_review_ids: needsReview.map((row) => row.id),
    narrative_sanitization: {
      stage2_dropped: stage2Dropped,
      stage4_dropped: stage4Dropped,
      stage2_source: stage2Source,
      stage4_source: stage4Source,
    },
    metric_traceability: parsed.metric_traceability,
  };

  return {
    publishedMarkdown: composePublishedMarkdown({
      stage1: stage1Sanitized.text || `_Status determinístico: ${input.quality.status}._`,
      stage2: stage2Text || "_Sem observações verificáveis._",
      stage4: stage4Text,
      approved,
      rejected,
      needsReview,
      approvedObservations:
        stage2Source === "structured" ? observations.filter((c) => c.verdict === "APPROVED") : undefined,
      rejectedClaims,
      quality: input.quality,
      narrativeNote:
        stage2Dropped || stage4Dropped
          ? `Trechos narrativos omitidos por integridade (etapa2=${stage2Dropped}, etapa4=${stage4Dropped}).`
          : undefined,
    }),
    audit,
    approved,
    rejected,
    needsReview,
  };
}

export function regenerationUserPrompt(invalid: ValidatedRecommendation[], payload: NexMetaAnalysisV1) {
  return [
    "Regenere APENAS as recomendações inválidas abaixo em JSON válido.",
    'Formato: { "recommendations": [ ...mesmo schema estruturado... ] }',
    "Não invente recomendações substitutas sem evidência Meta verificável.",
    "Não use métricas comprometidas nem dados comerciais externos.",
    "",
    "Inválidas:",
    JSON.stringify(
      invalid.map((row) => ({
        id: row.id,
        verdict: row.verdict,
        reasons: row.rejection_reasons,
        previous: row,
      })),
      null,
      2,
    ),
    "",
    "Contexto resumido da conta:",
    JSON.stringify({
      account_id: payload.account.id,
      campaign_ids: payload.campaigns.map((c) => c.id),
      adset_ids: payload.adsets.map((a) => a.id),
      ad_ids: payload.ads.map((a) => a.id),
    }),
  ].join("\n");
}
