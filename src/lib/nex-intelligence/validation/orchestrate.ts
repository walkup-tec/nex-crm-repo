import type { MetaDataQualityReport } from "@/lib/nex-intelligence/quality/validate-export";
import type { NexMetaAnalysisV1 } from "@/lib/meta-export";
import {
  indexTracesById,
  type MetricTraceability,
  type MetricTraceRecord,
} from "@/lib/nex-intelligence/trace";
import { buildBackendMetricTraceCatalog } from "@/lib/nex-intelligence/trace/build-catalog";
import {
  rebindClaimTraces,
  rebindRecommendationTraces,
  replaceAiTraceabilityWithBackend,
  type TraceRebindAudit,
} from "@/lib/nex-intelligence/trace/rebind";
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
import { processClaimIRPipeline } from "@/lib/nex-intelligence/claim-ir/process";
import { buildValidatedReport } from "@/lib/nex-intelligence/publication/build-validated-report";
import { buildStrategicTestCandidates } from "@/lib/nex-intelligence/goals/strategic-candidates";

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
export async function processMetaAiRecommendations(input: {
  rawText: string;
  payload: NexMetaAnalysisV1;
  quality: MetaDataQualityReport;
  now?: string;
  /** Catálogo Camada C gerado ANTES da OpenAI. Se omitido, o motor gera aqui. */
  backendTraceability?: MetricTraceability;
  /** Regeneração de recomendações rejeitadas (conteúdo). No máx. 1 chamada extra por execução. */
  regenerate?: (invalid: ValidatedRecommendation[]) => Promise<string>;
  /** Regeneração estrutural do JSON completo. Mutuamente exclusiva com `regenerate`. */
  regenerateStructural?: (errors: SchemaFieldError[]) => Promise<string>;
}): Promise<ProcessRecommendationsResult> {
  const now = input.now ?? new Date().toISOString();
  const backendCatalog =
    input.backendTraceability ?? buildBackendMetricTraceCatalog(input.payload, input.quality);
  let initial = parseStructuredAnalysis(input.rawText, "initial");
  let regenerationAttempted = false;
  let regenerationKind: RecoveryAudit["regeneration_kind"] = "none";
  let regenerationValid: boolean | null = null;
  let secondary: StructuredAnalysisPayload | null = null;
  let extraAiCallUsed = false;
  const traceRebindAudits: TraceRebindAudit[] = [];

  const initialGenerationValid =
    initial.parse_ok &&
    (initial.claim_ir.length > 0 ||
      initial.observations.length > 0 ||
      initial.recommendations.length > 0 ||
      initial.executive_points.length > 0 ||
      initial.schema_errors.length === 0);

  function applyBackendTracesAndRebind(payload: StructuredAnalysisPayload): StructuredAnalysisPayload {
    const obs = payload.observations.map((row) => {
      const rebound = rebindClaimTraces({
        claim: row,
        kind: "observation",
        payload: input.payload,
        catalog: backendCatalog,
      });
      traceRebindAudits.push(rebound.audit);
      return rebound.claim;
    });
    const exec = payload.executive_points.map((row) => {
      const rebound = rebindClaimTraces({
        claim: row,
        kind: "executive_point",
        payload: input.payload,
        catalog: backendCatalog,
      });
      traceRebindAudits.push(rebound.audit);
      return rebound.claim;
    });
    const recs = payload.recommendations.map((row) => {
      const rebound = rebindRecommendationTraces({
        recommendation: row,
        payload: input.payload,
        catalog: backendCatalog,
      });
      traceRebindAudits.push(rebound.audit);
      return rebound.recommendation;
    });
    const usedBy = [
      ...obs.map((row) => ({ claimId: row.id, traceIds: row.trace_ids ?? [] })),
      ...exec.map((row) => ({ claimId: row.id, traceIds: row.trace_ids ?? [] })),
      ...recs.map((row) => ({ claimId: row.id, traceIds: row.trace_ids ?? [] })),
    ];
    return {
      ...payload,
      observations: obs,
      executive_points: exec,
      recommendations: recs,
      // IA nunca é fonte de verdade de traces — catálogo backend substitui metric_traceability.
      metric_traceability: replaceAiTraceabilityWithBackend(backendCatalog, usedBy),
    };
  }

  let working = applyBackendTracesAndRebind(initial);
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
      if (row.action_kind !== "monitor") continue;
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
        (secondary.claim_ir.length > 0 ||
          secondary.observations.length > 0 ||
          secondary.recommendations.length > 0 ||
          secondary.executive_points.length > 0);
      working = applyBackendTracesAndRebind(mergeStructuredPayloads(initial, secondary));
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
      const reboundCandidates = candidates.map((raw) => {
        if (!raw || typeof raw !== "object") return raw;
        const asRec = raw as Parameters<typeof rebindRecommendationTraces>[0]["recommendation"];
        // Normalize via existing list path after rebind of known fields when possible.
        try {
          const rebound = rebindRecommendationTraces({
            recommendation: asRec,
            payload: input.payload,
            catalog: backendCatalog,
          });
          traceRebindAudits.push(rebound.audit);
          return rebound.recommendation;
        } catch {
          return raw;
        }
      });
      working = {
        ...working,
        metric_traceability: replaceAiTraceabilityWithBackend(
          backendCatalog,
          reboundCandidates
            .filter((row): row is { id: string; trace_ids?: string[] } => !!row && typeof row === "object")
            .map((row) => ({
              claimId: String((row as { id?: string }).id ?? ""),
              traceIds: Array.isArray((row as { trace_ids?: string[] }).trace_ids)
                ? ((row as { trace_ids?: string[] }).trace_ids as string[])
                : [],
            })),
        ),
      };
      traces = indexTracesById(working.metric_traceability);
      const revalidated = validateRecommendationList(
        reboundCandidates,
        input.payload,
        input.quality,
        traces,
      );
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

  const stage2Dropped = observations.filter((c) => c.verdict !== "APPROVED").length;
  const stage4Dropped = executivePoints.filter((c) => c.verdict !== "APPROVED").length;

  // A validação legada acima permanece apenas como auditoria/recuperação de entrada.
  // Toda autoridade de publicação passa pelo Claim IR e por renderizadores determinísticos.
  // Claim IR explícito e envelopes legados passam juntos pela mesma autoridade.
  // A versão backend-validada da recomendação prevalece quando a IA reutiliza o ID.
  const claimDrafts = new Map<string, unknown>();
  for (const draft of [...working.claim_ir, ...working.observations, ...validated]) {
    const row = draft && typeof draft === "object" ? (draft as Record<string, unknown>) : null;
    const id = String(row?.claim_id ?? row?.id ?? `anonymous-${claimDrafts.size}`);
    claimDrafts.set(id, draft);
  }

  const availableComparisons = backendCatalog.records
    .filter((row) => row.trace_id.startsWith("nx-cmp-") && row.calculation.comparable === true)
    .map((row) => ({
      comparison_ref: row.trace_id,
      kind: row.trace_id.includes("-period-") ? ("PERIOD" as const) : ("ENTITY" as const),
      entity_level: row.entity_level as "campaign" | "adset" | "ad",
      entity_id: row.entity_id,
      other_entity_id: row.calculation.participant_entity_ids?.[1],
      metric: row.metric,
      operator: "delta_pct" as const,
      left_value: Number(row.calculation.inputs.left_value ?? 0),
      right_value: Number(row.calculation.inputs.right_value ?? 0),
      delta: Number(row.calculation.result ?? 0),
      result_event:
        typeof row.calculation.result_event === "string" ? row.calculation.result_event : null,
    }));

  const objectives = input.payload.metadata.analysis_objectives;
  // Sempre oferece candidatos determinísticos (IDs próprios). A IA pode trazer os seus;
  // validateClaimIR aprova só os com evidence E3 real — não inventa comparação.
  if (objectives?.selectedGoals?.length && availableComparisons.length) {
    for (const candidate of buildStrategicTestCandidates({
      objectives,
      comparisons: availableComparisons,
      limit: 3,
    })) {
      if (!claimDrafts.has(candidate.claim_id)) {
        claimDrafts.set(candidate.claim_id, candidate);
      }
    }
  }

  const claimIr = processClaimIRPipeline({
    drafts: [...claimDrafts.values()],
    payload: input.payload,
    quality: input.quality,
    backendTraceability: backendCatalog,
    availableComparisons,
    usedAiConclusions: true,
  });
  const report = buildValidatedReport({
    payload: input.payload,
    quality: input.quality,
    claimIr,
    discardedOrRejected:
      discardedItems + working.schema_errors.length + claimIr.rejected.length,
    parseOk: working.parse_ok,
  });
  const publishedMarkdown = report.markdown;
  const finalStatus: AnalyticalStatus =
    !input.payload?.account?.id ? "FAILED" : report.analyticalStatus;

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
    trace_rebinds: traceRebindAudits,
    backend_trace_catalog_size: backendCatalog.records.length,
  };

  const audit: RecommendationValidationAudit = {
    engine_version: META_AI_RECOMMENDATION_ENGINE,
    validated_at: now,
    parse_ok: working.parse_ok,
    ...(working.parse_error ? { parse_error: working.parse_error } : {}),
    regeneration_attempted: regenerationAttempted,
    analytical_status: finalStatus,
    schema_errors: working.schema_errors,
    recovery,
    recommendations: validated,
    observations,
    executive_points: executivePoints,
    published_recommendation_ids: claimIr.approved
      .filter((row) => row.operation === "MONITOR" || row.operation === "STRATEGIC_TEST")
      .map((row) => row.claim_id),
    rejected_recommendation_ids: rejected.map((row) => row.id),
    needs_review_ids: needsReview.map((row) => row.id),
    narrative_sanitization: {
      stage2_dropped: stage2Dropped,
      stage4_dropped: stage4Dropped,
      stage2_source: claimIr.approved.length ? "structured" : "empty",
      stage4_source: "approved_only",
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
    claimIr,
    publicationStatus: report.publicationStatus,
    publicationGate: report.gate,
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
    "A resposta anterior violou o schema estruturado NEX Intelligence v1.3.0.",
    "Reemita o JSON COMPLETO válido (observations, recommendations, executive_points, metric_traceability).",
    "Corrija exatamente os campos listados. Não invente evidências. Meta-only.",
    "Enums: action_kind=scale_budget|pause|replace_creative|test|monitor|other; confidence=low|medium|high; claim_kind=descriptive|performance_judgment|indirect_recommendation.",
    'Format: nex_intelligence_analysis_v1_3_0 (legado v1_1_*/v1_2_0 aceito em parse histórico).',
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
