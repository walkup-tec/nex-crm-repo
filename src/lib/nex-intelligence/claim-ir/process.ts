import type { MetaDataQualityReport } from "@/lib/nex-intelligence/quality/validate-export";
import type { NexMetaAnalysisV1 } from "@/lib/meta-export";
import { indexTracesById, type MetricTraceability } from "@/lib/nex-intelligence/trace";
import { buildBackendMetricTraceCatalog } from "@/lib/nex-intelligence/trace/build-catalog";
import { normalizeClaimIRDraft } from "@/lib/nex-intelligence/claim-ir/normalize-from-ai";
import { validateClaimIRList, type ValidatedClaimIR } from "@/lib/nex-intelligence/claim-ir/validate";
import {
  executiveClaimIdsFromApproved,
  recoverClaimIRList,
  type RecoveryTransformAudit,
} from "@/lib/nex-intelligence/recovery/transform";
import { buildMetricRegistry, type MetricRegistryEntry } from "@/lib/nex-intelligence/metrics/registry";
import {
  renderApprovedClaimsIR,
  renderExecutiveFromApprovedIR,
} from "@/lib/nex-intelligence/report/renderers";
import { deriveAnalyticalStatus } from "@/lib/nex-intelligence/pipeline/state-machine";
import {
  deriveObjectivesCoverage,
  type ObjectivesCoverage,
} from "@/lib/nex-intelligence/goals/objectives-coverage";
import type { ValidatedComparisonRef } from "@/lib/nex-intelligence/trace/build-comparisons";
import { renderClaimIR } from "@/lib/nex-intelligence/report/renderers";

export type ProcessClaimIRResult = {
  original: unknown[];
  normalized: unknown[];
  validated: ValidatedClaimIR[];
  recovered: ValidatedClaimIR[];
  approved: ValidatedClaimIR[];
  rejected: ValidatedClaimIR[];
  recovery_audits: RecoveryTransformAudit[];
  registry: MetricRegistryEntry[];
  observations_markdown: string;
  recommendations_markdown: string;
  executive_markdown: string;
  executive_claim_ids: string[];
  analytical_status: ReturnType<typeof deriveAnalyticalStatus>;
  objectives_coverage: ObjectivesCoverage;
};

/**
 * Pipeline E→G→H para Claim IR: validar → recuperar estrutural → revalidar → renderizar.
 */
export function processClaimIRPipeline(input: {
  drafts: unknown[];
  payload: NexMetaAnalysisV1;
  quality: MetaDataQualityReport;
  backendTraceability?: MetricTraceability;
  availableComparisons?: ValidatedComparisonRef[];
  usedAiConclusions?: boolean;
}): ProcessClaimIRResult {
  const catalog =
    input.backendTraceability ?? buildBackendMetricTraceCatalog(input.payload, input.quality);
  const traces = indexTracesById(catalog);
  const registry = buildMetricRegistry(input.payload, input.quality);

  const normalized = input.drafts.map((d) => normalizeClaimIRDraft(d));
  const validated = validateClaimIRList(normalized, input.payload, input.quality, traces);
  const { claims: recovered, audits } = recoverClaimIRList(
    validated,
    input.payload,
    input.quality,
    traces,
  );

  // Revalidação implícita já feita em recover (validateClaimIR). Filtrar aprovados.
  // METRIC_VALUE sem valor no registry não publica (renderer vazio).
  const approved = recovered.filter((c) => {
    if (c.verdict !== "APPROVED") return false;
    if (c.operation === "METRIC_VALUE" && !renderClaimIR(c, registry)) return false;
    return true;
  });
  const rejected = validated.filter((c) => c.verdict === "REJECTED");

  const observations = approved.filter(
    (c) =>
      c.operation === "METRIC_VALUE" ||
      c.operation === "PERIOD_COMPARISON" ||
      c.operation === "ENTITY_COMPARISON" ||
      c.operation === "QUALITATIVE_CLASSIFICATION" ||
      c.operation === "CAUSAL_HYPOTHESIS",
  );
  const recommendations = approved.filter(
    (c) => c.operation === "MONITOR" || c.operation === "STRATEGIC_TEST",
  );

  const usedFallbackOnly = approved.every(
    (c) => c.recovery_origin != null || c.operation === "METRIC_VALUE" || c.operation === "MONITOR",
  ) && (input.usedAiConclusions === false || approved.every((c) => c.recovery_origin));

  const analytical_status = deriveAnalyticalStatus({
    approvedCount: approved.length,
    discardedOrRejected: rejected.length + audits.filter((a) => a.discarded).length,
    usedAiConclusions: Boolean(input.usedAiConclusions) && approved.some((c) => !c.recovery_origin),
    usedFallbackOnly: Boolean(usedFallbackOnly && approved.length > 0 && !input.usedAiConclusions),
    technicalFailure: false,
  });

  const objectives = input.payload.metadata.analysis_objectives ?? null;
  const objectives_coverage = deriveObjectivesCoverage({
    objectives,
    approved,
    comparisons: input.availableComparisons ?? [],
    quality: input.quality,
  });

  return {
    original: input.drafts,
    normalized,
    validated,
    recovered,
    approved,
    rejected,
    recovery_audits: audits,
    registry,
    observations_markdown: renderApprovedClaimsIR(observations, registry),
    recommendations_markdown: renderApprovedClaimsIR(
      recommendations,
      registry,
      "_Nenhuma recomendação aprovada._",
    ),
    executive_markdown: renderExecutiveFromApprovedIR(approved, registry, input.quality),
    executive_claim_ids: executiveClaimIdsFromApproved(approved),
    analytical_status,
    objectives_coverage,
  };
}
