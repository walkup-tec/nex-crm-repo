import type { MetaDataQualityReport } from "@/lib/nex-intelligence/quality/validate-export";
import type { NexMetaAnalysisV1 } from "@/lib/meta-export";
import { metaAiUserPrompt } from "@/lib/meta-ai-prompt";
import { buildPersistedAnalyticalOutput } from "@/lib/nex-intelligence/persistence/build-analytical-output";
import {
  createPipelineContext,
  recordOpenAiCall,
  type MetaAnalysisPipelineContext,
} from "@/lib/nex-intelligence/pipeline/context";
import type { PersistedAnalyticalOutputV120 } from "@/lib/nex-intelligence/pipeline/persistence-contract";
import { buildBackendMetricTraceCatalog } from "@/lib/nex-intelligence/trace/build-catalog";
import type { MetricTraceability } from "@/lib/nex-intelligence/trace";
import {
  processMetaAiRecommendations,
  regenerationUserPrompt,
  structuralRegenerationUserPrompt,
  type AnalyticalStatus,
  type ProcessRecommendationsResult,
} from "@/lib/nex-intelligence/validation/orchestrate";

export type RunMetaAnalysisOpenAiRequest = {
  system: string;
  user: string;
};

export type RunMetaAnalysisInput = {
  payload: NexMetaAnalysisV1;
  quality: MetaDataQualityReport;
  promptHash: string;
  analysisSystemPrompt: string;
  /** Se omitido, monta prompt com catálogo backend de traces. */
  analysisUserPrompt?: string;
  structuralSystemPrompt: string;
  regenerationSystemPrompt: string;
  requestOpenAi: (input: RunMetaAnalysisOpenAiRequest) => Promise<{ text: string; model: string }>;
  backendTraceability?: MetricTraceability;
};

export type RunMetaAnalysisResult = {
  pipelineContext: MetaAnalysisPipelineContext;
  model: string;
  rawAiText: string;
  processed: ProcessRecommendationsResult;
  outputJson: PersistedAnalyticalOutputV120;
  analyticalStatus: AnalyticalStatus;
  executionStatus: "ok" | "partial" | "error";
  errorMessage: string;
};

export async function runMetaAnalysis(input: RunMetaAnalysisInput): Promise<RunMetaAnalysisResult> {
  let pipelineContext = createPipelineContext({ promptHash: input.promptHash });
  let model = process.env["OPENAI_MODEL"]?.trim() || "gpt-4o-mini";
  let rawAiText = "";
  let errorMessage = "";
  let executionStatus: RunMetaAnalysisResult["executionStatus"] =
    input.payload.metadata.data_status === "partial" || input.quality.status !== "PASS"
      ? "partial"
      : "ok";

  // Camada C ANTES da OpenAI: catálogo completo de traces verificáveis.
  const backendTraceability =
    input.backendTraceability ?? buildBackendMetricTraceCatalog(input.payload, input.quality);
  const analysisUserPrompt =
    input.analysisUserPrompt ?? metaAiUserPrompt(input.payload, backendTraceability);

  let processed: ProcessRecommendationsResult | null = null;

  try {
    const ai = await input.requestOpenAi({
      system: input.analysisSystemPrompt,
      user: analysisUserPrompt,
    });
    pipelineContext = recordOpenAiCall(pipelineContext);
    model = ai.model;
    rawAiText = ai.text;

    processed = await processMetaAiRecommendations({
      rawText: ai.text,
      payload: input.payload,
      quality: input.quality,
      backendTraceability,
      regenerateStructural: async (errors) => {
        if (pipelineContext.aiCallsUsed >= pipelineContext.aiCallBudget) {
          throw new Error("ai_call_budget_exhausted");
        }
        pipelineContext = recordOpenAiCall(pipelineContext);
        const again = await input.requestOpenAi({
          system: input.structuralSystemPrompt,
          user: structuralRegenerationUserPrompt(errors, input.payload),
        });
        return again.text;
      },
      regenerate: async (invalid) => {
        if (pipelineContext.aiCallsUsed >= pipelineContext.aiCallBudget) {
          throw new Error("ai_call_budget_exhausted");
        }
        pipelineContext = recordOpenAiCall(pipelineContext);
        const again = await input.requestOpenAi({
          system: input.regenerationSystemPrompt,
          user: regenerationUserPrompt(invalid, input.payload),
        });
        return again.text;
      },
    });

    if (
      processed.analyticalStatus === "PARTIAL_VALIDATED" ||
      processed.analyticalStatus === "FALLBACK_DETERMINISTIC" ||
      !processed.audit.parse_ok ||
      processed.rejected.length ||
      processed.needsReview.length
    ) {
      executionStatus = executionStatus === "error" ? executionStatus : "partial";
    }
    if (processed.analyticalStatus === "FAILED") {
      executionStatus = "error";
      errorMessage =
        processed.audit.parse_error || "Falha analítica sem fallback determinístico.";
    }
  } catch (error) {
    executionStatus = "error";
    errorMessage = error instanceof Error ? error.message : "Falha na OpenAI.";
    processed = processed ?? {
      publishedMarkdown: "",
      audit: {
        engine_version: input.quality.engine_version,
        validated_at: new Date().toISOString(),
        parse_ok: false,
        regeneration_attempted: false,
        analytical_status: "FAILED",
        schema_errors: [],
        recovery: {
          initial_generation_valid: false,
          regeneration_attempted: false,
          regeneration_valid: null,
          regeneration_kind: "none",
          recovery_mode: "FAILED",
          approved_observations: 0,
          approved_recommendations: 0,
          approved_executive_points: 0,
          discarded_items: 0,
          errors: [],
        },
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
        metric_traceability: { version: "1.0", records: [] },
      },
      approved: [],
      rejected: [],
      needsReview: [],
      analyticalStatus: "FAILED",
    };
  }

  const outputJson = buildPersistedAnalyticalOutput({
    rawText: rawAiText,
    model,
    promptHash: input.promptHash,
    dataQualityStatus: input.quality.status,
    processed: processed!,
  });

  return {
    pipelineContext,
    model,
    rawAiText,
    processed: processed!,
    outputJson,
    analyticalStatus: processed.analyticalStatus,
    executionStatus,
    errorMessage,
  };
}
