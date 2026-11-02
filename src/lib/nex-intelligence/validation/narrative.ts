import type { MetaDataQualityReport } from "@/lib/nex-intelligence/quality/validate-export";
import type { NexMetaAnalysisV1 } from "@/lib/meta-export";
import { validateStructuredClaim } from "@/lib/nex-intelligence/validation/claims";
import {
  detectClaimKindFromText,
  inferMetricsFromText,
  resolveEntityFromText,
} from "@/lib/nex-intelligence/validation/entity-helpers";

function splitNarrativeUnits(text: string): string[] {
  return text
    .split(/\n{2,}|(?<=[.!?])\s+(?=[A-ZÀ-Ú])/)
    .map((unit) => unit.trim())
    .filter(Boolean);
}

/**
 * Sanitiza narrativa livre: remove julgamentos/recomendações indiretas
 * dependentes de métricas comprometidas na entidade referida.
 */
export function sanitizeNarrativeText(
  text: string,
  payload: NexMetaAnalysisV1,
  quality: MetaDataQualityReport,
  approvedActions: string[] = [],
): { text: string; dropped: number } {
  if (!text.trim()) return { text: "", dropped: 0 };
  const units = splitNarrativeUnits(text);
  const kept: string[] = [];
  let dropped = 0;

  for (const unit of units) {
    const resolved = resolveEntityFromText(unit, payload);
    const kind = detectClaimKindFromText(unit);
    const metrics = inferMetricsFromText(unit);
    const validated = validateStructuredClaim(
      {
        id: `narr-${kept.length + dropped + 1}`,
        entity_id: resolved.entity_id,
        level: resolved.level,
        metrics_used: metrics,
        claim_kind: kind,
        text: unit,
      },
      payload,
      quality,
      approvedActions,
    );
    if (validated.verdict === "APPROVED") kept.push(unit);
    else dropped += 1;
  }

  return { text: kept.join("\n\n"), dropped };
}
