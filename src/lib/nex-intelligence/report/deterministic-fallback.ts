import type { MetaDataQualityReport } from "@/lib/nex-intelligence/quality/validate-export";
import type { NexMetaAnalysisV1 } from "@/lib/meta-export";

/** Relatório técnico mínimo Meta-only — sem hipóteses nem recomendações estratégicas. */
export function buildDeterministicFallbackReport(
  payload: NexMetaAnalysisV1,
  quality: MetaDataQualityReport,
  reason: string,
): string {
  void payload;
  void quality;
  void reason;
  throw new Error("legacy_publication_path_disabled");
}
