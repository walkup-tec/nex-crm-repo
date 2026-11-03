import type { DataQualityStatus } from "@/lib/nex-intelligence/quality/validate-export";
import type { MetricTraceability } from "@/lib/nex-intelligence/trace";
import type { EvidenceLevel } from "@/lib/nex-intelligence/evidence/levels";
import type { CmsE1RecoveryAudit } from "@/lib/nex-intelligence/recovery/cms-e1";
import type {
  StructuredClaim,
  StructuredRecommendation,
} from "@/lib/nex-intelligence/ai-output/schemas";

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
export type AnalyticalStatus =
  | "COMPLETED"
  | "PARTIAL_VALIDATED"
  | "FALLBACK_DETERMINISTIC"
  | "FAILED";

export type SchemaFieldError = {
  path: string;
  message: string;
  section: "envelope" | "observations" | "recommendations" | "executive_points" | "metric_traceability";
  attempt: "initial" | "regeneration";
};

export type TraceRebindAuditEntry = {
  claim_id: string;
  kind: "observation" | "recommendation" | "executive_point";
  applied: boolean;
  previous_trace_ids: string[];
  next_trace_ids: string[];
  reason: string;
};

export type RecoveryAudit = {
  initial_generation_valid: boolean;
  regeneration_attempted: boolean;
  regeneration_valid: boolean | null;
  regeneration_kind: "none" | "structural" | "recommendations";
  recovery_mode: AnalyticalStatus;
  approved_observations: number;
  approved_recommendations: number;
  approved_executive_points: number;
  discarded_items: number;
  errors: SchemaFieldError[];
  cms_e1_decisions?: CmsE1RecoveryAudit[];
  /** Reassociação determinística de trace_ids (Camada C) antes da publicação. */
  trace_rebinds?: TraceRebindAuditEntry[];
  backend_trace_catalog_size?: number;
};

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
  has_recoverable_content: boolean;
  parse_error?: string;
  schema_errors: SchemaFieldError[];
  discarded_recommendations: number;
  discarded_observations: number;
  discarded_executive_points: number;
};

export type ValidatedRecommendation = StructuredRecommendation & {
  verdict: RecommendationVerdict;
  rejection_reasons: string[];
  trace_ids: string[];
  evidence_level: EvidenceLevel;
  required_evidence_level: EvidenceLevel;
  cms_e1_recovery?: CmsE1RecoveryAudit;
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
  evidence_level: EvidenceLevel;
  /** Recuperação E1: juízo qualitativo substituído por fato numérico neutro. */
  e1_claim_recovery?: CmsE1RecoveryAudit;
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
  analytical_status: AnalyticalStatus;
  schema_errors: SchemaFieldError[];
  recovery: RecoveryAudit;
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
  analyticalStatus: AnalyticalStatus;
};
