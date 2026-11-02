import type { MetaDataQualityReport } from "@/lib/nex-intelligence/quality/validate-export";
import type { NexMetaAnalysisV1 } from "@/lib/meta-export";
import {
  indexTracesById,
  type MetricTraceRecord,
} from "@/lib/nex-intelligence/trace";
import {
  syncTraceUsedByForClaim,
  tryCmsE1PartialRecovery,
  type CmsE1RecoveryAudit,
} from "@/lib/nex-intelligence/recovery/cms-e1";
import { NEX_INTELLIGENCE_ENGINE_VERSION } from "@/lib/nex-intelligence/versions";
import {
  emptyStructuredPayload,
  extractJsonObject,
  mergeStructuredPayloads,
  needsStructuralRegeneration,
  parseStructuredAnalysis,
} from "@/lib/nex-intelligence/ai-output/parse";
import type {
  AnalyticalStatus,
  ProcessRecommendationsResult,
  RecoveryAudit,
  RecommendationValidationAudit,
  SchemaFieldError,
  StructuredAnalysisPayload,
  ValidatedRecommendation,
} from "@/lib/nex-intelligence/ai-output/types";
import { validateRecommendationList } from "@/lib/nex-intelligence/validation/recommendations";
import { validateClaimList } from "@/lib/nex-intelligence/validation/claims";
import { sanitizeNarrativeText } from "@/lib/nex-intelligence/validation/narrative";
import {
  buildDeterministicFallbackReport,
  composeExecutiveFromApproved,
  composePublishedMarkdown,
  renderClaimsMarkdown,
} from "@/lib/nex-intelligence/report";

export {
  buildCompromisedMetricIndex,
  metricIntegrityForAccountClaim,
  metricIntegrityForEntity,
  normalizeCanonicalMetric,
} from "@/lib/nex-intelligence/trace";

export type { EvidenceComparison, EvidenceLevel } from "@/lib/nex-intelligence/evidence/levels";
export type { CmsE1RecoveryAudit } from "@/lib/nex-intelligence/recovery/cms-e1";

export const META_AI_RECOMMENDATION_ENGINE = NEX_INTELLIGENCE_ENGINE_VERSION;

export * from "@/lib/nex-intelligence/ai-output/types";
export * from "@/lib/nex-intelligence/ai-output/schemas";
export {
  normalizeRecommendationDraft,
  normalizeClaimDraft,
} from "@/lib/nex-intelligence/ai-output/normalize-drafts";
export {
  extractJsonObject,
  parseStructuredAnalysis,
} from "@/lib/nex-intelligence/ai-output/parse";
export {
  buildEntityIndex,
  inferMetricsFromText,
  detectClaimKindFromText,
  resolveEntityFromText,
  formatZodIssues,
} from "@/lib/nex-intelligence/validation/entity-helpers";
export {
  validateStructuredRecommendation,
  validateRecommendationList,
} from "@/lib/nex-intelligence/validation/recommendations";
export {
  validateStructuredClaim,
  validateClaimList,
} from "@/lib/nex-intelligence/validation/claims";
export { sanitizeNarrativeText } from "@/lib/nex-intelligence/validation/narrative";
export {
  composePublishedMarkdown,
  buildDeterministicFallbackReport,
} from "@/lib/nex-intelligence/report";

function resolveAnalyticalStatus(input: {
  approvedObs: number;
  approvedRecs: number;
  approvedExec: number;
  discarded: number;
  schemaErrors: number;
  rejectedOrReview: number;
  usedFallback: boolean;
}): AnalyticalStatus {
  if (input.usedFallback) return "FALLBACK_DETERMINISTIC";
  const approvedTotal = input.approvedObs + input.approvedRecs + input.approvedExec;
  if (approvedTotal === 0) return "FALLBACK_DETERMINISTIC";
  if (
    approvedTotal > 0 &&
    input.discarded === 0 &&
    input.schemaErrors === 0 &&
    input.rejectedOrReview === 0
  ) {
    return "COMPLETED";
  }
  return "PARTIAL_VALIDATED";
}

