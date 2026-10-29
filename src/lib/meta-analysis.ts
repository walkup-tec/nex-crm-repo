import type {
  MetaCampaignRow,
  MetaCampaignSnapshot,
  MetaDayPoint,
  MetaKpis,
  MetaPeriod,
} from "@/lib/meta-access";

export type CampaignMark = "ativa" | "desativada" | "erro";

export function campaignMark(row: Pick<MetaCampaignRow, "status" | "statusGroup">): CampaignMark {
  if (row.statusGroup === "Ativa") return "ativa";
  if (row.statusGroup === "Inativa" || row.statusGroup === "Encerrada") return "desativada";
  if (row.status === "Em análise") return "desativada";
  return "erro";
}

const deliveringStatuses = new Set(["ACTIVE", "IN_PROCESS", "PENDING_REVIEW", "PREAPPROVED"]);

export function campaignDeliveryGroup(input: {
  effectiveStatus: string | undefined;
  adStatuses: string[];
  adSetStatuses: string[];
}): { label: string; group: "Ativa" | "Inativa" } | null {
  if (input.effectiveStatus !== "ACTIVE" && input.effectiveStatus !== "IN_PROCESS") return null;
  const adOn = input.adStatuses.some((status) => deliveringStatuses.has(status));
  const adSetOn = input.adSetStatuses.some((status) => deliveringStatuses.has(status));
  if (adOn && adSetOn) {
    return input.effectiveStatus === "IN_PROCESS" ? { label: "Preparando", group: "Ativa" } : null;
  }
  if (input.adStatuses.length === 0) return { label: "Nenhum anúncio", group: "Inativa" };
  if (!adSetOn) return { label: "Conjunto de anúncios desativado", group: "Inativa" };
  return { label: "Anúncio desativado", group: "Inativa" };
}

const objectiveLabels: Record<string, string> = {
  link_click: "Cliques no link",
  lead: "Leads",
  "onsite_conversion.lead_grouped": "Leads",
  "offsite_conversion.fb_pixel_lead": "Leads",
  purchase: "Compras",
  omni_purchase: "Compras",
  "offsite_conversion.fb_pixel_purchase": "Compras",
  messaging_conversation_started_7d: "Conversas por mensagem iniciada",
  "onsite_conversion.messaging_conversation_started_7d": "Conversas por mensagem iniciada",
  messaging_first_reply: "Novos contatos de mensagem",
  "onsite_conversion.messaging_first_reply": "Novos contatos de mensagem",
  post_engagement: "Engajamentos",
  page_engagement: "Engajamentos",
  landing_page_view: "Visualizações da página",
  video_view: "Visualizações de vídeo",
  complete_registration: "Cadastros",
  contact: "Contatos",
  add_to_cart: "Adições ao carrinho",
  initiate_checkout: "Inícios de checkout",
  whatsapp_item_click: "Cliques no WhatsApp",
  "onsite_conversion.whatsapp_item_click": "Cliques no WhatsApp",
};

export function objectiveLabel(type: string | undefined) {
  if (!type) return "Resultados";
  const bare = type.includes(":") ? type.slice(type.indexOf(":") + 1) : type;
  if (objectiveLabels[bare]) return objectiveLabels[bare];
  if (bare.includes("messaging_conversation")) return "Conversas por mensagem iniciada";
  if (bare.includes("messaging_first_reply")) return "Novos contatos de mensagem";
  if (bare.includes("whatsapp")) return "Cliques no WhatsApp";
  if (/(^|\.)lead$|lead_grouped/.test(bare)) return "Leads";
  return "Resultados";
}

