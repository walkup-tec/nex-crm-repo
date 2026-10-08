import type {
  MetaCampaignRow,
  MetaCampaignSnapshot,
  MetaDayPoint,
  MetaKpis,
  MetaPeriod,
} from "@/lib/meta-access";

export type Grain = "day" | "week" | "month";

export type MetricSet = {
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  results: number;
  resultLabel: string;
};

export type Rates = {
  ctr: number | null;
  cpc: number | null;
  cpm: number | null;
  frequency: number | null;
  costPerResult: number | null;
};

export type ChangeSense = "up-good" | "down-good" | "neutral";

export type Bucket = {
  date: string;
  label: string;
  spend: number;
  impressions: number;
  clicks: number;
  results: number;
  ctr: number | null;
  cpc: number | null;
  costPerResult: number | null;
};

export type CampaignRank = {
  id: string;
  name: string;
  results: number;
  spend: number;
  resultLabel: string;
  costPerResult: number | null;
};

export type NexInsight = {
  title: string;
  text: string;
  tone: "positive" | "attention" | "neutral";
};

export type AnalysisStatus = {
  label: "Evoluindo" | "Estável" | "Ponto de atenção";
  reasons: string[];
};

export type AnalysisModel = {
  comparable: boolean;
  resultLabel: string;
  current: MetricSet;
  previous: MetricSet | null;
  rates: Rates;
  previousRates: Rates | null;
  buckets: Bucket[];
  grain: Grain;
  campaigns: CampaignRank[];
  insights: NexInsight[];
  status: AnalysisStatus | null;
};

const months = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export function finite(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function ratesOf(metric: MetricSet): Rates {
  const ctr = metric.impressions > 0 ? (metric.clicks / metric.impressions) * 100 : null;
  const cpc = metric.clicks > 0 ? metric.spend / metric.clicks : null;
  const cpm = metric.impressions > 0 ? (metric.spend / metric.impressions) * 1000 : null;
  const frequency = metric.reach > 0 ? metric.impressions / metric.reach : null;
  const costPerResult = metric.results > 0 ? metric.spend / metric.results : null;
  return {
    ctr: finite(ctr),
    cpc: finite(cpc),
    cpm: finite(cpm),
    frequency: finite(frequency),
    costPerResult: finite(costPerResult),
  };
}

/** Share of the widest stage. Each level keeps the real ratio of its indicator. */
export function funnelStageWidths(amounts: readonly (number | null)[]): number[] {
  const max = amounts.reduce<number>((peak, amount) => {
    if (amount != null && amount > peak) return amount;
    return peak;
  }, 0);
  if (max <= 0) return amounts.map(() => 0);
  return amounts.map((amount) => (amount != null && amount > 0 ? amount / max : 0));
}

export function changePercent(current: number | null, previous: number | null) {
  const next = finite(current);
  const prior = finite(previous);
  if (next == null || prior == null) return null;
  if (prior === 0) return next === 0 ? 0 : null;
  const change = ((next - prior) / Math.abs(prior)) * 100;
  return finite(change);
}

export function defaultGrain(dayCount: number): Grain {
  if (dayCount <= 45) return "day";
  if (dayCount <= 180) return "week";
  return "month";
}

function parts(iso: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

export function formatDay(iso: string) {
  const value = parts(iso);
  if (!value) return iso;
  return `${String(value.day).padStart(2, "0")}/${String(value.month).padStart(2, "0")}/${value.year}`;
}

function bucketStart(iso: string, grain: Grain) {
  const value = parts(iso);
  if (!value) return iso;
  if (grain === "month") return `${value.year}-${String(value.month).padStart(2, "0")}-01`;
  if (grain === "day") return iso;
  const date = new Date(Date.UTC(value.year, value.month - 1, value.day));
  const weekday = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() - (weekday - 1));
  return date.toISOString().slice(0, 10);
}

function bucketLabel(iso: string, grain: Grain) {
  if (grain === "month") {
    const value = parts(iso);
    if (!value) return iso;
    return `${months[value.month - 1] ?? iso}/${value.year}`;
  }
  if (grain === "week") return `sem. ${formatDay(iso)}`;
  return formatDay(iso);
}

export function aggregateDays(days: MetaDayPoint[], grain: Grain): Bucket[] {
  const grouped = new Map<string, Bucket>();
  for (const day of days) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day.date)) continue;
    const key = bucketStart(day.date, grain);
    const current = grouped.get(key) ?? {
      date: key,
      label: bucketLabel(key, grain),
      spend: 0,
      impressions: 0,
      clicks: 0,
      results: 0,
      ctr: null,
      cpc: null,
      costPerResult: null,
    };
    current.spend += finite(day.spend) ?? 0;
    current.impressions += finite(day.impressions) ?? 0;
    current.clicks += finite(day.clicks) ?? 0;
    current.results += finite(day.results) ?? 0;
    grouped.set(key, current);
  }
  return [...grouped.values()]
    .sort((left, right) => left.date.localeCompare(right.date))
    .map((bucket) => {
      const derived = ratesOf({
        spend: bucket.spend,
        impressions: bucket.impressions,
        reach: 0,
        clicks: bucket.clicks,
        results: bucket.results,
        resultLabel: "",
      });
      return {
        ...bucket,
        ctr: derived.ctr,
        cpc: derived.cpc,
        costPerResult: derived.costPerResult,
      };
    });
}

