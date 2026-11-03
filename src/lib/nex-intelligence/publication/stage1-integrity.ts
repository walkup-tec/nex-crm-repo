import type { MetaDataQualityReport } from "@/lib/nex-intelligence/quality/validate-export";
import type { NexMetaAnalysisV1 } from "@/lib/meta-export";

/**
 * Etapa 1 — exclusivamente de integridade estruturada (nunca markdown da IA).
 */
export function renderStage1FromIntegrity(
  payload: NexMetaAnalysisV1,
  quality: MetaDataQualityReport,
): string {
  const period = payload.period;
  const lines: string[] = [
    `- Período analisado: ${period.since ?? "?"} a ${period.until ?? "?"} (${period.timezone || "America/Sao_Paulo"}).`,
    `- Cobertura do export: ${payload.campaigns.length} campanhas, ${payload.adsets.length} conjuntos, ${payload.ads.length} anúncios.`,
    `- Estado global de integridade: **${quality.status}**.`,
  ];

  if (quality.status === "NOT_VERIFIABLE") {
    lines.push(
      "- A integridade global não pôde ser integralmente verificada. Métricas com limitações de reconciliação constam abaixo; indicadores individuais classificados como PASS permanecem disponíveis para análise descritiva.",
    );
  } else if (quality.status === "WARNING" || quality.status === "FAIL") {
    lines.push(`- Há ressalvas de integridade (${quality.status}) que limitam conclusões dependentes das métricas afetadas.`);
  } else {
    lines.push("- Integridade dos dados Meta verificada para o escopo deste export.");
  }

  const affected = quality.affected_metrics?.filter(Boolean) ?? [];
  if (affected.length) {
    lines.push(`- Métricas afetadas (escopo quality): ${affected.join(", ")}.`);
  }

  const nonPass = (quality.checks ?? []).filter((c) => c.state !== "PASS").slice(0, 12);
  if (nonPass.length) {
    lines.push("- Checagens relevantes:");
    for (const check of nonPass) {
      const scope = check.entity_id ? `${check.level} \`${check.entity_id}\`` : check.level;
      lines.push(
        `  - ${check.code} (${scope}, ${check.metric}): ${check.state}${check.description ? ` — ${check.description}` : ""}`,
      );
    }
  }

  const verified = quality.verified_metrics?.filter(Boolean) ?? [];
  if (verified.length) {
    lines.push(`- Métricas verificáveis (PASS): ${verified.join(", ")}.`);
  }

  return lines.join("\n");
}
