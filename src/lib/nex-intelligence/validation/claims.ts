import type { MetaDataQualityReport } from "@/lib/nex-intelligence/quality/validate-export";
import type { NexMetaAnalysisV1 } from "@/lib/meta-export";
import {
  buildCompromisedMetricIndex,
  mentionsNumericClaim,
  mentionsSimpleAverageCtr,
  metricIntegrityForAccountClaim,
  metricIntegrityForEntity,
  normalizeCanonicalMetric,
  validateTraceIdsForClaim,
  type MetricTraceRecord,
} from "@/lib/nex-intelligence/trace";
import {
  claimRequiresComparativeEvidence,
  classifyAchievedEvidenceLevel,
  textHasCausalPromise,
  textHasInventedBenchmark,
  textHasUnfoundedQualitativeLabel,
} from "@/lib/nex-intelligence/evidence/levels";
import { structuredClaimSchema } from "@/lib/nex-intelligence/ai-output/schemas";
import { normalizeClaimDraft } from "@/lib/nex-intelligence/ai-output/normalize-drafts";
import type { ValidatedClaim } from "@/lib/nex-intelligence/ai-output/types";
import {
  buildEntityIndex,
  detectClaimKindFromText,
  entityExists,
  EXTERNAL_COMMERCIAL_MARKERS,
  formatZodIssues,
  inferMetricsFromText,
} from "@/lib/nex-intelligence/validation/entity-helpers";

export function validateStructuredClaim(
  raw: unknown,
  payload: NexMetaAnalysisV1,
  quality: MetaDataQualityReport,
  approvedActions: string[] = [],
  traces: Map<string, MetricTraceRecord> = new Map(),
): ValidatedClaim {
  const parsed = structuredClaimSchema.safeParse(normalizeClaimDraft(raw));
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
      evidence_level: "E0",
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
  let kind =
    claim.claim_kind === "descriptive" && detectClaimKindFromText(claim.text) !== "descriptive"
      ? detectClaimKindFromText(claim.text)
      : claim.claim_kind;

  // Label qualitativo eleva claim descritivo a julgamento (exige E2).
  if (kind === "descriptive" && textHasUnfoundedQualitativeLabel(claim.text)) {
    kind = "performance_judgment";
  }

  let entityOk = true;
  if (claim.level !== "account" && claim.entity_id) {
    if (!entityExists(entities, claim.level, claim.entity_id)) {
      reasons.push(`entity_not_found:${claim.level}:${claim.entity_id}`);
      entityOk = false;
    }
  }

  if (kind === "indirect_recommendation") {
    const allowed = approvedActions.some(
      (action) => action && claim.text.toLowerCase().includes(action.toLowerCase()),
    );
    if (!allowed) reasons.push("indirect_recommendation_unvalidated");
  }

  let metricsCompromised = false;
  if (kind === "performance_judgment" || kind === "descriptive") {
    const scopedEntity = claim.entity_id && claim.level !== "account" ? claim.entity_id : null;

    for (const metric of metrics) {
      if (scopedEntity) {
        const hit = metricIntegrityForEntity(integrity, scopedEntity, metric);
        if (hit.blocked && hit.state) {
          reasons.push(`metric_compromised:${hit.metric}:${hit.state}`);
          metricsCompromised = true;
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
          metricsCompromised = true;
          blockedBy.push({
            entity_id: payload.account.id,
            metric: hit.metric,
            check_code: hit.code,
            state: hit.state,
          });
        }
      }
    }

    if (kind === "performance_judgment" && scopedEntity) {
      for (const metric of metrics) {
        if (!["results", "spend", "cost_per_result"].includes(metric)) continue;
        const hit = metricIntegrityForEntity(integrity, scopedEntity, metric);
        if (hit.blocked && hit.state && !reasons.some((r) => r.includes(`metric_compromised:${hit.metric}`))) {
          reasons.push(`metric_compromised:${hit.metric}:${hit.state}`);
          metricsCompromised = true;
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
        if (metric === "ctr" || metric === "cpc" || metric === "cpm" || metric === "clicks" || metric === "impressions") {
          continue;
        }
        for (const [entityId, map] of integrity.byEntity) {
          const canonical = normalizeCanonicalMetric(metric);
          if (map.has(canonical)) {
            reasons.push(`account_judgment_depends_on_compromised_entity:${entityId}:${canonical}`);
            metricsCompromised = true;
          }
        }
      }
    }
  }

  const traceReasons = validateTraceIdsForClaim({
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
  });
  reasons.push(...traceReasons);
  const tracesOk = traceReasons.length === 0;

  if (EXTERNAL_COMMERCIAL_MARKERS.test(claim.text)) {
    reasons.push("external_commercial_data");
  }

  if (textHasInventedBenchmark(claim.text)) {
    reasons.push("invented_benchmark");
  }

  // Julgamento qualitativo / labels sem comparação fundamentada → rejeita (E2 exigido, comparação ausente).
  if (claimRequiresComparativeEvidence(claim.text, kind)) {
    reasons.push("qualitative_judgment_without_validated_comparison");
  }

  const achieved = classifyAchievedEvidenceLevel({
    baseOk: entityOk && kind !== "indirect_recommendation",
    tracesOk,
    metricsCompromised,
    comparison: null,
    payload,
    primaryEntityId: claim.entity_id,
    forIntervention: false,
  });

  // Fato numérico E1: se só há label qualitativo, não aprova mesmo com traces.
  // Se é descritivo puro sem labels, E1 basta.
  if (kind === "descriptive" && !textHasUnfoundedQualitativeLabel(claim.text) && achieved.level === "E1") {
    // ok
  }

  return {
    ...claim,
    claim_kind: kind,
    metrics_used: metrics,
    trace_ids: traceIds,
    evidence_level: reasons.length && !tracesOk ? "E0" : achieved.level,
    verdict: reasons.length ? "REJECTED" : "APPROVED",
    rejection_reasons: [...new Set(reasons)],
    blocked_by: blockedBy,
  };
}

export function validateRecommendationList(
  items: unknown[],
  payload: NexMetaAnalysisV1,
  quality: MetaDataQualityReport,
  traces: Map<string, MetricTraceRecord> = new Map(),
  options?: { skipCmsE1Recovery?: boolean },
): ValidatedRecommendation[] {
  return items.map((item) =>
    validateStructuredRecommendation(item, payload, quality, traces, options),
  );
}

export function validateClaimList(
  items: unknown[],
  payload: NexMetaAnalysisV1,
  quality: MetaDataQualityReport,
  approvedActions: string[] = [],
  traces: Map<string, MetricTraceRecord> = new Map(),
): ValidatedClaim[] {
  return items.map((item) => validateStructuredClaim(item, payload, quality, approvedActions, traces));
}