function metricFromKpis(kpis: MetaKpis): MetricSet {
  return {
    spend: finite(kpis.spend) ?? 0,
    impressions: finite(kpis.impressions) ?? 0,
    reach: finite(kpis.reach) ?? 0,
    clicks: finite(kpis.clicks) ?? 0,
    results: finite(kpis.results) ?? 0,
    resultLabel: kpis.resultLabel || "Resultados",
  };
}

function metricFromCampaign(row: MetaCampaignRow): MetricSet {
  return {
    spend: finite(row.spend) ?? 0,
    impressions: finite(row.impressions) ?? 0,
    reach: finite(row.reach) ?? 0,
    clicks: finite(row.clicks) ?? 0,
    results: finite(row.results) ?? 0,
    resultLabel: row.resultLabel || "Resultados",
  };
}

function metricFromSnapshot(row: MetaCampaignSnapshot, resultLabel: string): MetricSet {
  return {
    spend: finite(row.spend) ?? 0,
    impressions: finite(row.impressions) ?? 0,
    reach: finite(row.reach) ?? 0,
    clicks: finite(row.clicks) ?? 0,
    results: finite(row.results) ?? 0,
    resultLabel,
  };
}

function zeroMetric(resultLabel: string): MetricSet {
  return { spend: 0, impressions: 0, reach: 0, clicks: 0, results: 0, resultLabel };
}

export function buildInsights(
  current: MetricSet,
  previous: MetricSet | null,
  currentRates: Rates,
  previousRates: Rates | null,
): NexInsight[] {
  if (!previous || !previousRates) return [];
  const insights: NexInsight[] = [];
  const resultsChange = changePercent(current.results, previous.results);
  const costChange = changePercent(currentRates.costPerResult, previousRates.costPerResult);
  const spendChange = changePercent(current.spend, previous.spend);
  const reachChange = changePercent(current.reach, previous.reach);
  const ctrChange = changePercent(currentRates.ctr, previousRates.ctr);

  if (resultsChange != null && resultsChange >= 5 && costChange != null && costChange <= -5) {
    insights.push({
      tone: "positive",
      title: "Campanha ganhando eficiência",
      text: `Você gerou ${formatPercent(resultsChange)} a mais em resultados enquanto o custo por resultado caiu ${formatPercent(Math.abs(costChange))}.`,
    });
  }
  if (
    reachChange != null &&
    reachChange >= 10 &&
    spendChange != null &&
    Math.abs(spendChange) < 8
  ) {
    insights.push({
      tone: "positive",
      title: "Maior alcance",
      text: `Sua campanha alcançou ${formatPercent(reachChange)} a mais em pessoas com um nível de investimento semelhante ao período anterior.`,
    });
  }
  if (
    ctrChange != null &&
    ctrChange >= 5 &&
    currentRates.ctr != null &&
    previousRates.ctr != null
  ) {
    insights.push({
      tone: "positive",
      title: "Mais interesse nos anúncios",
      text: `A taxa de cliques aumentou de ${formatPercent(previousRates.ctr)} para ${formatPercent(currentRates.ctr)} no período.`,
    });
  }
  if (costChange != null && costChange >= 10) {
    insights.push({
      tone: "attention",
      title: "Ponto de atenção",
      text: `O custo por resultado aumentou ${formatPercent(costChange)} em relação ao período anterior.`,
    });
  }
  if (resultsChange != null && resultsChange <= -10) {
    insights.push({
      tone: "attention",
      title: "Ponto de atenção",
      text: "O volume de resultados ficou abaixo do período anterior. Vale acompanhar a evolução da campanha.",
    });
  }
  return insights.slice(0, 4);
}

