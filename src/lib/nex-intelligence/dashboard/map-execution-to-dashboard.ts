import type { MetaAiExecutionDetail } from "@/lib/meta-ai-calibration";
import type {
  MetaExportCampaign,
  MetaExportDailyInsight,
  MetaExportInsights,
  NexMetaAnalysisV1,
} from "@/lib/meta-export";
import {
  computeCostPerResult,
  computeCpc,
  computeCpm,
  computeCtr,
} from "@/lib/nex-intelligence/metrics/formulas";
import type {
  CampaignOption,
  DailySeriesPoint,
  DashboardMetric,
  InsightItem,
  IntelligenceDashboardView,
  MetricComparison,
  MetricKey,
  MetricQuality,
  SuggestedTask,
} from "@/lib/nex-intelligence/dashboard/types";
import {
  humanizeEntityMentionsInText,
  resolveEntityDisplayName,
} from "@/lib/nex-intelligence/dashboard/entity-labels";

const METRIC_META: Record<
  MetricKey,
  { label: string; unit: DashboardMetric["unit"]; desirableDirection: DashboardMetric["desirableDirection"] }
> = {
  results: { label: "Resultados", unit: "count", desirableDirection: "up" },
  cost_per_result: { label: "Custo por resultado", unit: "currency", desirableDirection: "down" },
  spend: { label: "Investimento", unit: "currency", desirableDirection: "neutral" },
  ctr: { label: "CTR", unit: "ratio_pct", desirableDirection: "up" },
  cpc: { label: "CPC", unit: "currency", desirableDirection: "down" },
  cpm: { label: "CPM", unit: "currency", desirableDirection: "down" },
  clicks: { label: "Cliques", unit: "count", desirableDirection: "up" },
  impressions: { label: "Impressões", unit: "count", desirableDirection: "neutral" },
  reach: { label: "Alcance", unit: "count", desirableDirection: "up" },
  frequency: { label: "Frequência", unit: "other", desirableDirection: "neutral" },
};

const PRIORITY_METRICS: MetricKey[] = [
  "results",
  "cost_per_result",
  "spend",
  "ctr",
  "cpc",
  "cpm",
];

function isMetaExport(value: unknown): value is NexMetaAnalysisV1 {
  return Boolean(
    value &&
      typeof value === "object" &&
      Array.isArray((value as NexMetaAnalysisV1).campaigns) &&
      (value as NexMetaAnalysisV1).account,
  );
}

function sumNullable(values: Array<number | null | undefined>): number | null {
  let total = 0;
  let seen = false;
  for (const value of values) {
    if (value == null || !Number.isFinite(value)) continue;
    total += value;
    seen = true;
  }
  return seen ? total : null;
}

function aggregateInsights(rows: MetaExportInsights[]): MetaExportInsights | null {
  if (!rows.length) return null;
  const spend = sumNullable(rows.map((row) => row.spend));
  const impressions = sumNullable(rows.map((row) => row.impressions));
  const clicks = sumNullable(rows.map((row) => row.clicks));
  const link_clicks = sumNullable(rows.map((row) => row.link_clicks));
  const results = sumNullable(rows.map((row) => row.results));
  // reach/frequency não são somáveis entre entidades/períodos.
  return {
    spend,
    impressions,
    reach: null,
    frequency: null,
    clicks,
    link_clicks,
    ctr: computeCtr(clicks, impressions),
    link_ctr: computeCtr(link_clicks, impressions),
    cpc: computeCpc(spend, clicks),
    link_cpc: computeCpc(spend, link_clicks),
    cpm: computeCpm(spend, impressions),
    results,
    cost_per_result: computeCostPerResult(spend, results),
  };
}

