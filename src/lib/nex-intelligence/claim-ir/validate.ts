import type { MetaDataQualityReport } from "@/lib/nex-intelligence/quality/validate-export";
import type { NexMetaAnalysisV1 } from "@/lib/meta-export";
import type { MetricTraceRecord } from "@/lib/nex-intelligence/trace";
import { normalizeCanonicalMetric } from "@/lib/nex-intelligence/trace";
import {
  CLAIM_IR_VERSION,
  OPERATION_MIN_EVIDENCE,
  claimIrSchema,
  isClaimOperation,
  type ClaimIR,
  type ClaimOperation,
} from "@/lib/nex-intelligence/claim-ir/schema";
import { NexIntelligenceErrorCode } from "@/lib/nex-intelligence/errors";
import { buildEntityIndex, entityExists } from "@/lib/nex-intelligence/validation/entity-helpers";

export type EvidenceLevelCode = "E0" | "E1" | "E2" | "E3";

export type ValidatedClaimIR = ClaimIR & {
  verdict: "APPROVED" | "REJECTED";
  rejection_reasons: string[];
  rejection_codes: string[];
  evidence_level: EvidenceLevelCode;
  required_evidence_level: EvidenceLevelCode;
  claim_ir_version: string;
  recovery_origin: string | null;
};

function levelRank(level: EvidenceLevelCode): number {
  return { E0: 0, E1: 1, E2: 2, E3: 3 }[level];
}

function tracesOk(
  refs: string[],
  traces: Map<string, MetricTraceRecord>,
  entityId: string | null,
  entityLevel: ClaimIR["entity_level"],
): { ok: boolean; reasons: string[]; codes: string[] } {
  const reasons: string[] = [];
  const codes: string[] = [];
  if (!refs.length) {
    reasons.push("trace_missing");
    codes.push(NexIntelligenceErrorCode.TRACE_NOT_FOUND);
    return { ok: false, reasons, codes };
  }
  for (const id of refs) {
    const row = traces.get(id);
    if (!row) {
      reasons.push(`trace_not_found:${id}`);
      codes.push(NexIntelligenceErrorCode.TRACE_NOT_FOUND);
      continue;
    }
    if (row.source !== "META_MARKETING_API") {
      reasons.push(`trace_source_invalid:${id}`);
      codes.push(NexIntelligenceErrorCode.TRACE_NOT_FOUND);
    }
    if (row.validation.status === "FAIL" || row.validation.status === "NOT_VERIFIABLE") {
      reasons.push(`trace_not_verifiable:${id}:${row.validation.status}`);
      codes.push(NexIntelligenceErrorCode.SEMANTIC_EVIDENCE_INSUFFICIENT);
    }
    if (entityLevel !== "account" && entityId && row.entity_id && row.entity_id !== entityId) {
      reasons.push(`trace_entity_mismatch:${id}`);
      codes.push(NexIntelligenceErrorCode.TRACE_ENTITY_MISMATCH);
    }
  }
  return { ok: reasons.length === 0, reasons, codes };
}

