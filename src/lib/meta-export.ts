export const META_ANALYSIS_SCHEMA_VERSION = "1.0.0";

export type MetaExportInsights = {
  spend: number | null;
  impressions: number | null;
  reach: number | null;
  frequency: number | null;
  clicks: number | null;
  link_clicks: number | null;
  ctr: number | null;
  link_ctr: number | null;
  cpc: number | null;
  link_cpc: number | null;
  cpm: number | null;
  results: number | null;
  cost_per_result: number | null;
};

export type MetaExportDailyInsight = {
  date: string;
  spend: number | null;
  impressions: number | null;
  reach: number | null;
  clicks: number | null;
  link_clicks: number | null;
  results: number | null;
};

export type MetaExportCampaign = {
  id: string;
  name: string;
  objective: string | null;
  status: string | null;
  effective_status: string | null;
  buying_type: string | null;
  daily_budget: number | null;
  lifetime_budget: number | null;
  optimization_goal: string | null;
  result_metric: string | null;
  insights: MetaExportInsights | null;
  daily_insights: MetaExportDailyInsight[];
  attribution_setting: string | null;
};

export type MetaExportAdset = {
  id: string;
  campaign_id: string;
  name: string;
  status: string | null;
  effective_status: string | null;
  optimization_goal: string | null;
  billing_event: string | null;
  daily_budget: number | null;
  lifetime_budget: number | null;
  targeting_summary: string | null;
  placements: string[] | null;
  attribution_setting: string | null;
  insights: MetaExportInsights | null;
  daily_insights: MetaExportDailyInsight[];
};

export type MetaExportAd = {
  id: string;
  campaign_id: string;
  adset_id: string;
  name: string;
  status: string | null;
  effective_status: string | null;
  creative: {
    id: string | null;
    format: string | null;
    headline: string | null;
    body: string | null;
    destination_type: string | null;
  };
  insights: MetaExportInsights | null;
  daily_insights: MetaExportDailyInsight[];
};

export type NexMetaAnalysisV1 = {
  schema_version: string;
  metadata: {
    source: "NEX";
    exported_at: string;
    currency: string;
    data_status: "live" | "partial";
    organization_id: string;
    client_name: string;
  };
  account: { id: string; name: string };
  period: { since: string | null; until: string | null; timezone: string };
  attribution: { setting: string | null; note: string };
  campaigns: MetaExportCampaign[];
  adsets: MetaExportAdset[];
  ads: MetaExportAd[];
  business_outcomes: {
    leads_received: null;
    qualified_leads: null;
    appointments: null;
    sales: null;
    revenue: null;
  };
  warnings: string[];
  /** Opcional / retrocompatível — preenchido pelo motor v1.1.1+. */
  data_quality?: unknown;
  computed_metrics?: unknown;
  extraction?: {
    campaigns_pages: number;
    adsets_pages: number;
    ads_pages: number;
    campaigns_truncated: boolean;
    adsets_truncated: boolean;
    ads_truncated: boolean;
  };
};

export function moneyFromMetaBudget(value: unknown): number | null {
  if (value == null || value === "") return null;
  const parsed = typeof value === "string" || typeof value === "number" ? Number(value) : Number.NaN;
  if (!Number.isFinite(parsed)) return null;
  return Number((parsed / 100).toFixed(2));
}

