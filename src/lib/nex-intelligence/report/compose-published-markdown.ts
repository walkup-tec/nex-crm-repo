import type { MetaDataQualityReport } from "@/lib/nex-intelligence/quality/validate-export";
import type { ValidatedClaim, ValidatedRecommendation } from "@/lib/nex-intelligence/ai-output/types";

function renderApprovedMarkdown(approved: ValidatedRecommendation[]): string {
  if (!approved.length) {
    return "_Nenhuma recomendação aprovada após validação determinística pós-IA._";
  }
  return approved
    .map((rec, index) => {
      return [
        `### ${index + 1}. ${rec.recommended_action}`,
        `- Entidade: ${rec.level} \`${rec.entity_id}\``,
        `- Indicadores: ${rec.indicators_used.join(", ")}`,
        `- Evidências: ${rec.evidence.join(" | ")}`,
        `- Hipótese: ${rec.hypothesis ?? "—"}`,
        `- Confiança: ${rec.confidence}`,
        `- Critério de validação: ${rec.validation_criterion}`,
        `- Status: APPROVED`,
      ].join("\n");
    })
    .join("\n\n");
}

export function renderClaimsMarkdown(claims: ValidatedClaim[], emptyLabel: string): string {
  const approved = claims.filter((c) => c.verdict === "APPROVED");
  if (!approved.length) return emptyLabel;
  return approved.map((claim) => `- ${claim.text}`).join("\n");
}

function renderLimitations(
  quality: MetaDataQualityReport,
  rejected: ValidatedRecommendation[],
  needsReview: ValidatedRecommendation[],
  rejectedClaims: ValidatedClaim[],
  parseError?: string,
  narrativeNote?: string,
): string {
  const lines: string[] = [];
  if (parseError) {
    lines.push(
      `- Falha estrutural na resposta da IA: \`${parseError}\`. Recomendações não verificadas não foram publicadas.`,
    );
  }
  if (quality.status !== "PASS") {
    lines.push(
      `- data_quality.status = ${quality.status}; métricas afetadas: ${quality.affected_metrics.join(", ") || "n/d"}.`,
    );
  }
  if (narrativeNote) lines.push(`- ${narrativeNote}`);
  for (const rec of [...rejected, ...needsReview]) {
    lines.push(
      `- Recomendação \`${rec.id}\` (${rec.verdict}) omitida: ${rec.rejection_reasons.join("; ") || "sem justificativa"}.`,
    );
  }
  for (const claim of rejectedClaims) {
    if (!claim.id || claim.id === "invalid-claim") continue;
    lines.push(
      `- Conclusão/trecho \`${claim.id}\` omitido: ${claim.rejection_reasons.join("; ") || "sem justificativa"}.`,
    );
  }
  if (!lines.length) return "_Sem limitações adicionais registradas._";
  return lines.join("\n");
}

export function composeExecutiveFromApproved(
  approvedClaims: ValidatedClaim[],
  approvedRecs: ValidatedRecommendation[],
  sanitizedFallback: string,
): string {
  const diagnosis = approvedClaims.map((c) => `- ${c.text}`);
  const actions = approvedRecs.map((rec) => `- ${rec.recommended_action} (\`${rec.entity_id}\`)`);
  const parts = [
    diagnosis.length ? diagnosis.join("\n") : sanitizedFallback || "_Sem conclusões verificáveis disponíveis._",
    "",
    "**Recomendações aprovadas (somente estas são ações válidas):**",
    actions.length ? actions.join("\n") : "- Nenhuma recomendação aprovada.",
  ];
  return parts.join("\n");
}

export function composePublishedMarkdown(input: {
  stage1: string;
  stage2: string;
  stage4: string;
  approved: ValidatedRecommendation[];
  rejected: ValidatedRecommendation[];
  needsReview: ValidatedRecommendation[];
  approvedObservations?: ValidatedClaim[];
  rejectedClaims?: ValidatedClaim[];
  quality: MetaDataQualityReport;
  parseError?: string;
  narrativeNote?: string;
}): string {
  const stage2Body =
    input.approvedObservations && input.approvedObservations.length
      ? renderClaimsMarkdown(input.approvedObservations, "_Sem observações verificáveis._")
      : input.stage2.trim() || "_Análise descritiva indisponível._";

  return [
    "## Etapa 1 — Validação dos dados",
    input.stage1.trim() || `_Status determinístico: ${input.quality.status}._`,
    "",
    "## Etapa 2 — Análise independente",
    stage2Body,
    "",
    "## Etapa 3 — Recomendações",
    "### Recomendações aprovadas",
    renderApprovedMarkdown(input.approved),
    "",
    "### Limitações relevantes",
    renderLimitations(
      input.quality,
      input.rejected,
      input.needsReview,
      input.rejectedClaims ?? [],
      input.parseError,
      input.narrativeNote,
    ),
    "",
    "## Etapa 4 — Resumo executivo",
    input.stage4.trim() || "_Resumo indisponível._",
  ].join("\n");
}