function resultAmount(value: unknown) {
  const parsed = typeof value === "string" || typeof value === "number" ? Number(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : 0;
}

export function adsManagerResult(entries: unknown): {
  results: number;
  resultLabel: string;
  resultActionTypes: string[];
} | null {
  if (!Array.isArray(entries) || entries.length === 0) return null;
  const parsed = entries.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const row = entry as {
      indicator?: string;
      action_type?: string;
      value?: string;
      values?: { value?: string; attribution_windows?: string[] }[];
    };
    const raw = row.indicator || row.action_type || "";
    const actionType = raw.includes(":") ? raw.slice(raw.indexOf(":") + 1) : raw;
    if (!actionType) return [];
    const chosen = Array.isArray(row.values)
      ? (row.values.find((item) => item.attribution_windows?.includes("default")) ?? row.values[0])
      : null;
    const value = row.value != null ? resultAmount(row.value) : resultAmount(chosen?.value);
    return [{ value, actionType, label: objectiveLabel(actionType) }];
  });
  if (parsed.length === 0) return null;
  const labels = new Set(parsed.map((item) => item.label));
  const chosen = labels.size === 1 ? parsed : [parsed[0]];
  return {
    results: chosen.reduce((sum, item) => sum + item.value, 0),
    resultLabel: chosen[0].label,
    resultActionTypes: [...new Set(chosen.map((item) => item.actionType))],
  };
}

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

