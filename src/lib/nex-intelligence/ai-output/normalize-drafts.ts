import type { RecommendationActionKind } from "@/lib/nex-intelligence/ai-output/types";

const ACTION_KIND_ALIASES: Record<string, RecommendationActionKind> = {
  scale_budget: "scale_budget",
  scale: "scale_budget",
  increase_budget: "scale_budget",
  raise_budget: "scale_budget",
  boost_budget: "scale_budget",
  pause: "pause",
  pause_campaign: "pause",
  pause_adset: "pause",
  pause_ad: "pause",
  replace_creative: "replace_creative",
  change_creative: "replace_creative",
  new_creative: "replace_creative",
  test: "test",
  creative_test: "test",
  ab_test: "test",
  experiment: "test",
  monitor: "monitor",
  watch: "monitor",
  observe: "monitor",
  other: "other",
};

const CONFIDENCE_ALIASES: Record<string, "low" | "medium" | "high"> = {
  low: "low",
  baixo: "low",
  medium: "medium",
  med: "medium",
  medio: "medium",
  médio: "medium",
  high: "high",
  alto: "high",
};

/** Normaliza aliases comuns da IA antes da validação Zod estrita. */
export function normalizeRecommendationDraft(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const row = { ...(raw as Record<string, unknown>) };
  if (typeof row.action_kind === "string") {
    const key = row.action_kind.trim().toLowerCase().replace(/[\s-]+/g, "_");
    if (ACTION_KIND_ALIASES[key]) row.action_kind = ACTION_KIND_ALIASES[key];
  }
  if (typeof row.confidence === "string") {
    const key = row.confidence.trim().toLowerCase();
    if (CONFIDENCE_ALIASES[key]) row.confidence = CONFIDENCE_ALIASES[key];
  }
  if (!Array.isArray(row.indicators_used) && typeof row.metrics_used !== "undefined") {
    row.indicators_used = row.metrics_used;
  }
  if (!Array.isArray(row.evidence)) row.evidence = [];
  if (!Array.isArray(row.trace_ids)) row.trace_ids = [];
  return row;
}

export function normalizeClaimDraft(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const row = { ...(raw as Record<string, unknown>) };
  if (!Array.isArray(row.metrics_used)) row.metrics_used = [];
  if (!Array.isArray(row.trace_ids)) row.trace_ids = [];
  if (typeof row.claim_kind === "string") {
    const key = row.claim_kind.trim().toLowerCase().replace(/[\s-]+/g, "_");
    if (key === "judgment" || key === "performance") row.claim_kind = "performance_judgment";
    if (key === "recommendation" || key === "indirect") row.claim_kind = "indirect_recommendation";
    if (key === "fact" || key === "description") row.claim_kind = "descriptive";
  }
  return row;
}
