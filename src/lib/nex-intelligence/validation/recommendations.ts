import type { MetaDataQualityReport } from "@/lib/nex-intelligence/quality/validate-export";
import type { NexMetaAnalysisV1 } from "@/lib/meta-export";
import {
  buildCompromisedMetricIndex,
  metricIntegrityForEntity,
  normalizeCanonicalMetric,
  validateTraceIdsForClaim,
  type MetricTraceRecord,
} from "@/lib/nex-intelligence/trace";
import {
  classifyAchievedEvidenceLevel,
  evidenceLevelAtLeast,
  requiredEvidenceLevelForAction,
  textHasCausalPromise,
  textHasInventedBenchmark,
  textHasUnfoundedQualitativeLabel,
  type EvidenceComparison,
} from "@/lib/nex-intelligence/evidence/levels";
import { tryCmsE1PartialRecovery } from "@/lib/nex-intelligence/recovery/cms-e1";
import {
  structuredRecommendationSchema,
  type StructuredRecommendation,
} from "@/lib/nex-intelligence/ai-output/schemas";
import { normalizeRecommendationDraft } from "@/lib/nex-intelligence/ai-output/normalize-drafts";
import type {
  RecommendationVerdict,
  ValidatedRecommendation,
} from "@/lib/nex-intelligence/ai-output/types";
import {
  buildEntityIndex,
  entityExists,
  EXTERNAL_COMMERCIAL_MARKERS,
  formatZodIssues,
} from "@/lib/nex-intelligence/validation/entity-helpers";

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

