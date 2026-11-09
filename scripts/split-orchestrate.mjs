import fs from "node:fs";
import path from "node:path";

const root = path.resolve("src/lib/nex-intelligence");
const orchestratePath = path.join(root, "validation/orchestrate.ts");
const src = fs.readFileSync(orchestratePath, "utf8");
const lines = src.split(/\r?\n/);
const slice = (a, b) => lines.slice(a - 1, b).join("\n");

function write(rel, content) {
  const full = path.join(root, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content.replace(/\n+$/, "") + "\n");
  console.log("wrote", rel, content.split(/\n/).length);
}

// ---- types ----
write(
  "ai-output/types.ts",
  `import type { DataQualityStatus } from "@/lib/nex-intelligence/quality/validate-export";
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
`,
);

// ---- schemas (lines 107-169 of original, schemas only) ----
write(
  "ai-output/schemas.ts",
  `import { z } from "zod";

export const evidenceComparisonSchema = z
  .object({
    type: z.enum(["period_vs_period", "campaign_vs_campaign", "adset_vs_adset", "ad_vs_ad", "other"]),
    entity_ids: z.array(z.string()).optional().default([]),
    compatible: z.boolean(),
    absolute_difference: z.number().nullable().optional(),
    relative_difference_pct: z.number().nullable().optional(),
    volumes: z.record(z.number()).optional(),
  })
  .nullable()
  .optional();

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
  comparison: evidenceComparisonSchema,
  evidence_level: z.enum(["E0", "E1", "E2", "E3"]).optional(),
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
`,
);

// ---- normalize drafts (359-425) ----
write(
  "ai-output/normalize-drafts.ts",
  `import type { RecommendationActionKind } from "@/lib/nex-intelligence/ai-output/types";

const ACTION_KIND_ALIASES: Record<string, RecommendationActionKind> = {
  scale_budget: "scale_budget",
  scale: "scale_budget",
  increase_budget: "scale_budget",
  raise_budget: "scale_budget",
  boost_budget: "scale_budget",
  pause: "pause",
  pause_campaign: "pause",
  pause_adset: "pause",
  pause_ad: "pause",
  replace_creative: "replace_creative",
  change_creative: "replace_creative",
  new_creative: "replace_creative",
  test: "test",
  creative_test: "test",
  ab_test: "test",
  experiment: "test",
  monitor: "monitor",
  watch: "monitor",
  observe: "monitor",
  other: "other",
};

const CONFIDENCE_ALIASES: Record<string, "low" | "medium" | "high"> = {
  low: "low",
  baixo: "low",
  medium: "medium",
  med: "medium",
  medio: "medium",
  médio: "medium",
  high: "high",
  alto: "high",
};

/** Normaliza aliases comuns da IA antes da validação Zod estrita. */
export function normalizeRecommendationDraft(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const row = { ...(raw as Record<string, unknown>) };
  if (typeof row.action_kind === "string") {
    const key = row.action_kind.trim().toLowerCase().replace(/[\\s-]+/g, "_");
    if (ACTION_KIND_ALIASES[key]) row.action_kind = ACTION_KIND_ALIASES[key];
  }
  if (typeof row.confidence === "string") {
    const key = row.confidence.trim().toLowerCase();
    if (CONFIDENCE_ALIASES[key]) row.confidence = CONFIDENCE_ALIASES[key];
  }
  if (!Array.isArray(row.indicators_used) && typeof row.metrics_used !== "undefined") {
    row.indicators_used = row.metrics_used;
  }
  if (!Array.isArray(row.evidence)) row.evidence = [];
  if (!Array.isArray(row.trace_ids)) row.trace_ids = [];
  return row;
}

export function normalizeClaimDraft(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const row = { ...(raw as Record<string, unknown>) };
  if (!Array.isArray(row.metrics_used)) row.metrics_used = [];
  if (!Array.isArray(row.trace_ids)) row.trace_ids = [];
  if (typeof row.claim_kind === "string") {
    const key = row.claim_kind.trim().toLowerCase().replace(/[\\s-]+/g, "_");
    if (key === "judgment" || key === "performance") row.claim_kind = "performance_judgment";
    if (key === "recommendation" || key === "indirect") row.claim_kind = "indirect_recommendation";
    if (key === "fact" || key === "description") row.claim_kind = "descriptive";
  }
  return row;
}
`,
);

// Snapshot body sections we will place in dedicated modules by copying from original
const bodyPath = path.join(root, "_orchestrate_body_snapshot.ts");
fs.writeFileSync(bodyPath, src);
console.log("snapshot ok", lines.length);
console.log("types/schemas/normalize written; continue with manual extraction of validation body");
