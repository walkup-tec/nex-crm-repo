import {
  NEX_INTELLIGENCE_ENGINE_VERSION,
  NEX_INTELLIGENCE_PROTOCOL_VERSION,
} from "@/lib/nex-intelligence/versions";
import type { PersistedAnalyticalOutputV120 } from "@/lib/nex-intelligence/pipeline/persistence-contract";
import {
  parseStructuredAnalysis,
  type ProcessRecommendationsResult,
} from "@/lib/nex-intelligence/validation/orchestrate";

export function buildPersistedAnalyticalOutput(input: {
  rawText: string;
  model: string;
  promptHash: string;
  dataQualityStatus: string;
  processed: ProcessRecommendationsResult;
}): PersistedAnalyticalOutputV120 {
  const parsed = parseStructuredAnalysis(input.rawText, "initial");
  const audit = input.processed.audit;

  return {
    analysis_markdown: input.processed.publishedMarkdown,
    model: input.model,
    protocol_version: NEX_INTELLIGENCE_PROTOCOL_VERSION,
    engine_version: NEX_INTELLIGENCE_ENGINE_VERSION,
    prompt_hash: input.promptHash,
    data_quality_status: input.dataQualityStatus,
    analytical_status: input.processed.analyticalStatus,
    ai_original: {
      raw_text_present: Boolean(input.rawText.trim()),
      structured: parsed.parse_ok
        ? {
            format: parsed.format,
            observations: parsed.observations,
            recommendations: parsed.recommendations,
            executive_points: parsed.executive_points,
            metric_traceability: parsed.metric_traceability,
          }
        : null,
      parse_ok: parsed.parse_ok,
      parse_error: parsed.parse_error,
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