export async function processMetaAiRecommendations(input: {
  rawText: string;
  payload: NexMetaAnalysisV1;
  quality: MetaDataQualityReport;
  now?: string;
  /** Regeneração de recomendações rejeitadas (conteúdo). No máx. 1 chamada extra por execução. */
  regenerate?: (invalid: ValidatedRecommendation[]) => Promise<string>;
  /** Regeneração estrutural do JSON completo. Mutuamente exclusiva com `regenerate`. */
  regenerateStructural?: (errors: SchemaFieldError[]) => Promise<string>;
}): Promise<ProcessRecommendationsResult> {
  const now = input.now ?? new Date().toISOString();
  let initial = parseStructuredAnalysis(input.rawText, "initial");
  let regenerationAttempted = false;
  let regenerationKind: RecoveryAudit["regeneration_kind"] = "none";
  let regenerationValid: boolean | null = null;
  let secondary: StructuredAnalysisPayload | null = null;
  let extraAiCallUsed = false;

  const initialGenerationValid =
    initial.parse_ok &&
    (initial.observations.length > 0 ||
      initial.recommendations.length > 0 ||
      initial.executive_points.length > 0 ||
      initial.schema_errors.length === 0);

  let working = initial;
  const cmsRecoveryDecisions: CmsE1RecoveryAudit[] = [];
  const cmsByRecommendationId = new Map<string, CmsE1RecoveryAudit>();

  function syncTraceUsedByFromValidated(validatedRows: ValidatedRecommendation[]) {
    let records = working.metric_traceability.records;
    for (const row of validatedRows) {
      const cms = row.cms_e1_recovery;
      if (!cms?.applied) continue;
      records = syncTraceUsedByForClaim(
        records,
        row.id,
        row.trace_ids,
        cms.discarded_trace_ids,
      );
    }
    working = {
      ...working,
      recommendations: [...working.recommendations],
      metric_traceability: { ...working.metric_traceability, records },
    };
  }

  function runAuditPass(skipCms: boolean) {
    const traces = indexTracesById(working.metric_traceability);
    const validatedRows = validateRecommendationList(
      working.recommendations,
      input.payload,
      input.quality,
      traces,
      skipCms ? { skipCmsE1Recovery: true } : undefined,
    );
    return { traces, validatedRows };
  }

  // D_AUDIT (AI claims — traces Camada C only; CMS deferred).
  let { traces, validatedRows: validated } = runAuditPass(true);

  // CMS_RECOVERY deterministic (never OpenAI).
  {
    const byId = new Map(working.recommendations.map((row) => [row.id, row]));
    for (const row of validated) {
      if (row.verdict === "APPROVED" || row.action_kind !== "monitor") continue;
      const rec = byId.get(row.id);
      if (!rec) continue;
      const cms = tryCmsE1PartialRecovery({
        id: rec.id,
        entity_id: rec.entity_id,
        level: rec.level,
        action_kind: rec.action_kind,
        indicators_used: rec.indicators_used,
        evidence: rec.evidence,
        trace_ids: rec.trace_ids ?? [],
        recommended_action: rec.recommended_action,
        validation_criterion: rec.validation_criterion,
        hypothesis: rec.hypothesis,
        confidence: rec.confidence,
        traces,
        payload: input.payload,
        quality: input.quality,
      });
      cmsRecoveryDecisions.push(cms.audit);
      if (cms.recovered && cms.audit.applied) {
        cmsByRecommendationId.set(rec.id, cms.audit);
        byId.set(rec.id, {
          ...rec,
          ...cms.recovered,
          comparison: null,
          arbitrary_targets: [],
        });
      }
    }
    working = { ...working, recommendations: [...byId.values()] };
  }

  // D_AUDIT again (recovered + remaining; CMS inline allowed).
  ({ traces, validatedRows: validated } = runAuditPass(false));
  syncTraceUsedByFromValidated(validated);
  ({ traces, validatedRows: validated } = runAuditPass(false));
  validated = validated.map((row) => {
    const cms = cmsByRecommendationId.get(row.id);
    if (cms?.applied && row.verdict === "APPROVED" && !row.cms_e1_recovery) {
      return { ...row, cms_e1_recovery: cms };
    }
    return row;
  });

  // Optional OpenAI#2 only after CMS — structural regen counts toward budget.
  if (needsStructuralRegeneration(working) && input.regenerateStructural && !extraAiCallUsed) {
    regenerationAttempted = true;
    regenerationKind = "structural";
    extraAiCallUsed = true;
    try {
      const regeneratedText = await input.regenerateStructural(working.schema_errors);
      secondary = parseStructuredAnalysis(regeneratedText, "regeneration");
      regenerationValid =
        secondary.parse_ok &&
        (secondary.observations.length > 0 ||
          secondary.recommendations.length > 0 ||
          secondary.executive_points.length > 0);
      working = mergeStructuredPayloads(initial, secondary);
      ({ traces, validatedRows: validated } = runAuditPass(false));
      syncTraceUsedByFromValidated(validated);
      ({ traces, validatedRows: validated } = runAuditPass(false));
    } catch (error) {
      regenerationValid = false;
      working = emptyStructuredPayload({
        ...working,
        schema_errors: [
          ...working.schema_errors,
          {
            path: "regeneration",
            message: error instanceof Error ? error.message : "structural_regeneration_failed",
            section: "envelope",
            attempt: "regeneration",
          },
        ],
      });
    }
  }

  // Regeneração de conteúdo: só itens ainda inválidos após CMS + auditoria.
  const invalid = validated.filter((row) => row.verdict !== "APPROVED");
  if (invalid.length && input.regenerate && !extraAiCallUsed && working.parse_ok) {
    regenerationAttempted = true;
    regenerationKind = "recommendations";
    extraAiCallUsed = true;
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
      regenerationValid = revalidated.some((row) => row.verdict === "APPROVED");
      const byId = new Map(validated.map((row) => [row.id, row]));
      for (const row of revalidated) byId.set(row.id, row);
      for (const original of invalid) {
        const current = byId.get(original.id);
        if (!current || current.verdict !== "APPROVED") byId.set(original.id, current ?? original);
      }
      validated = [...byId.values()];
    } catch {
      regenerationValid = false;
    }
  }

  const approved = validated.filter((row) => row.verdict === "APPROVED");
  const rejected = validated.filter((row) => row.verdict === "REJECTED");
  const needsReview = validated.filter((row) => row.verdict === "NEEDS_REVIEW");
  const approvedActions = approved.map((row) => row.recommended_action);

  const observations = validateClaimList(
    working.observations,
    input.payload,
    input.quality,
    approvedActions,
    traces,
  );
  const executivePoints = validateClaimList(
    working.executive_points,
    input.payload,
    input.quality,
    approvedActions,
    traces,
  );

  const approvedObs = observations.filter((c) => c.verdict === "APPROVED");
  const approvedExec = executivePoints.filter((c) => c.verdict === "APPROVED");
  const discardedItems =
    working.discarded_recommendations +
    working.discarded_observations +
    working.discarded_executive_points +
    observations.filter((c) => c.verdict !== "APPROVED").length +
    executivePoints.filter((c) => c.verdict !== "APPROVED").length +
    rejected.length +
    needsReview.length;

  const hasApprovedConclusions =
    approvedObs.length > 0 || approved.length > 0 || approvedExec.length > 0;

  let usedFallback = false;
  let publishedMarkdown = "";
  let stage2Source: NarrativeSanitizationAudit["stage2_source"] = "structured";
  let stage4Source: NarrativeSanitizationAudit["stage4_source"] = "structured";
  let stage2Dropped = observations.filter((c) => c.verdict !== "APPROVED").length;
  let stage4Dropped = executivePoints.filter((c) => c.verdict !== "APPROVED").length;

  if (!hasApprovedConclusions) {
    usedFallback = true;
    const reason =
      working.parse_error ||
      (working.schema_errors[0]
        ? `${working.schema_errors[0].path}: ${working.schema_errors[0].message}`
        : "nenhuma conclusão aprovada após validação determinística");
    publishedMarkdown = buildDeterministicFallbackReport(input.payload, input.quality, reason);
    stage2Source = "empty";
    stage4Source = "approved_only";
  } else {
    let stage2Text = renderClaimsMarkdown(approvedObs, "");
    if (!working.observations.length) {
      stage2Text = "_Sem observações estruturadas verificáveis._";
      stage2Dropped = 0;
      stage2Source = "empty";
    } else if (!stage2Text) {
      stage2Source = "empty";
      stage2Text = "_Sem observações verificáveis após validação de integridade._";
    }

    let stage4Text = "";
    if (working.executive_points.length) {
      stage4Text = composeExecutiveFromApproved(approvedExec, approved, "");
      stage4Source = "structured";
    } else {
      stage4Text = composeExecutiveFromApproved([], approved, "");
      stage4Source = "approved_only";
    }

    const stage1Sanitized = sanitizeNarrativeText(
      working.stage1_markdown,
      input.payload,
      input.quality,
      approvedActions,
    );

    const rejectedClaims = [
      ...observations.filter((c) => c.verdict !== "APPROVED"),
      ...executivePoints.filter((c) => c.verdict !== "APPROVED"),
    ];

    publishedMarkdown = composePublishedMarkdown({
      stage1: stage1Sanitized.text || `_Status determinístico: ${input.quality.status}._`,
      stage2: stage2Text || "_Sem observações verificáveis._",
      stage4: stage4Text,
      approved,
      rejected,
      needsReview,
      approvedObservations: stage2Source === "structured" ? approvedObs : undefined,
      rejectedClaims,
      quality: input.quality,
      parseError: working.parse_error,
      narrativeNote:
        stage2Dropped || stage4Dropped || working.schema_errors.length
          ? `Itens omitidos por schema/integridade (etapa2=${stage2Dropped}, etapa4=${stage4Dropped}, schema_errors=${working.schema_errors.length}). Markdown bruto da IA não foi publicado.`
          : "Markdown bruto da IA não foi publicado.",
    });
  }

  const analyticalStatus = resolveAnalyticalStatus({
    approvedObs: approvedObs.length,
    approvedRecs: approved.length,
    approvedExec: approvedExec.length,
    discarded: discardedItems,
    schemaErrors: working.schema_errors.length,
    rejectedOrReview: rejected.length + needsReview.length,
    usedFallback,
  });

  const finalStatus: AnalyticalStatus =
    usedFallback && !input.payload?.account?.id ? "FAILED" : analyticalStatus;

  const recovery: RecoveryAudit = {
    initial_generation_valid: Boolean(initialGenerationValid),
    regeneration_attempted: regenerationAttempted,
    regeneration_valid: regenerationValid,
    regeneration_kind: regenerationKind,
    recovery_mode: finalStatus,
    approved_observations: approvedObs.length,
    approved_recommendations: approved.length,
    approved_executive_points: approvedExec.length,
    discarded_items: discardedItems,
    errors: working.schema_errors,
    cms_e1_decisions: cmsRecoveryDecisions,
  };

  const audit: RecommendationValidationAudit = {
    engine_version: META_AI_RECOMMENDATION_ENGINE,
    validated_at: now,
    parse_ok: working.parse_ok,
    parse_error: working.parse_error,
    regeneration_attempted: regenerationAttempted,
    analytical_status: finalStatus,
    schema_errors: working.schema_errors,
    recovery,
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
    metric_traceability: working.metric_traceability,
  };

  return {
    publishedMarkdown,
    audit,
    approved,
    rejected,
    needsReview,
    analyticalStatus: finalStatus,
  };
}

