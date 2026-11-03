import {
  NEX_INTELLIGENCE_CLAIM_IR_VERSION,
  NEX_INTELLIGENCE_ENGINE_VERSION,
  NEX_INTELLIGENCE_PROTOCOL_VERSION,
} from "@/lib/nex-intelligence/versions";
import type { PersistedAnalyticalOutputV130 } from "@/lib/nex-intelligence/pipeline/persistence-contract";
import {
  parseStructuredAnalysis,
  type ProcessRecommendationsResult,
} from "@/lib/nex-intelligence/validation/orchestrate";
import type { ProcessClaimIRResult } from "@/lib/nex-intelligence/claim-ir/process";

export function markPersistedOutputPublished(
  output: PersistedAnalyticalOutputV130,
): PersistedAnalyticalOutputV130 {
  if (
    output.publication_status !== "pending_persist" ||
    output.analytical_status === "FAILED" ||
    !output.publication_gate.ok
  ) {
    throw new Error("analytical_output_not_publishable");
  }
  return {
    ...output,
    publication_status: "published",
    statuses: {
      ...output.statuses,
      publication_status: "published",
    },
  };
}

export function buildPersistedAnalyticalOutput(input: {
  rawText: string;
  model: string;
  promptHash: string;
  dataQualityStatus: string;
  processed: ProcessRecommendationsResult;
  claimIr?: ProcessClaimIRResult | null;
  executionStatus?: string;
  publicationStatus?: string;
  publicationVersion?: number;
}): PersistedAnalyticalOutputV130 {
  const parsed = parseStructuredAnalysis(input.rawText, "initial");
  const audit = input.processed.audit;
  const publicationStatus = input.publicationStatus ?? input.processed.publicationStatus;
  const executionStatus = input.executionStatus ?? "succeeded";
  const publicationVersion = input.publicationVersion ?? 1;
  const claimIr = input.claimIr;

  return {
    analysis_markdown: input.processed.publishedMarkdown,
    model: input.model,
    protocol_version: NEX_INTELLIGENCE_PROTOCOL_VERSION,
    engine_version: NEX_INTELLIGENCE_ENGINE_VERSION,
    prompt_hash: input.promptHash,
    data_quality_status: input.dataQualityStatus,
    analytical_status: input.processed.analyticalStatus,
    claim_ir_version: NEX_INTELLIGENCE_CLAIM_IR_VERSION,
    execution_status: executionStatus,
    publication_status: publicationStatus,
    publication_version: publicationVersion,
    computed_metrics: claimIr?.registry ?? [],
    claim_ir: {
      proposed: claimIr?.original ?? [],
      original: claimIr?.original ?? [],
      normalized: claimIr?.normalized ?? [],
      validated: claimIr?.validated ?? [],
      recovered: claimIr?.recovered ?? [],
      approved: claimIr?.approved ?? [],
      rejected: claimIr?.rejected ?? [],
      recovery_audits: claimIr?.recovery_audits ?? [],
    },
    semantic_validation: {
      engine: NEX_INTELLIGENCE_ENGINE_VERSION,
      approved_count: claimIr?.approved.length ?? audit.published_recommendation_ids.length,
      rejected_count: claimIr?.rejected.length ?? audit.rejected_recommendation_ids.length,
    },
    publication_gate: input.processed.publicationGate,
    statuses: {
      execution_status: executionStatus,
      analytical_status: String(input.processed.analyticalStatus),
      data_quality_status: input.dataQualityStatus,
      publication_status: publicationStatus,
    },
    ai_original: {
      raw_text_present: Boolean(input.rawText.trim()),
      structured: parsed.parse_ok
        ? {
            ...(parsed.format ? { format: parsed.format } : {}),
            claim_ir: parsed.claim_ir,
            observations: parsed.observations,
            recommendations: parsed.recommendations,
            executive_points: parsed.executive_points,
            metric_traceability: parsed.metric_traceability,
          }
        : null,
      parse_ok: parsed.parse_ok,
      ...(parsed.parse_error ? { parse_error: parsed.parse_error } : {}),
    },
    validation: {
      observations: audit.observations,
      recommendations: audit.recommendations,
      executive_points: audit.executive_points,
      schema_errors: audit.schema_errors,
    },
    rejected: {
      recommendations: input.processed.rejected,
      observations: audit.observations.filter((row) => row.verdict !== "APPROVED"),
      executive_points: audit.executive_points.filter((row) => row.verdict !== "APPROVED"),
      needs_review: input.processed.needsReview,
    },
    recovery: audit.recovery as unknown as Record<string, unknown>,
    metric_traceability: audit.metric_traceability as unknown as Record<string, unknown>,
    report: {
      markdown: input.processed.publishedMarkdown,
      published_recommendation_ids: audit.published_recommendation_ids,
    },
    recommendation_validation: audit as unknown as Record<string, unknown>,
  };
}
