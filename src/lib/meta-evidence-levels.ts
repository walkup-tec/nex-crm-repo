import type { NexMetaAnalysisV1 } from "@/lib/meta-export";
import { normalizeCanonicalMetric } from "@/lib/meta-metric-traceability";

export type EvidenceLevel = "E0" | "E1" | "E2" | "E3";
export type EvidenceActionKind =
  | "scale_budget"
  | "pause"
  | "replace_creative"
  | "test"
  | "monitor"
  | "other";

export type EvidenceComparison = {
  type: "period_vs_period" | "campaign_vs_campaign" | "adset_vs_adset" | "ad_vs_ad" | "other";
  entity_ids?: string[];
  compatible: boolean;
  absolute_difference?: number | null;
  relative_difference_pct?: number | null;
  volumes?: Record<string, number>;
};

/** Classificações qualitativas sem referência comparativa validada. */
export const UNFOUNDED_QUALITATIVE_LABEL_RE =
  /\b(positiv[oa]s?|negativ[oa]s?|aceit[aá]ve(?:l|is)|elevad[oa]s?|baix[oa]s?|alt[oa]s?|bom|boa|bons|boas|ruim|ruins|excelente(?:s)?|frac[oa]s?|forte(?:s)?|fraco(?:s)?|eficiente(?:s)?|ineficiente(?:s)?|satisfat[oó]ri[oa]s?|insatisfat[oó]ri[oa]s?|adequado(?:s)?|inadequado(?:s)?|superior(?:es)?|inferior(?:es)?|destaque|ótimo(?:s)?|otimo(?:s)?|p[eé]ssim[oa]s?)\b/i;

export const CAUSAL_PROMISE_RE =
  /\b(garant(e|ia)|com certeza|causalidade|vai\s+(melhorar|aumentar|reduzir)|ir[aá]\s+(melhorar|aumentar)|provar[aá]|causa\s+direta)\b/i;

export const INVENTED_BENCHMARK_RE =
  /\b(benchmark|m[eé]dia\s+do\s+mercado|padr[aã]o\s+da\s+ind[uú]stria|acima\s+da\s+m[eé]dia\s+geral|ctr\s+ideal|meta\s+de\s+ctr\s+de)\b/i;

const LEVEL_RANK: Record<EvidenceLevel, number> = { E0: 0, E1: 1, E2: 2, E3: 3 };

export function evidenceLevelAtLeast(actual: EvidenceLevel, required: EvidenceLevel): boolean {
  return LEVEL_RANK[actual] >= LEVEL_RANK[required];
}

/** Evidência mínima por action_kind (protocolo v1.1.7). */
export function requiredEvidenceLevelForAction(actionKind: EvidenceActionKind): EvidenceLevel {
  switch (actionKind) {
    case "monitor":
      return "E1";
    case "scale_budget":
    case "pause":
    case "replace_creative":
    case "test":
      return "E3";
    case "other":
    default:
      return "E3";
  }
}

export function textHasUnfoundedQualitativeLabel(text: string): boolean {
  return UNFOUNDED_QUALITATIVE_LABEL_RE.test(text);
}

export function textHasCausalPromise(text: string): boolean {
  return CAUSAL_PROMISE_RE.test(text);
}

export function textHasInventedBenchmark(text: string): boolean {
  return INVENTED_BENCHMARK_RE.test(text);
}

function entityObjective(
  payload: NexMetaAnalysisV1,
  entityId: string,
): string | null {
  const campaign = payload.campaigns.find((c) => c.id === entityId);
  if (campaign) return campaign.objective ?? null;
  const adset = payload.adsets.find((a) => a.id === entityId);
  if (adset) {
    const parent = payload.campaigns.find((c) => c.id === adset.campaign_id);
    return parent?.objective ?? adset.optimization_goal ?? null;
  }
  const ad = payload.ads.find((a) => a.id === entityId);
  if (ad) {
    const parent = payload.campaigns.find((c) => c.id === ad.campaign_id);
    return parent?.objective ?? null;
  }
  return null;
}

function entityResultMetric(payload: NexMetaAnalysisV1, entityId: string): string | null {
  const campaign = payload.campaigns.find((c) => c.id === entityId);
  if (campaign) return campaign.result_metric ?? null;
  const adset = payload.adsets.find((a) => a.id === entityId);
  if (adset) {
    const parent = payload.campaigns.find((c) => c.id === adset.campaign_id);
    return parent?.result_metric ?? null;
  }
  const ad = payload.ads.find((a) => a.id === entityId);
  if (ad) {
    const parent = payload.campaigns.find((c) => c.id === ad.campaign_id);
    return parent?.result_metric ?? null;
  }
  return null;
}