export function validateClaimIR(
  raw: unknown,
  payload: NexMetaAnalysisV1,
  _quality: MetaDataQualityReport,
  traces: Map<string, MetricTraceRecord> = new Map(),
): ValidatedClaimIR {
  if (raw && typeof raw === "object" && "operation" in raw && !isClaimOperation((raw as ClaimIR).operation)) {
    return {
      claim_id: "invalid-op",
      operation: "METRIC_VALUE",
      entity_level: "account",
      entity_id: null,
      args: { metric: "unknown" },
      metric_refs: [],
      comparison_ref: null,
      hypothesis_ref: null,
      action_ref: null,
      verdict: "REJECTED",
      rejection_reasons: [`unsupported_operation:${String((raw as { operation?: unknown }).operation)}`],
      rejection_codes: [NexIntelligenceErrorCode.UNSUPPORTED_OPERATION],
      evidence_level: "E0",
      required_evidence_level: "E1",
      claim_ir_version: CLAIM_IR_VERSION,
      recovery_origin: null,
    };
  }

  const parsed = claimIrSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      claim_id: "invalid-ir",
      operation: "METRIC_VALUE",
      entity_level: "account",
      entity_id: null,
      args: { metric: "unknown" },
      metric_refs: [],
      comparison_ref: null,
      hypothesis_ref: null,
      action_ref: null,
      verdict: "REJECTED",
      rejection_reasons: [
        `schema_invalid:${parsed.error.issues.map((i) => i.message).join(";")}`,
      ],
      rejection_codes: [NexIntelligenceErrorCode.AI_SCHEMA_INVALID],
      evidence_level: "E0",
      required_evidence_level: "E1",
      claim_ir_version: CLAIM_IR_VERSION,
      recovery_origin: null,
    };
  }

  const claim = parsed.data;
  const reasons: string[] = [];
  const codes: string[] = [];
  const required = OPERATION_MIN_EVIDENCE[claim.operation as ClaimOperation];
  const entities = buildEntityIndex(payload);

  if (claim.entity_level === "account" && claim.entity_id && claim.entity_id !== payload.account.id) {
    reasons.push(`entity_not_found:account:${claim.entity_id}`);
    codes.push(NexIntelligenceErrorCode.TRACE_ENTITY_MISMATCH);
  } else if (claim.entity_level !== "account") {
    if (!claim.entity_id || !entityExists(entities, claim.entity_level, claim.entity_id)) {
      reasons.push(`entity_not_found:${claim.entity_level}:${claim.entity_id}`);
      codes.push(NexIntelligenceErrorCode.TRACE_ENTITY_MISMATCH);
    }
  }

  const traceCheck = tracesOk(claim.metric_refs, traces, claim.entity_id, claim.entity_level);
  if (!traceCheck.ok) {
    reasons.push(...traceCheck.reasons);
    codes.push(...traceCheck.codes);
  }

  const expectedMetrics =
    claim.operation === "MONITOR"
      ? claim.args.metrics.map(normalizeCanonicalMetric)
      : "metric" in claim.args
        ? [normalizeCanonicalMetric(String(claim.args.metric))]
        : [];
  for (const metric of expectedMetrics) {
    if (
      !claim.metric_refs.some(
        (id) => normalizeCanonicalMetric(traces.get(id)?.metric ?? "") === metric,
      )
    ) {
      reasons.push(`metric_trace_mismatch:${metric}`);
      codes.push(NexIntelligenceErrorCode.SEMANTIC_EVIDENCE_INSUFFICIENT);
    }
  }

  const comparisonTrace = claim.comparison_ref ? traces.get(claim.comparison_ref) : null;
  const comparisonValidated = Boolean(
    comparisonTrace &&
      comparisonTrace.source === "META_MARKETING_API" &&
      comparisonTrace.validation.status !== "FAIL" &&
      comparisonTrace.validation.status !== "NOT_VERIFIABLE" &&
      comparisonTrace.calculation.comparable === true,
  );

  if (
    (claim.operation === "PERIOD_COMPARISON" ||
      claim.operation === "ENTITY_COMPARISON" ||
      claim.operation === "QUALITATIVE_CLASSIFICATION") &&
    !comparisonValidated
  ) {
    reasons.push(claim.comparison_ref ? "comparison_ref_invalid" : "comparison_ref_required");
    codes.push(NexIntelligenceErrorCode.COMPARISON_NOT_VALIDATED);
  }

  if (claim.operation === "STRATEGIC_TEST" || claim.operation === "CAUSAL_HYPOTHESIS") {
    if (claim.metric_refs.length === 0) {
      reasons.push("strategic_or_causal_requires_metric_refs");
      codes.push(NexIntelligenceErrorCode.STRATEGIC_EVIDENCE_INSUFFICIENT);
    }
    // E3 exige comparação/fundamento rastreável além de métricas isoladas
    if (!comparisonValidated) {
      reasons.push("strategic_or_causal_requires_validated_comparison");
      codes.push(NexIntelligenceErrorCode.STRATEGIC_EVIDENCE_INSUFFICIENT);
    }
  }

  if (claim.operation === "MONITOR") {
    const metrics = (claim.args as { metrics: string[] }).metrics.map(normalizeCanonicalMetric);
    if (!metrics.length) {
      reasons.push("monitor_metrics_empty");
      codes.push(NexIntelligenceErrorCode.SEMANTIC_EVIDENCE_INSUFFICIENT);
    }
  }

  let achieved: EvidenceLevelCode = "E0";
  if (reasons.length === 0) {
    if (required === "E1") achieved = "E1";
    else if (required === "E2" && comparisonValidated) achieved = "E2";
    else if (required === "E3" && comparisonValidated && claim.metric_refs.length > 0) achieved = "E3";
    else achieved = "E1";
  }

  if (levelRank(achieved) < levelRank(required)) {
    reasons.push(`evidence_level_insufficient:${achieved}<${required}`);
    codes.push(NexIntelligenceErrorCode.SEMANTIC_EVIDENCE_INSUFFICIENT);
  }

  const verdict = reasons.length === 0 ? "APPROVED" : "REJECTED";
  return {
    ...claim,
    verdict,
    rejection_reasons: reasons,
    rejection_codes: [...new Set(codes)],
    evidence_level: verdict === "APPROVED" ? achieved : "E0",
    required_evidence_level: required,
    claim_ir_version: CLAIM_IR_VERSION,
    recovery_origin: null,
  };
}

export function validateClaimIRList(
  rows: unknown[],
  payload: NexMetaAnalysisV1,
  quality: MetaDataQualityReport,
  traces: Map<string, MetricTraceRecord> = new Map(),
): ValidatedClaimIR[] {
  return rows.map((row) => validateClaimIR(row, payload, quality, traces));
}