function aggregateDaily(rows: MetaExportDailyInsight[]): DailySeriesPoint[] {
  const byDate = new Map<string, MetaExportDailyInsight[]>();
  for (const row of rows) {
    if (!row.date) continue;
    const list = byDate.get(row.date) ?? [];
    list.push(row);
    byDate.set(row.date, list);
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, dayRows]) => {
      const spend = sumNullable(dayRows.map((row) => row.spend));
      const impressions = sumNullable(dayRows.map((row) => row.impressions));
      const clicks = sumNullable(dayRows.map((row) => row.clicks));
      const results = sumNullable(dayRows.map((row) => row.results));
      return {
        date,
        results,
        spend,
        clicks,
        impressions,
        ctr: computeCtr(clicks, impressions),
        cpc: computeCpc(spend, clicks),
        cpm: computeCpm(spend, impressions),
        cost_per_result: computeCostPerResult(spend, results),
      };
    });
}

/** Preenche dias faltantes no intervalo para o gráfico cobrir o período inteiro. */
export function fillDailySeriesGaps(
  series: DailySeriesPoint[],
  periodStart: string | null,
  periodEnd: string | null,
): DailySeriesPoint[] {
  if (!periodStart || !periodEnd) return series;
  const start = Date.parse(`${periodStart}T12:00:00`);
  const end = Date.parse(`${periodEnd}T12:00:00`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return series;

  const byDate = new Map(series.map((point) => [point.date, point]));
  const filled: DailySeriesPoint[] = [];
  for (let cursor = start; cursor <= end; cursor += 24 * 60 * 60 * 1000) {
    const date = new Date(cursor);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    filled.push(
      byDate.get(key) ?? {
        date: key,
        results: 0,
        spend: 0,
        clicks: 0,
        impressions: 0,
        ctr: null,
        cpc: null,
        cpm: null,
        cost_per_result: null,
      },
    );
  }
  return filled;
}

/** Agrega pontos diários da Meta Performance (por campanha) em série única. */
export function seriesFromMetaDays(
  days: Array<{
    date: string;
    campaignId: string;
    spend: number;
    impressions: number;
    clicks: number;
    results: number;
  }>,
  campaignIds?: string[],
): DailySeriesPoint[] {
  const selected = campaignIds?.length ? new Set(campaignIds) : null;
  const filtered = selected
    ? days.filter((row) => selected.has(row.campaignId))
    : days;
  return aggregateDaily(
    filtered.map((row) => ({
      date: row.date,
      spend: row.spend,
      impressions: row.impressions,
      clicks: row.clicks,
      results: row.results,
      reach: null,
      link_clicks: null,
    })),
  );
}

function qualityFromPresence(value: number | null, dataStatus: string | null): MetricQuality {
  if (value == null) return "UNAVAILABLE";
  if (dataStatus === "partial") return "WARNING";
  return "PASS";
}

function metricFromInsights(
  key: MetricKey,
  insights: MetaExportInsights | null,
  periodStart: string | null,
  periodEnd: string | null,
  dataStatus: string | null,
): DashboardMetric {
  const meta = METRIC_META[key];
  let value: number | null = null;
  if (insights) {
    switch (key) {
      case "results":
        value = insights.results;
        break;
      case "cost_per_result":
        value = insights.cost_per_result;
        break;
      case "spend":
        value = insights.spend;
        break;
      case "ctr":
        value = insights.ctr;
        break;
      case "cpc":
        value = insights.cpc;
        break;
      case "cpm":
        value = insights.cpm;
        break;
      case "clicks":
        value = insights.clicks;
        break;
      case "impressions":
        value = insights.impressions;
        break;
      case "reach":
        value = insights.reach;
        break;
      case "frequency":
        value = insights.frequency;
        break;
    }
  }
  return {
    key,
    label: meta.label,
    value,
    unit: meta.unit,
    quality: qualityFromPresence(value, dataStatus),
    desirableDirection: meta.desirableDirection,
    periodStart,
    periodEnd,
    sourceTraceIds: insights ? [`meta:insights:${key}`] : [],
  };
}

function assessComparison(
  key: MetricKey,
  before: number | null,
  after: number | null,
): MetricComparison["assessment"] {
  if (before == null || after == null) return "NOT_ASSESSED";
  const direction = METRIC_META[key].desirableDirection;
  if (direction === "neutral") return "INCONCLUSIVE";
  if (after === before) return "INCONCLUSIVE";
  const improved = direction === "up" ? after > before : after < before;
  return improved ? "IMPROVED" : "WORSENED";
}

function buildPointComparison(
  beforePoint: DailySeriesPoint,
  afterPoint: DailySeriesPoint,
  periodStart: string | null,
  periodEnd: string | null,
  dataStatus: string | null,
): MetricComparison[] {
  return PRIORITY_METRICS.map((key) => {
    const beforeValue = beforePoint[key] ?? null;
    const afterValue = afterPoint[key] ?? null;
    const before = metricFromInsights(
      key,
      null,
      beforePoint.date,
      beforePoint.date,
      dataStatus,
    );
    before.value = beforeValue;
    before.quality = qualityFromPresence(beforeValue, dataStatus);
    const after = metricFromInsights(key, null, afterPoint.date, afterPoint.date, dataStatus);
    after.value = afterValue;
    after.quality = qualityFromPresence(afterValue, dataStatus);

    let absoluteDelta: number | null = null;
    let relativeDeltaPercent: number | null = null;
    let pointsDelta: number | null = null;
    let comparisonStatus: MetricComparison["comparisonStatus"] = "VALID";

    if (beforeValue == null || afterValue == null) {
      comparisonStatus = "INSUFFICIENT";
    } else {
      absoluteDelta = afterValue - beforeValue;
      if (key === "ctr") {
        pointsDelta = absoluteDelta;
      }
      if (beforeValue === 0) {
        relativeDeltaPercent = afterValue === 0 ? 0 : null;
        // Mantém VALID para permitir badge (ex.: "novo") quando a base anterior é zero.
      } else {
        relativeDeltaPercent = (absoluteDelta / Math.abs(beforeValue)) * 100;
      }
    }

    return {
      metricKey: key,
      before,
      after,
      absoluteDelta,
      relativeDeltaPercent,
      pointsDelta,
      comparisonStatus,
      assessment:
        comparisonStatus === "VALID" ? assessComparison(key, beforeValue, afterValue) : "NOT_ASSESSED",
    };
  }).map((row) => ({
    ...row,
    before: {
      ...row.before!,
      periodStart: row.before?.periodStart ?? periodStart,
      periodEnd: row.before?.periodEnd ?? periodEnd,
    },
    after: {
      ...row.after!,
      periodStart: row.after?.periodStart ?? periodStart,
      periodEnd: row.after?.periodEnd ?? periodEnd,
    },
  }));
}

/** Compara o penúltimo dia com o último (visão diária). */
function buildDayComparison(
  series: DailySeriesPoint[],
  periodStart: string | null,
  periodEnd: string | null,
  dataStatus: string | null,
): MetricComparison[] {
  if (series.length < 2) return [];
  return buildPointComparison(
    series[series.length - 2]!,
    series[series.length - 1]!,
    periodStart,
    periodEnd,
    dataStatus,
  );
}

/** Compara o primeiro dia da série com o último (visão do período na análise manual). */
export function buildEndpointComparison(
  series: DailySeriesPoint[],
  periodStart: string | null,
  periodEnd: string | null,
  dataStatus: string | null,
): MetricComparison[] {
  if (series.length < 2) return [];
  return buildPointComparison(series[0]!, series[series.length - 1]!, periodStart, periodEnd, dataStatus);
}

export type PeriodTotals = {
  results: number | null;
  spend: number | null;
  clicks: number | null;
  impressions: number | null;
  reach: number | null;
  ctr: number | null;
  cpc: number | null;
  cpm: number | null;
  cost_per_result: number | null;
};

/** Totais do período atual vs. período equivalente anterior (ex.: semana vs. semana anterior). */
export function buildPeriodOverPeriodComparison(
  current: PeriodTotals,
  previous: PeriodTotals,
  periodStart: string | null,
  periodEnd: string | null,
  dataStatus: string | null = null,
): MetricComparison[] {
  const beforePoint: DailySeriesPoint = {
    date: periodStart ?? "previous",
    results: previous.results,
    spend: previous.spend,
    clicks: previous.clicks,
    impressions: previous.impressions,
    ctr: previous.ctr,
    cpc: previous.cpc,
    cpm: previous.cpm,
    cost_per_result: previous.cost_per_result,
  };
  const afterPoint: DailySeriesPoint = {
    date: periodEnd ?? "current",
    results: current.results,
    spend: current.spend,
    clicks: current.clicks,
    impressions: current.impressions,
    ctr: current.ctr,
    cpc: current.cpc,
    cpm: current.cpm,
    cost_per_result: current.cost_per_result,
  };
  return buildPointComparison(beforePoint, afterPoint, periodStart, periodEnd, dataStatus);
}

export function totalsFromCounts(input: {
  results: number;
  spend: number;
  clicks: number;
  impressions: number;
  reach?: number;
}): PeriodTotals {
  const results = input.results;
  const spend = input.spend;
  const clicks = input.clicks;
  const impressions = input.impressions;
  return {
    results,
    spend,
    clicks,
    impressions,
    reach: input.reach ?? null,
    ctr: computeCtr(clicks, impressions),
    cpc: computeCpc(spend, clicks),
    cpm: computeCpm(spend, impressions),
    cost_per_result: computeCostPerResult(spend, results),
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function extractApprovedClaims(outputJson: Record<string, unknown>): unknown[] {
  const claimIr = asRecord(outputJson.claim_ir);
  const approved = claimIr?.approved;
  return Array.isArray(approved) ? approved : [];
}

function claimToTask(
  raw: unknown,
  index: number,
  payload: NexMetaAnalysisV1 | null,
): SuggestedTask | null {
  const row = asRecord(raw);
  if (!row) return null;
  const claimId = typeof row.claim_id === "string" ? row.claim_id : `claim-${index}`;
  const operation = typeof row.operation === "string" ? row.operation : "";
  const args = asRecord(row.args) ?? {};
  const evidenceRaw =
    typeof row.evidence_level === "string"
      ? row.evidence_level
      : typeof row.requested_evidence_level === "string"
        ? row.requested_evidence_level
        : null;
  const evidenceLevel =
    evidenceRaw === "E0" || evidenceRaw === "E1" || evidenceRaw === "E2" || evidenceRaw === "E3"
      ? evidenceRaw
      : null;

  let title = "Recomendação validada";
  let justification = "";
  let kind: SuggestedTask["kind"] = "action";
  let priority: SuggestedTask["priority"] = "medium";

  if (operation === "STRATEGIC_TEST") {
    title =
      typeof args.action === "string" && args.action.trim()
        ? args.action.trim()
        : "Teste estratégico";
    justification =
      typeof args.hypothesis === "string"
        ? args.hypothesis
        : typeof args.validation_criterion === "string"
          ? args.validation_criterion
          : "";
    kind = "test";
    priority = "high";
  } else if (operation === "MONITOR") {
    // Monitoramento não é otimização operacional (sem Aplicar/Rejeitar).
    return null;
  } else if (operation === "CAUSAL_HYPOTHESIS") {
    title = "Hipótese a investigar";
    justification = typeof args.premise === "string" ? args.premise : "";
    kind = "hypothesis";
    priority = "medium";
  } else if (operation === "QUALITATIVE_CLASSIFICATION") {
    title = typeof args.label === "string" ? args.label : "Classificação qualitativa";
    justification = typeof args.criterion === "string" ? args.criterion : "";
    kind = "action";
  } else {
    // Observações E1 / métricas não viram tarefa de otimização.
    return null;
  }

  const entityLevel = typeof row.entity_level === "string" ? row.entity_level : null;
  const entityId = typeof row.entity_id === "string" ? row.entity_id : null;
  const entityName = resolveEntityDisplayName(payload, entityLevel, entityId);

  return {
    id: claimId,
    claimId,
    title: humanizeEntityMentionsInText(title, payload),
    justification: humanizeEntityMentionsInText(justification, payload),
    priority,
    evidenceLevel,
    kind,
    entityLevel,
    entityId,
    entityName,
    status: "PENDING",
    appliedAt: null,
  };
}

function extractInsights(outputJson: Record<string, unknown>, tasks: SuggestedTask[]): InsightItem[] {
  const insights: InsightItem[] = [];
  const claimIr = asRecord(outputJson.claim_ir);
  const approved = Array.isArray(claimIr?.approved) ? claimIr.approved : [];

  for (const raw of approved) {
    const row = asRecord(raw);
    if (!row) continue;
    const operation = typeof row.operation === "string" ? row.operation : "";
    const args = asRecord(row.args) ?? {};
    const evidenceRaw =
      typeof row.evidence_level === "string"
        ? row.evidence_level
        : typeof row.requested_evidence_level === "string"
          ? row.requested_evidence_level
          : null;
    const evidenceLevel =
      evidenceRaw === "E0" || evidenceRaw === "E1" || evidenceRaw === "E2" || evidenceRaw === "E3"
        ? evidenceRaw
        : null;
    const claimId = typeof row.claim_id === "string" ? row.claim_id : null;

    if (operation === "PERIOD_COMPARISON" || operation === "METRIC_VALUE") {
      const metric = typeof args.metric === "string" ? args.metric : "indicador";
      insights.push({
        kind: "performance",
        title: "Desempenho observado",
        body: `Indicador ${metric} com evidência ${evidenceLevel ?? "validada"} na execução.`,
        evidenceLevel,
        claimId,
      });
    } else if (operation === "MONITOR") {
      insights.push({
        kind: "next_step",
        title: "Próximo passo",
        body: "Manter monitoramento dos indicadores aprovados pelo protocolo.",
        evidenceLevel,
        claimId,
      });
    }
  }

  const opportunity = tasks.find((task) => task.kind === "test" || task.kind === "action");
  if (opportunity) {
    insights.push({
      kind: "opportunity",
      title: "Oportunidade",
      body: opportunity.justification || opportunity.title,
      evidenceLevel: opportunity.evidenceLevel,
      claimId: opportunity.claimId,
    });
  }

  const next = tasks.find((task) => task.kind === "monitor");
  if (next && !insights.some((item) => item.kind === "next_step")) {
    insights.push({
      kind: "next_step",
      title: "Próximo passo",
      body: next.justification || next.title,
      evidenceLevel: next.evidenceLevel,
      claimId: next.claimId,
    });
  }

  return insights.slice(0, 6);
}

function emptyView(partial?: Partial<IntelligenceDashboardView>): IntelligenceDashboardView {
  return {
    executionId: null,
    organizationId: null,
    clientName: "",
    accountId: "",
    accountName: "",
    campaignId: null,
    campaignName: null,
    resultEventLabel: "Conversões",
    periodStart: null,
    periodEnd: null,
    timezone: "America/Sao_Paulo",
    analyticalStatus: null,
    publicationStatus: null,
    protocolVersion: null,
    dataQualityStatus: null,
    currency: "BRL",
    metrics: PRIORITY_METRICS.map((key) => metricFromInsights(key, null, null, null, null)),
    comparisons: [],
    series: [],
    insights: [],
    tasks: [],
    markers: [],
    campaigns: [],
    analysisMarkdown: "",
    ...partial,
  };
}

function statusGroupFromExport(
  campaign: MetaExportCampaign,
): CampaignOption["statusGroup"] {
  const effective = (campaign.effective_status || campaign.status || "").toUpperCase();
  if (effective === "ACTIVE" || effective === "IN_PROCESS") return "Ativa";
  if (effective === "PAUSED" || effective === "CAMPAIGN_PAUSED" || effective === "ADSET_PAUSED") {
    return "Inativa";
  }
  if (effective === "DELETED" || effective === "ARCHIVED") return "Encerrada";
  return "Outro";
}

export function mapExecutionToDashboard(
  detail: MetaAiExecutionDetail | null,
  options?: { campaignId?: string | null; campaignIds?: string[] | null },
): IntelligenceDashboardView {
  if (!detail) return emptyView();

  const input = isMetaExport(detail.inputJson) ? detail.inputJson : null;
  const output = asRecord(detail.outputJson) ?? {};
  const campaigns = input?.campaigns ?? [];
  const campaignOptions: CampaignOption[] = campaigns.map((campaign) => ({
    id: campaign.id,
    name: campaign.name,
    objective: campaign.objective,
    resultMetric: campaign.result_metric,
    status: campaign.effective_status || campaign.status,
    statusGroup: statusGroupFromExport(campaign),
  }));

  const selectedIds = (options?.campaignIds?.length
    ? options.campaignIds
    : options?.campaignId
      ? [options.campaignId]
      : []
  ).filter(Boolean);

  const selectedCampaigns =
    selectedIds.length > 0
      ? campaigns.filter((campaign) => selectedIds.includes(campaign.id))
      : campaigns.length === 1
        ? campaigns
        : selectedIds.length === 0
          ? campaigns
          : [];

  const scopedCampaigns =
    selectedIds.length > 0
      ? selectedCampaigns
      : campaigns;

  const selectedCampaign =
    scopedCampaigns.length === 1 ? (scopedCampaigns[0] ?? null) : null;

  const dataStatus =
    input?.metadata?.data_status === "live" || input?.metadata?.data_status === "partial"
      ? input.metadata.data_status
      : null;

  const insightsBundle: MetaExportInsights | null =
    scopedCampaigns.length === 1 && scopedCampaigns[0]?.insights
      ? scopedCampaigns[0].insights
      : aggregateInsights(
          scopedCampaigns
            .map((campaign) => campaign.insights)
            .filter((row): row is MetaExportInsights => Boolean(row)),
        );

  const dailyRows = scopedCampaigns.flatMap((campaign) => campaign.daily_insights ?? []);

  const series = aggregateDaily(dailyRows);
  const periodStart = detail.periodSince ?? input?.period?.since ?? null;
  const periodEnd = detail.periodUntil ?? input?.period?.until ?? null;

  const metrics = PRIORITY_METRICS.map((key) =>
    metricFromInsights(key, insightsBundle, periodStart, periodEnd, dataStatus),
  );

  const comparisons = buildDayComparison(series, periodStart, periodEnd, dataStatus);
  const tasks = extractApprovedClaims(output)
    .map((raw, index) => claimToTask(raw, index, input))
    .filter((task): task is SuggestedTask => Boolean(task));

  const resultEventLabel =
    selectedCampaign?.result_metric?.trim() ||
    scopedCampaigns.find((campaign) => campaign.result_metric)?.result_metric?.trim() ||
    campaigns.find((campaign) => campaign.result_metric)?.result_metric?.trim() ||
    "Conversões";

  const campaignName =
    selectedIds.length === 0
      ? null
      : selectedIds.length === 1
        ? (selectedCampaign?.name ?? null)
        : `${selectedIds.length} campanhas`;

  return {
    executionId: detail.id,
    organizationId: detail.organizationId,
    clientName: detail.clientName || input?.metadata?.client_name || "",
    accountId: detail.accountId || input?.account?.id || "",
    accountName: detail.accountName || input?.account?.name || "",
    campaignId: selectedIds.length === 1 ? selectedIds[0]! : selectedIds.length ? selectedIds.join(",") : null,
    campaignName,
    resultEventLabel,
    periodStart,
    periodEnd,
    timezone: detail.periodTimezone || input?.period?.timezone || "America/Sao_Paulo",
    analyticalStatus:
      typeof output.analytical_status === "string"
        ? output.analytical_status
        : typeof asRecord(output.statuses)?.analytical_status === "string"
          ? String(asRecord(output.statuses)?.analytical_status)
          : detail.status,
    publicationStatus:
      typeof output.publication_status === "string"
        ? output.publication_status
        : typeof asRecord(output.statuses)?.publication_status === "string"
          ? String(asRecord(output.statuses)?.publication_status)
          : null,
    protocolVersion: detail.protocolVersion || (typeof output.protocol_version === "string" ? output.protocol_version : null),
    dataQualityStatus:
      typeof output.data_quality_status === "string" ? output.data_quality_status : dataStatus,
    currency: input?.metadata?.currency || "BRL",
    metrics,
    comparisons,
    series,
    insights: extractInsights(output, tasks),
    tasks,
    markers: [],
    campaigns: campaignOptions,
    analysisMarkdown: detail.analysisMarkdown || "",
  };
}

export function findComparison(
  view: IntelligenceDashboardView,
  key: MetricKey,
): MetricComparison | undefined {
  return view.comparisons.find((row) => row.metricKey === key);
}