/** Valida comparação estruturada entre entidades Meta compatíveis. */
export function validateEvidenceComparison(
  comparison: EvidenceComparison | null | undefined,
  payload: NexMetaAnalysisV1,
  primaryEntityId?: string | null,
): { ok: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (!comparison) {
    return { ok: false, reasons: ["comparison_missing"] };
  }
  if (!comparison.compatible) {
    reasons.push("comparison_marked_incompatible");
  }
  const ids = [...(comparison.entity_ids ?? [])];
  if (primaryEntityId && !ids.includes(primaryEntityId)) ids.unshift(primaryEntityId);
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length < 2 && comparison.type !== "period_vs_period") {
    reasons.push("comparison_requires_two_entities");
  }
  if (unique.length >= 2) {
    const objectives = unique.map((id) => entityObjective(payload, id));
    const resultMetrics = unique.map((id) => entityResultMetric(payload, id));
    if (objectives.some((o) => o == null)) {
      reasons.push("comparison_entity_objective_unknown");
    } else if (new Set(objectives).size > 1) {
      reasons.push("comparison_incompatible_objectives");
    }
    if (
      resultMetrics.every((m) => m != null) &&
      new Set(resultMetrics).size > 1
    ) {
      reasons.push("comparison_incompatible_result_events");
    }
  }
  const hasDiff =
    (comparison.absolute_difference != null && Number.isFinite(comparison.absolute_difference)) ||
    (comparison.relative_difference_pct != null && Number.isFinite(comparison.relative_difference_pct));
  if (!hasDiff && comparison.type !== "period_vs_period") {
    // Diferença pode ser omitida se volumes forem informados; ainda assim exige algum sinal.
    const volumeKeys = Object.keys(comparison.volumes ?? {});
    if (volumeKeys.length < 2) {
      reasons.push("comparison_difference_or_volumes_required");
    }
  }
  return { ok: reasons.length === 0, reasons };
}

export function indicatorsAreCtrOnly(indicators: string[]): boolean {
  const normalized = indicators.map(normalizeCanonicalMetric);
  return normalized.length > 0 && normalized.every((m) => m === "ctr" || m === "link_ctr");
}

export type ClassifyEvidenceInput = {
  baseOk: boolean;
  tracesOk: boolean;
  metricsCompromised: boolean;
  comparison?: EvidenceComparison | null;
  payload: NexMetaAnalysisV1;
  primaryEntityId?: string | null;
  hypothesis?: string | null;
  validationCriterion?: string | null;
  indicatorsUsed?: string[];
  forIntervention: boolean;
};

/**
 * Classifica o nível de evidência alcançado (não o exigido).
 * E0: base inválida; E1: fato rastreável; E2: + comparação válida; E3: + hipótese/critério para intervenção.
 */
export function classifyAchievedEvidenceLevel(input: ClassifyEvidenceInput): {
  level: EvidenceLevel;
  reasons: string[];
} {
  const reasons: string[] = [];
  if (!input.baseOk || !input.tracesOk || input.metricsCompromised) {
    return { level: "E0", reasons: ["evidence_e0_base_invalid"] };
  }

  let level: EvidenceLevel = "E1";

  const comparisonCheck = validateEvidenceComparison(
    input.comparison,
    input.payload,
    input.primaryEntityId,
  );
  if (comparisonCheck.ok) {
    level = "E2";
  } else if (input.forIntervention || input.comparison) {
    reasons.push(...comparisonCheck.reasons.map((r) => `evidence_e2:${r}`));
  }

  if (level === "E2" && input.forIntervention) {
    const hypothesis = (input.hypothesis ?? "").trim();
    const criterion = (input.validationCriterion ?? "").trim();
    if (!hypothesis) reasons.push("evidence_e3:hypothesis_missing");
    if (!criterion) reasons.push("evidence_e3:validation_criterion_missing");
    if (indicatorsAreCtrOnly(input.indicatorsUsed ?? [])) {
      reasons.push("evidence_e3:ctr_only_insufficient_for_intervention");
    }
    if (!reasons.some((r) => r.startsWith("evidence_e3:"))) {
      level = "E3";
    }
  }

  return { level, reasons };
}

export function claimRequiresComparativeEvidence(text: string, claimKind: string): boolean {
  if (claimKind === "performance_judgment") return true;
  if (textHasUnfoundedQualitativeLabel(text)) return true;
  return false;
}