export function validateStructuredRecommendation(
  raw: unknown,
  payload: NexMetaAnalysisV1,
  quality: MetaDataQualityReport,
  traces: Map<string, MetricTraceRecord> = new Map(),
  options: { skipCmsE1Recovery?: boolean } = {},
): ValidatedRecommendation {
  const parsed = structuredRecommendationSchema.safeParse(normalizeRecommendationDraft(raw));
  if (!parsed.success) {
    const detail = formatZodIssues(parsed.error.issues, "recommendation")
      .map((i) => `${i.path}: ${i.message}`)
      .join("; ");
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
      rejection_reasons: [`schema_invalid: ${detail || parsed.error.issues.map((i) => i.message).join("; ")}`],
      evidence_level: "E0",
      required_evidence_level: "E3",
      blocked_by: [],
    };
  }

  const rec = parsed.data;
  const reasons: string[] = [];
  const blockedBy: ValidatedRecommendation["blocked_by"] = [];
  const entities = buildEntityIndex(payload);
  const integrity = buildCompromisedMetricIndex(quality);
  const traceIds = rec.trace_ids ?? [];
  const requiredLevel = requiredEvidenceLevelForAction(rec.action_kind);
  const blob = `${rec.recommended_action} ${rec.validation_criterion} ${rec.hypothesis ?? ""} ${rec.evidence.join(" ")}`;

  let entityOk = true;
  if (!entityExists(entities, rec.level, rec.entity_id)) {
    reasons.push(`entity_not_found:${rec.level}:${rec.entity_id}`);
    entityOk = false;
  }

  let metricsCompromised = false;
  for (const indicator of rec.indicators_used) {
    const hit = metricIntegrityForEntity(integrity, rec.entity_id, indicator);
    if (hit.blocked && hit.state) {
      reasons.push(`metric_compromised:${hit.metric}:${hit.state}`);
      metricsCompromised = true;
      blockedBy.push({
        entity_id: rec.entity_id,
        metric: hit.metric,
        check_code: hit.code,
        state: hit.state,
      });
    }
  }

  const traceReasons = validateTraceIdsForClaim({
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
  });
  reasons.push(...traceReasons);
  const tracesOk = traceReasons.length === 0;

  if (rec.action_kind === "scale_budget" || rec.action_kind === "pause") {
    const resultsHit = metricIntegrityForEntity(integrity, rec.entity_id, "results");
    const spendHit = metricIntegrityForEntity(integrity, rec.entity_id, "spend");
    const cprHit = metricIntegrityForEntity(integrity, rec.entity_id, "cost_per_result");
    if (resultsHit.blocked || spendHit.blocked || cprHit.blocked) {
      reasons.push(
        rec.action_kind === "scale_budget"
          ? "scale_blocked_by_compromised_results_or_spend"
          : "pause_blocked_by_compromised_results_or_spend",
      );
      metricsCompromised = true;
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

  if (textHasUnfoundedQualitativeLabel(blob)) {
    if (requiredLevel === "E1") {
      // Monitor: CMS-E1 pode neutralizar; se skip, rejeita.
      reasons.push("unfounded_qualitative_label_without_comparison");
    } else if (!rec.comparison) {
      reasons.push("unfounded_qualitative_label_without_comparison");
    }
  }

  if (textHasInventedBenchmark(blob)) {
    reasons.push("invented_benchmark");
  }

  if (textHasCausalPromise(blob)) {
    reasons.push("unproven_causality_claim");
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

  const achieved = classifyAchievedEvidenceLevel({
    baseOk: entityOk,
    tracesOk,
    metricsCompromised,
    comparison: (rec.comparison ?? null) as EvidenceComparison | null,
    payload,
    primaryEntityId: rec.entity_id,
    hypothesis: rec.hypothesis,
    validationCriterion: rec.validation_criterion,
    indicatorsUsed: rec.indicators_used,
    forIntervention: requiredLevel === "E3",
  });
  reasons.push(...achieved.reasons);

  if (!evidenceLevelAtLeast(achieved.level, requiredLevel)) {
    reasons.push(`evidence_level_insufficient:${achieved.level}<${requiredLevel}`);
  }

  // CTR isolado nunca autoriza intervenção estratégica (mesmo com traces).
  if (
    requiredLevel === "E3" &&
    rec.indicators_used.map(normalizeCanonicalMetric).every((m) => m === "ctr" || m === "link_ctr")
  ) {
    reasons.push("ctr_only_insufficient_for_strategic_action");
  }

  const uniqueReasons = [...new Set(reasons)];
  let verdict: RecommendationVerdict = "APPROVED";
  if (uniqueReasons.length) {
    const softOnly =
      uniqueReasons.every((r) => r === "arbitrary_target_without_foundation") &&
      !uniqueReasons.some(
        (r) =>
          r.startsWith("metric_compromised") ||
          r === "entity_not_found" ||
          r === "external_commercial_data" ||
          r.startsWith("evidence_level_insufficient") ||
          r.startsWith("ctr_only"),
      );
    verdict = softOnly ? "NEEDS_REVIEW" : "REJECTED";
  }

  // CMS-E1: recuperação parcial só para monitor (nunca E2/E3 estratégico).
  if (
    verdict !== "APPROVED" &&
    rec.action_kind === "monitor" &&
    entityOk &&
    !options.skipCmsE1Recovery
  ) {
    const cms = tryCmsE1PartialRecovery({
      id: rec.id,
      entity_id: rec.entity_id,
      level: rec.level,
      action_kind: rec.action_kind,
      indicators_used: rec.indicators_used,
      evidence: rec.evidence,
      trace_ids: traceIds,
      recommended_action: rec.recommended_action,
      validation_criterion: rec.validation_criterion,
      hypothesis: rec.hypothesis,
      confidence: rec.confidence,
      traces,
      payload,
      quality,
    });
    if (cms.recovered && cms.audit.applied) {
      const recoveredRaw = {
        ...rec,
        ...cms.recovered,
        comparison: null,
        arbitrary_targets: [],
      };
      const revalidated = validateStructuredRecommendation(
        recoveredRaw,
        payload,
        quality,
        traces,
        { skipCmsE1Recovery: true },
      );
      if (revalidated.verdict === "APPROVED") {
        return {
          ...revalidated,
          evidence_level: "E1",
          required_evidence_level: "E1",
          cms_e1_recovery: cms.audit,
          rejection_reasons: [],
        };
      }
      return {
        ...revalidated,
        cms_e1_recovery: {
          ...cms.audit,
          applied: false,
          reason: `cms_e1_revalidation_failed:${revalidated.rejection_reasons.join(",")}`,
        },
      };
    }
  }

  return {
    ...rec,
    trace_ids: traceIds,
    evidence_level: achieved.level,
    required_evidence_level: requiredLevel,
    verdict,
    rejection_reasons: uniqueReasons,
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
