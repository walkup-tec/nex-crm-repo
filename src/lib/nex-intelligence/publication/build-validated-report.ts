import type { AnalyticalStatus } from "@/lib/nex-intelligence/ai-output/types";
import type { ProcessClaimIRResult } from "@/lib/nex-intelligence/claim-ir/process";
import type { ValidatedClaimIR } from "@/lib/nex-intelligence/claim-ir/validate";
import type { MetaDataQualityReport } from "@/lib/nex-intelligence/quality/validate-export";
import { runFinalPublicationGate, type PublicationGateFailure } from "@/lib/nex-intelligence/publication/final-gate";
import { renderStage1FromIntegrity } from "@/lib/nex-intelligence/publication/stage1-integrity";
import type { NexMetaAnalysisV1 } from "@/lib/meta-export";

export type ValidatedReportResult = {
  markdown: string;
  analyticalStatus: AnalyticalStatus;
  publicationStatus: "pending_persist" | "not_ready";
  gate: {
    ok: boolean;
    failures: PublicationGateFailure[];
  };
  approvedClaims: ValidatedClaimIR[];
};

function composeReport(input: {
  stage1: string;
  stage2: string;
  stage3: string;
  stage4: string;
  note: string;
}): string {
  return [
    "## Etapa 1 — Validação dos dados",
    input.stage1,
    "",
    "## Etapa 2 — Análise independente",
    input.stage2,
    "",
    "## Etapa 3 — Recomendações",
    "### Recomendações aprovadas",
    input.stage3,
    "",
    "### Limitações relevantes",
    input.note,
    "",
    "## Etapa 4 — Resumo executivo",
    input.stage4,
  ].join("\n");
}

function deterministicSafeReport(
  payload: NexMetaAnalysisV1,
  quality: MetaDataQualityReport,
  reason: string,
): string {
  return composeReport({
    stage1: renderStage1FromIntegrity(payload, quality),
    stage2: "_Nenhuma afirmação analítica verificável disponível._",
    stage3: "_Nenhuma recomendação aprovada._",
    stage4: "_Sem conclusões analíticas publicáveis._",
    note: `- Relatório técnico determinístico reconstruído (${reason}).\n- Nenhum texto narrativo da IA foi publicado.`,
  });
}

/**
 * Única fronteira de publicação: recebe Claim IR já processado e devolve o
 * artefato publicável. Nenhum markdown/texto narrativo da IA é aceito aqui.
 */
export function buildValidatedReport(input: {
  payload: NexMetaAnalysisV1;
  quality: MetaDataQualityReport;
  claimIr: ProcessClaimIRResult;
  discardedOrRejected: number;
  parseOk: boolean;
}): ValidatedReportResult {
  const approvedClaims = input.claimIr.approved;
  const hasApproved = approvedClaims.length > 0;
  const candidateStatus: AnalyticalStatus = !hasApproved
    ? input.parseOk && input.claimIr.original.length === 0 && input.discardedOrRejected === 0
      ? "INSUFFICIENT_EVIDENCE"
      : "FALLBACK_DETERMINISTIC"
    : input.discardedOrRejected > 0
      ? "PARTIAL_VALIDATED"
      : "COMPLETED";

  const coverage = input.claimIr.objectives_coverage;
  const coverageNote = coverage
    ? [
        `- Cobertura dos objetivos: ${coverage.status}` +
          (coverage.primary_goal ? ` (prioritário: ${coverage.primary_goal})` : "") +
          `.`,
        ...coverage.notes.map((n) => `- ${n}`),
        `- Testes estratégicos E3: ${coverage.strategic_approved}; MONITOR: ${coverage.monitor_approved}.`,
      ].join("\n")
    : "";
  const analyticalMarkdown = composeReport({
    stage1: renderStage1FromIntegrity(input.payload, input.quality),
    stage2: input.claimIr.observations_markdown,
    stage3: input.claimIr.recommendations_markdown,
    stage4: input.claimIr.executive_markdown,
    note: [
      "- Somente Claim IR aprovado foi renderizado.",
      "- Markdown e texto narrativo da IA não foram publicados.",
      "- Publicação bem-sucedida ≠ objetivos atendidos; ver cobertura abaixo.",
      coverageNote,
    ]
      .filter(Boolean)
      .join("\n"),
  });
  const markdown = hasApproved
    ? analyticalMarkdown
    : deterministicSafeReport(
        input.payload,
        input.quality,
        input.parseOk ? "evidência insuficiente" : "resposta estruturada inválida",
      );

  const gate = runFinalPublicationGate({
    markdown,
    approvedClaims,
    publishedClaimIds: approvedClaims.map((claim) => claim.claim_id),
    stage1Source: "integrity",
    usedAiFreeText: false,
    analyticalStatusCandidate: candidateStatus,
  });

  if (!gate.ok) {
    return {
      markdown: deterministicSafeReport(input.payload, input.quality, "falha no gate final"),
      analyticalStatus: gate.analyticalStatus,
      publicationStatus: "not_ready",
      gate: { ok: false, failures: gate.failures },
      approvedClaims,
    };
  }

  return {
    markdown,
    analyticalStatus: gate.analyticalStatus,
    publicationStatus: "pending_persist",
    gate: { ok: true, failures: [] },
    approvedClaims,
  };
}
