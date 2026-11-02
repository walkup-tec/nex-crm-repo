import type { MetaDataQualityReport } from "@/lib/nex-intelligence/quality/validate-export";
import type { NexMetaAnalysisV1 } from "@/lib/meta-export";

/** Relatório técnico mínimo Meta-only — sem hipóteses nem recomendações estratégicas. */
export function buildDeterministicFallbackReport(
  payload: NexMetaAnalysisV1,
  quality: MetaDataQualityReport,
  reason: string,
): string {
  const verified = quality.verified_metrics ?? [];
  const compromised = quality.compromised_metrics ?? [];
  const checks = (quality.checks ?? [])
    .filter((c) => c.state !== "PASS")
    .slice(0, 12)
    .map((c) => `- ${c.code ?? c.metric}: ${c.state}${c.description ? ` — ${c.description}` : ""}`);

  const metricLines = verified.length
    ? verified.map((m) => `- ${m}: verificável deterministicamente`).join("\n")
    : "- Nenhuma métrica verificável disponível neste export.";

  return [
    "## Etapa 1 — Validação dos dados",
    `_Status de integridade: ${quality.status}._`,
    `_Período: ${payload.period.since ?? "?"} a ${payload.period.until ?? "?"} (${payload.period.timezone})._`,
    `_Coleta: ${payload.campaigns.length} campanhas, ${payload.adsets.length} conjuntos, ${payload.ads.length} anúncios._`,
    "",
    "## Etapa 2 — Análise independente",
    "_Relatório técnico determinístico (sem conclusões da IA)._",
    "",
    "### Métricas verificáveis",
    metricLines,
    "",
    "### Inconsistências identificadas",
    checks.length ? checks.join("\n") : "- Nenhuma inconsistência listada além do status acima.",
    compromised.length ? `Métricas comprometidas: ${compromised.join(", ")}.` : "",
    "",
    "## Etapa 3 — Recomendações",
    "### Recomendações aprovadas",
    "_Nenhuma — fallback determinístico não gera recomendações._",
    "",
    "### Limitações relevantes",
    `- Conclusões da IA indisponíveis: ${reason}`,
    "- Markdown bruto da IA não foi publicado.",
    "",
    "## Etapa 4 — Resumo executivo",
    "_Sem conclusões analíticas da IA. Apenas inventário e integridade Meta Marketing API._",
  ]
    .filter((line, idx, arr) => !(line === "" && arr[idx - 1] === ""))
    .join("\n");
}