export function numberOrNull(value: unknown): number | null {
  if (value == null || value === "") return null;
  const parsed = typeof value === "string" || typeof value === "number" ? Number(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

export function textOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

type InsightAction = { action_type?: string; value?: string | number };

export function resultsFromActions(
  actions: InsightAction[] | undefined,
  preferredTypes: string[],
): { results: number | null; result_metric: string | null } {
  if (!actions?.length) return { results: null, result_metric: null };
  for (const type of preferredTypes) {
    const found = actions.find((entry) => entry.action_type === type);
    const value = numberOrNull(found?.value);
    if (found && value != null && value > 0) return { results: value, result_metric: type };
  }
  let best: { results: number; result_metric: string } | null = null;
  for (const entry of actions) {
    const type = textOrNull(entry.action_type);
    const value = numberOrNull(entry.value);
    if (!type || value == null || value <= 0) continue;
    if (!best || value > best.results) best = { results: value, result_metric: type };
  }
  return best ?? { results: null, result_metric: null };
}

export function mapMetaInsight(
  insight: Record<string, unknown> | null | undefined,
  preferredResultTypes: string[] = [],
): MetaExportInsights | null {
  if (!insight) return null;
  const actions = Array.isArray(insight.actions) ? (insight.actions as InsightAction[]) : undefined;
  const fromActions = resultsFromActions(actions, preferredResultTypes);
  const results =
    numberOrNull(
      Array.isArray(insight.results)
        ? (insight.results as { values?: { value?: string }[] }[])[0]?.values?.[0]?.value
        : undefined,
    ) ?? fromActions.results;
  const spend = numberOrNull(insight.spend);
  const costPerResult =
    numberOrNull(insight.cost_per_result) ??
    (spend != null && results != null && results > 0 ? Number((spend / results).toFixed(4)) : null);
  return {
    spend,
    impressions: numberOrNull(insight.impressions),
    reach: numberOrNull(insight.reach),
    frequency: numberOrNull(insight.frequency),
    clicks: numberOrNull(insight.clicks),
    link_clicks: numberOrNull(insight.inline_link_clicks),
    ctr: numberOrNull(insight.ctr),
    link_ctr: numberOrNull(insight.inline_link_click_ctr),
    cpc: numberOrNull(insight.cpc),
    link_cpc: numberOrNull(insight.cost_per_inline_link_click),
    cpm: numberOrNull(insight.cpm),
    results,
    cost_per_result: costPerResult,
  };
}

export function mapMetaDailyInsight(
  insight: Record<string, unknown>,
  preferredResultTypes: string[] = [],
): MetaExportDailyInsight | null {
  const date = textOrNull(insight.date_start) ?? textOrNull(insight.date_stop);
  if (!date) return null;
  const mapped = mapMetaInsight(insight, preferredResultTypes);
  return {
    date,
    spend: mapped?.spend ?? null,
    impressions: mapped?.impressions ?? null,
    reach: mapped?.reach ?? null,
    clicks: mapped?.clicks ?? null,
    link_clicks: mapped?.link_clicks ?? null,
    results: mapped?.results ?? null,
  };
}

export function targetingSummary(targeting: Record<string, unknown> | null | undefined): string | null {
  if (!targeting) return null;
  const parts: string[] = [];
  const ageMin = numberOrNull(targeting.age_min);
  const ageMax = numberOrNull(targeting.age_max);
  if (ageMin != null || ageMax != null) parts.push(`idade ${ageMin ?? "?"}-${ageMax ?? "?"}`);
  const genders = Array.isArray(targeting.genders) ? targeting.genders.map(String) : [];
  if (genders.length) parts.push(`gêneros ${genders.join(",")}`);
  const geo = targeting.geo_locations as { countries?: string[]; cities?: { name?: string }[] } | undefined;
  const countries = geo?.countries ?? [];
  if (countries.length) parts.push(`países ${countries.join(",")}`);
  const cities = (geo?.cities ?? []).map((city) => city.name).filter(Boolean);
  if (cities.length) parts.push(`cidades ${cities.slice(0, 5).join(",")}`);
  return parts.length ? parts.join("; ") : null;
}

export function metaAnalysisFileName(input: {
  accountId: string;
  since: string | null;
  until: string | null;
  exportedAt: string;
}) {
  const account = input.accountId.replace(/^act_/i, "") || "conta";
  const since = input.since ?? "inicio";
  const until = input.until ?? "fim";
  const stamp = input.exportedAt.slice(0, 19).replace(/[:T]/g, "-");
  return `nex_meta_analysis_${account}_${since}_${until}_${stamp}.json`;
}
