/** Cálculos determinísticos de indicadores Meta (precisão em centavos). */

export type MoneyCents = number;

/** Converte valor monetário (string/number Meta) para centavos inteiros. */
export function toMoneyCents(value: unknown): MoneyCents | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

export function fromMoneyCents(cents: MoneyCents | null): number | null {
  if (cents == null) return null;
  return Number((cents / 100).toFixed(2));
}

export function sumMoneyCents(values: Array<unknown>): MoneyCents | null {
  let total = 0;
  let seen = false;
  for (const value of values) {
    const cents = toMoneyCents(value);
    if (cents == null) continue;
    seen = true;
    total += cents;
  }
  return seen ? total : null;
}

export function sumNullableNumbers(values: Array<number | null | undefined>): number | null {
  let total = 0;
  let seen = false;
  for (const value of values) {
    if (value == null || !Number.isFinite(value)) continue;
    seen = true;
    total += value;
  }
  return seen ? total : null;
}

export function safeDivide(numerator: number | null, denominator: number | null): number | null {
  if (numerator == null || denominator == null) return null;
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) return null;
  return numerator / denominator;
}

/** CTR = clicks / impressions * 100 */
export function computeCtr(clicks: number | null, impressions: number | null): number | null {
  const ratio = safeDivide(clicks, impressions);
  return ratio == null ? null : Number((ratio * 100).toFixed(6));
}

/** CPC = spend / clicks */
export function computeCpc(spend: number | null, clicks: number | null): number | null {
  const value = safeDivide(spend, clicks);
  return value == null ? null : Number(value.toFixed(6));
}

/** CPM = spend / impressions * 1000 */
export function computeCpm(spend: number | null, impressions: number | null): number | null {
  const ratio = safeDivide(spend, impressions);
  return ratio == null ? null : Number((ratio * 1000).toFixed(6));
}

/** Custo por resultado = spend / results */
export function computeCostPerResult(spend: number | null, results: number | null): number | null {
  const value = safeDivide(spend, results);
  return value == null ? null : Number(value.toFixed(6));
}

export type AccountComputedMetrics = {
  currency: string;
  spend_total: number | null;
  spend_total_cents: MoneyCents | null;
  impressions_total: number | null;
  clicks_total: number | null;
  results_total: number | null;
  ctr: number | null;
  cpc: number | null;
  cpm: number | null;
  cost_per_result: number | null;
  /** Métricas usadas no total (não inclui alcance — não aditivo). */
  basis: "campaign_insights_spend";
};

export function computeAccountMetricsFromCampaignSpend(
  campaignSpends: Array<unknown>,
  extras: {
    currency: string;
    impressions?: Array<number | null | undefined>;
    clicks?: Array<number | null | undefined>;
    results?: Array<number | null | undefined>;
  },
): AccountComputedMetrics {
  const spendCents = sumMoneyCents(campaignSpends);
  const spend = fromMoneyCents(spendCents);
  const impressions = sumNullableNumbers(extras.impressions ?? []);
  const clicks = sumNullableNumbers(extras.clicks ?? []);
  const results = sumNullableNumbers(extras.results ?? []);
  return {
    currency: extras.currency,
    spend_total: spend,
    spend_total_cents: spendCents,
    impressions_total: impressions,
    clicks_total: clicks,
    results_total: results,
    ctr: computeCtr(clicks, impressions),
    cpc: computeCpc(spend, clicks),
    cpm: computeCpm(spend, impressions),
    cost_per_result: computeCostPerResult(spend, results),
    basis: "campaign_insights_spend",
  };
}

/** Diferença absoluta em centavos (null se algum lado ausente). */
export function moneyDiffCents(left: unknown, right: unknown): MoneyCents | null {
  const a = toMoneyCents(left);
  const b = toMoneyCents(right);
  if (a == null || b == null) return null;
  return a - b;
}

/** Tolerância de arredondamento monetário (1 centavo). */
export const MONEY_ROUNDING_TOLERANCE_CENTS = 1;