export type ResultBreakdown = {
  label: string;
  results: number;
  costPerResult: number | null;
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
  breakdown: ResultBreakdown[];
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

export function metricFromCampaign(row: MetaCampaignRow): MetricSet {
  return {
    spend: finite(row.spend) ?? 0,
    impressions: finite(row.impressions) ?? 0,
    reach: finite(row.reach) ?? 0,
    clicks: finite(row.clicks) ?? 0,
    results: finite(row.results) ?? 0,
    resultLabel: row.resultLabel || "Resultados",
  };
}

export function activeCampaigns(rows: MetaCampaignRow[]) {
  return rows.filter((row) => row.statusGroup === "Ativa");
}

export type CompareMetricKey =
  | "costPerResult"
  | "reach"
  | "impressions"
  | "ctr"
  | "cpc"
  | "cpm";

export type CampaignCompareRow = {
  id: string;
  name: string;
  resultLabel: string;
  colorIndex: number;
  costPerResult: number | null;
  reach: number;
  impressions: number;
  ctr: number | null;
  cpc: number | null;
  cpm: number | null;
};

export type CampaignComparePanel = {
  key: CompareMetricKey;
  title: string;
  hint: string;
  lowerIsBetter: boolean;
  rows: { id: string; name: string; value: number | null; colorIndex: number }[];
};

const compareSpecs: {
  key: CompareMetricKey;
  title: string;
  hint: string;
  lowerIsBetter: boolean;
}[] = [
  {
    key: "costPerResult",
    title: "Custo por Resultado",
    hint: "Quanto você paga, em média, por cada resultado da campanha.",
    lowerIsBetter: true,
  },
  {
    key: "reach",
    title: "Alcance",
    hint: "Quantas pessoas únicas viram os anúncios no período.",
    lowerIsBetter: false,
  },
  {
    key: "impressions",
    title: "Impressões",
    hint: "Quantas vezes os anúncios foram exibidos no período.",
    lowerIsBetter: false,
  },
  {
    key: "ctr",
    title: "CTR (Taxa de cliques)",
    hint: "Percentual de impressões que geraram clique.",
    lowerIsBetter: false,
  },
  {
    key: "cpc",
    title: "CPC (Custo por clique)",
    hint: "Quanto você paga, em média, por cada clique.",
    lowerIsBetter: true,
  },
  {
    key: "cpm",
    title: "CPM (Custo por mil impressões)",
    hint: "Quanto você paga, em média, a cada mil impressões.",
    lowerIsBetter: true,
  },
];

const seriesColors = [
  "var(--primary)",
  "var(--info)",
  "var(--success)",
  "var(--warning)",
  "var(--cyan)",
  "var(--destructive)",
];

export function campaignSeriesColor(index: number) {
  return seriesColors[index] ?? `oklch(0.62 0.16 ${(index * 47) % 360})`;
}

export function campaignCompareMetrics(rows: MetaCampaignRow[]): {
  comparable: boolean;
  campaigns: CampaignCompareRow[];
  panels: CampaignComparePanel[];
} {
  const campaigns = rows.map((row, index) => {
    const rates = ratesOf(metricFromCampaign(row));
    return {
      id: row.id,
      name: row.name,
      resultLabel: row.resultLabel || "Resultados",
      colorIndex: index,
      costPerResult: rates.costPerResult,
      reach: finite(row.reach) ?? 0,
      impressions: finite(row.impressions) ?? 0,
      ctr: rates.ctr,
      cpc: rates.cpc,
      cpm: rates.cpm,
    };
  });
  const labels = new Set(campaigns.map((row) => row.resultLabel));
  const comparable = labels.size <= 1;
  const panels = compareSpecs.map((spec) => ({
    key: spec.key,
    title: spec.title,
    hint: spec.hint,
    lowerIsBetter: spec.lowerIsBetter,
    rows: [...campaigns]
      .map((row) => ({
        id: row.id,
        name: row.name,
        value: row[spec.key],
        colorIndex: row.colorIndex,
      }))
      .sort((left, right) => {
        if (left.value == null && right.value == null)
          return left.name.localeCompare(right.name, "pt-BR");
        if (left.value == null) return 1;
        if (right.value == null) return -1;
        const diff = spec.lowerIsBetter
          ? left.value - right.value
          : right.value - left.value;
        return diff || left.name.localeCompare(right.name, "pt-BR");
      }),
  }));
  return { comparable, campaigns, panels };
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

export function sumCampaignMetrics(rows: MetricSet[], resultLabel: string): MetricSet {
  return rows.reduce(
    (total, row) => ({
      spend: total.spend + (finite(row.spend) ?? 0),
      impressions: total.impressions + (finite(row.impressions) ?? 0),
      reach: total.reach + (finite(row.reach) ?? 0),
      clicks: total.clicks + (finite(row.clicks) ?? 0),
      results: total.results + (finite(row.results) ?? 0),
      resultLabel,
    }),
    zeroMetric(resultLabel),
  );
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

export function resultBreakdown(
  campaigns: Pick<MetaCampaignRow, "results" | "spend" | "resultLabel">[],
): ResultBreakdown[] {
  const groups = new Map<string, { results: number; spend: number }>();
  for (const row of campaigns) {
    const label = row.resultLabel.trim() || "Resultados";
    const current = groups.get(label) ?? { results: 0, spend: 0 };
    current.results += finite(row.results) ?? 0;
    current.spend += finite(row.spend) ?? 0;
    groups.set(label, current);
  }
  return [...groups.entries()]
    .map(([label, group]) => ({
      label,
      results: group.results,
      costPerResult: group.results > 0 ? group.spend / group.results : null,
    }))
    .sort((left, right) => right.results - left.results || left.label.localeCompare(right.label, "pt-BR"));
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
  const scoped = selected ? [selected] : input.campaigns;
  const current = scoped.length
    ? sumCampaignMetrics(scoped.map(metricFromCampaign), resultLabel)
    : { ...metricFromKpis(input.kpis), resultLabel };
  const snapshot = selected
    ? (input.previousCampaigns.find((row) => row.id === selected.id) ?? null)
    : null;
  const previousSnapshots = selected
    ? snapshot
      ? [metricFromSnapshot(snapshot, resultLabel)]
      : [zeroMetric(resultLabel)]
    : input.previousCampaigns.map((row) => metricFromSnapshot(row, resultLabel));
  const previous = !input.previousReady
    ? null
    : previousSnapshots.length
      ? sumCampaignMetrics(previousSnapshots, resultLabel)
      : input.previous
        ? { ...metricFromKpis(input.previous), resultLabel }
        : zeroMetric(resultLabel);
  const currentRates = ratesOf(current);
  const mediaPrevious = previous;
  const previousRates = mediaPrevious ? ratesOf(mediaPrevious) : null;
  const relevantDays = selected
    ? input.days.filter((day) => day.campaignId === selected.id)
    : input.days;
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
  const breakdown = resultBreakdown(selected ? [selected] : input.campaigns);
  return {
    comparable,
    resultLabel,
    current,
    previous: mediaPrevious,
    rates: currentRates,
    previousRates,
    buckets: aggregateDays(relevantDays, grain),
    grain,
    campaigns,
    breakdown,
    insights: buildInsights(current, mediaPrevious, currentRates, previousRates),
    status: buildStatus(current, previous, currentRates, previous ? ratesOf(previous) : null),
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