export function regenerationUserPrompt(invalid: ValidatedRecommendation[], payload: NexMetaAnalysisV1) {
  return [
    "Regenere APENAS as recomendações inválidas abaixo em JSON válido.",
    'Formato: { "recommendations": [ ...mesmo schema estruturado... ] }',
    "action_kind ∈ scale_budget|pause|replace_creative|test|monitor|other; confidence ∈ low|medium|high.",
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

export function structuralRegenerationUserPrompt(
  errors: SchemaFieldError[],
  payload: NexMetaAnalysisV1,
) {
  return [
    "A resposta anterior violou o schema estruturado NEX Intelligence v1.2.0.",
    "Reemita o JSON COMPLETO válido (observations, recommendations, executive_points, metric_traceability).",
    "Corrija exatamente os campos listados. Não invente evidências. Meta-only.",
    "Enums: action_kind=scale_budget|pause|replace_creative|test|monitor|other; confidence=low|medium|high; claim_kind=descriptive|performance_judgment|indirect_recommendation.",
    'Format: nex_intelligence_analysis_v1_2_0 (legado v1_1_* aceito em parse histórico).',
    "",
    "Erros de schema:",
    JSON.stringify(errors, null, 2),
    "",
    "Contexto resumido:",
    JSON.stringify({
      account_id: payload.account.id,
      period: payload.period,
      campaign_ids: payload.campaigns.map((c) => c.id),
      adset_ids: payload.adsets.map((a) => a.id),
      ad_ids: payload.ads.map((a) => a.id),
    }),
  ].join("\n");
}