export function buildStatus(
  current: MetricSet,
  previous: MetricSet | null,
  currentRates: Rates,
  previousRates: Rates | null,
): AnalysisStatus | null {
  if (!previous || !previousRates) return null;
  const resultsChange = changePercent(current.results, previous.results);
  const costChange = changePercent(currentRates.costPerResult, previousRates.costPerResult);
  if (resultsChange == null && costChange == null) return null;
  const reasons: string[] = [];
  if (resultsChange != null)
    reasons.push(`Resultados ${resultsChange >= 0 ? "+" : ""}${formatPercent(resultsChange)}`);
  if (costChange != null)
    reasons.push(`Custo por resultado ${costChange >= 0 ? "+" : ""}${formatPercent(costChange)}`);
  const attention =
    (resultsChange != null && resultsChange <= -8) || (costChange != null && costChange >= 10);
  const evolving =
    resultsChange != null && resultsChange >= 8 && (costChange == null || costChange <= 0);
  const label = attention ? "Ponto de atenção" : evolving ? "Evoluindo" : "Estável";
  return { label, reasons };
}

export function buildAnalysis(input: {
  period: MetaPeriod;
  campaigns: MetaCampaignRow[];
  kpis: MetaKpis;
  previous: MetaKpis | null;
  previousReady: boolean;
  previousCampaigns: MetaCampaignSnapshot[];
  days: MetaDayPoint[];
  campaignId: string | null;
  grain?: Grain;
}): AnalysisModel {
  const selected = input.campaignId
    ? (input.campaigns.find((row) => row.id === input.campaignId) ?? null)
    : null;
  const labels = new Set((selected ? [selected] : input.campaigns).map((row) => row.resultLabel));
  const comparable = labels.size <= 1;
  const resultLabel = labels.size === 1 ? ([...labels][0] ?? "Resultados") : "Resultados";
  const current = selected
    ? metricFromCampaign(selected)
    : comparable
      ? { ...metricFromKpis(input.kpis), resultLabel }
      : { ...metricFromKpis(input.kpis), results: 0, resultLabel };
  const snapshot = selected
    ? (input.previousCampaigns.find((row) => row.id === selected.id) ?? null)
    : null;
  const previous = !input.previousReady
    ? null
    : selected
      ? snapshot
        ? metricFromSnapshot(snapshot, selected.resultLabel)
        : zeroMetric(selected.resultLabel)
      : input.previous
        ? { ...metricFromKpis(input.previous), resultLabel }
        : zeroMetric(resultLabel);
  const currentRates = ratesOf(comparable ? current : { ...current, results: 0 });
  const mediaPrevious = previous ? (comparable ? previous : { ...previous, results: 0 }) : null;
  const previousRates = mediaPrevious ? ratesOf(mediaPrevious) : null;
  const relevantDays = selected
    ? input.days.filter((day) => day.campaignId === selected.id)
    : comparable
      ? input.days
      : [];
  const grain = input.grain ?? defaultGrain(new Set(relevantDays.map((day) => day.date)).size);
  const campaigns = [...input.campaigns]
    .map((row) => ({
      id: row.id,
      name: row.name,
      results: finite(row.results) ?? 0,
      spend: finite(row.spend) ?? 0,
      resultLabel: row.resultLabel,
      costPerResult: ratesOf(metricFromCampaign(row)).costPerResult,
    }))
    .sort(
      (left, right) => right.results - left.results || left.name.localeCompare(right.name, "pt-BR"),
    );
  return {
    comparable,
    resultLabel,
    current: comparable ? current : { ...current, results: 0 },
    previous: mediaPrevious,
    rates: currentRates,
    previousRates,
    buckets: aggregateDays(relevantDays, grain),
    grain,
    campaigns,
    insights: buildInsights(
      comparable ? current : { ...current, results: 0 },
      mediaPrevious,
      currentRates,
      previousRates,
    ),
    status: comparable
      ? buildStatus(current, previous, currentRates, previous ? ratesOf(previous) : null)
      : null,
  };
}

export function formatInteger(value: number | null | undefined) {
  const number = finite(value);
  if (number == null) return "—";
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(number);
}

export function formatMoney(value: number | null | undefined, currency = "BRL") {
  const number = finite(value);
  if (number == null) return "—";
  try {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(number);
  } catch {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(number);
  }
}

export function formatPercent(value: number | null | undefined) {
  const number = finite(value);
  if (number == null) return "—";
  return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(number)}%`;
}

export function formatDecimal(value: number | null | undefined) {
  const number = finite(value);
  if (number == null) return "—";
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(number);
}

export function periodLength(period: MetaPeriod) {
  if (period.mode !== "custom") return null;
  const start = parts(period.since);
  const end = parts(period.until);
  if (!start || !end) return null;
  const from = Date.UTC(start.year, start.month - 1, start.day);
  const to = Date.UTC(end.year, end.month - 1, end.day);
  if (to < from) return null;
  return Math.round((to - from) / 86400000) + 1;
}
