import {
  CartesianGrid,
  LabelList,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ClipboardList, Gauge } from "lucide-react";
import {
  formatComparisonBadge,
  formatMetricValue,
  formatShortDate,
} from "@/lib/nex-intelligence/dashboard/format";
import type {
  DailySeriesPoint,
  DashboardMetric,
  IntelligenceDashboardView,
  MetricComparison,
  MetricKey,
  OptimizationMarker,
} from "@/lib/nex-intelligence/dashboard/types";
import { ni } from "@/components/nex/intelligence/intelligence-theme";
import { OptimizationChartMarkerLabel } from "@/components/nex/intelligence/OptimizationChartMarker";

const PERIOD_KEYS: MetricKey[] = ["results", "ctr", "cpc", "cost_per_result"];

function objectiveLabel(raw: string | null | undefined): string {
  if (!raw) return "—";
  const value = raw.toUpperCase();
  if (value.includes("ENGAGEMENT") || value.includes("MESSAGES") || value.includes("WHATSAPP")) {
    return "Engajamento (WhatsApp)";
  }
  if (value.includes("LEAD")) return "Leads";
  if (value.includes("TRAFFIC") || value.includes("LINK_CLICKS")) return "Tráfego";
  if (value.includes("SALES") || value.includes("CONVERSIONS") || value.includes("PURCHASE")) {
    return "Conversões";
  }
  if (value.includes("AWARENESS") || value.includes("REACH")) return "Reconhecimento";
  return raw.replace(/^OUTCOME_/, "").replaceAll("_", " ");
}

/** Encaixa o marco no ponto da série (data exata ou mais próxima). */
function resolveMarkerChartLabel(
  series: DailySeriesPoint[],
  marker: OptimizationMarker,
): string | null {
  if (series.length === 0) return null;
  const day = marker.effectiveAt.slice(0, 10);
  const exact = series.find((point) => point.date === day);
  if (exact) return formatShortDate(exact.date);

  let best = series[0]!;
  let bestDelta = Math.abs(Date.parse(best.date) - Date.parse(day));
  for (const point of series.slice(1)) {
    const delta = Math.abs(Date.parse(point.date) - Date.parse(day));
    if (delta < bestDelta) {
      best = point;
      bestDelta = delta;
    }
  }
  return formatShortDate(best.date);
}

type Props = {
  dashboard: IntelligenceDashboardView;
  comparisons: MetricComparison[];
};

export function ManualAnalysisOverview({ dashboard, comparisons }: Props) {
  const metrics = PERIOD_KEYS.map(
    (key) =>
      dashboard.metrics.find((metric) => metric.key === key) ??
      ({
        key,
        label: key,
        value: null,
        unit: "other",
        quality: "UNAVAILABLE",
        desirableDirection: "neutral",
        periodStart: null,
        periodEnd: null,
        sourceTraceIds: [],
      } satisfies DashboardMetric),
  );

  const chartData = dashboard.series.map((point) => ({
    date: point.date,
    label: formatShortDate(point.date),
    value: point.results,
  }));

  const chartMarkers = dashboard.markers
    .map((marker) => {
      const label = resolveMarkerChartLabel(dashboard.series, marker);
      return label ? { marker, label } : null;
    })
    .filter((row): row is { marker: OptimizationMarker; label: string } => Boolean(row));

  const primaryMarkerLabel = chartMarkers[0]?.label ?? null;

  const objective =
    dashboard.campaigns.find((row) => row.id === dashboard.campaignId)?.objective ??
    dashboard.campaigns[0]?.objective ??
    null;

  const completed =
    dashboard.publicationStatus === "published" ||
    dashboard.analyticalStatus === "COMPLETED" ||
    dashboard.analyticalStatus === "PARTIAL_VALIDATED" ||
    Boolean(dashboard.executionId && dashboard.analysisMarkdown);

  return (
    <div className="grid w-full gap-3 xl:grid-cols-[1.05fr_1.55fr_0.95fr] xl:items-stretch">
      <section className={`${ni.card} px-4 py-3`}>
        <div className="mb-2 flex items-center gap-2">
          <Gauge className="size-[18px] shrink-0 stroke-[1.75] text-[#3ecbff]" />
          <h3 className="text-[15px] font-semibold text-white">Desempenho do período</h3>
        </div>
        <ul>
          {metrics.map((metric, index) => {
            const comparison = comparisons.find((row) => row.metricKey === metric.key);
            const badge = formatComparisonBadge(comparison);
            // Comparativo vs. período anterior: cresceu = verde, diminuiu = vermelho.
            // Julgamento bom/ruim do indicador (up-good/down-good) segue o Dashboard de Anúncios.
            const delta = comparison?.absoluteDelta ?? comparison?.relativeDeltaPercent ?? null;
            const rising = delta != null && delta > 0;
            const falling = delta != null && delta < 0;
            const arrow = falling ? "↓ " : rising ? "↑ " : "";
            const directionTone = rising ? "up" : falling ? "down" : "flat";
            const last = index === metrics.length - 1;
            const toneClass =
              directionTone === "up"
                ? "bg-emerald-500/20 text-emerald-300"
                : directionTone === "down"
                  ? "bg-rose-500/20 text-rose-300"
                  : "bg-white/10 text-white/70";
            const senseHint =
              badge?.tone === "positive"
                ? "Melhora no critério do indicador"
                : badge?.tone === "negative"
                  ? "Piora no critério do indicador"
                  : "Variação vs. período anterior";
            return (
              <li
                key={metric.key}
                className={`grid grid-cols-[minmax(0,1.2fr)_auto_auto] items-center gap-3 py-2 ${
                  last ? "" : "border-b border-white/10"
                }`}
              >
                <p className="truncate text-[14px] font-normal leading-none text-white">
                  {metric.label}
                </p>
                <p className="justify-self-end text-right text-[17px] font-bold leading-none tracking-tight text-white">
                  {formatMetricValue(metric, dashboard.currency)}
                </p>
                {badge ? (
                  <span
                    className={`inline-flex min-w-[5.25rem] items-center justify-center rounded-full px-2 py-0.5 text-[11px] font-semibold leading-none ${toneClass}`}
                    title={senseHint}
                  >
                    {arrow}
                    {badge.text}
                  </span>
                ) : (
                  <span
                    className="inline-flex min-w-[5.25rem] items-center justify-center rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-semibold text-white/55"
                    title="Sem base comparável no período anterior"
                  >
                    Sem base
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section className={`${ni.card} px-4 py-3`}>
        <h3 className="text-[15px] font-semibold text-white">
          Evolução dos resultados ({dashboard.resultEventLabel || "Conversões"})
        </h3>
        {chartData.length === 0 ? (
          <p className={`mt-4 ${ni.muted}`}>Sem série diária verificável para o período.</p>
        ) : (
          <div className="relative mt-2 h-[168px] w-full overflow-visible">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 18, right: 14, left: 4, bottom: 4 }}>
                <CartesianGrid stroke="#1a2d4a" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: "#8fa3bf", fontSize: 10 }}
                  axisLine={{ stroke: "#1e3a5f" }}
                  tickLine={false}
                  height={22}
                />
                <YAxis hide domain={["auto", "auto"]} />
                <Tooltip
                  contentStyle={{
                    background: "#0b1729",
                    border: "1px solid #1e3a5f",
                    borderRadius: 8,
                    color: "#f4f7fb",
                  }}
                  formatter={(value: number | string) => [
                    typeof value === "number" ? value.toLocaleString("pt-BR") : String(value),
                    "Resultados",
                  ]}
                />
                {chartMarkers.map(({ marker, label }) => (
                  <ReferenceLine
                    key={marker.id}
                    x={label}
                    stroke="#c9d7ef"
                    strokeDasharray="5 5"
                    strokeWidth={1.5}
                    label={<OptimizationChartMarkerLabel marker={marker} />}
                  />
                ))}
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ r: 4, fill: "#ffffff", stroke: "#3b82f6", strokeWidth: 2 }}
                  activeDot={{ r: 5 }}
                  connectNulls={false}
                >
                  <LabelList
                    dataKey="value"
                    position="top"
                    offset={6}
                    style={{ fill: "#dbe7f8", fontSize: 10, fontWeight: 600 }}
                    formatter={(value: number | string) =>
                      typeof value === "number" ? value.toLocaleString("pt-BR") : value
                    }
                  />
                </Line>
              </LineChart>
            </ResponsiveContainer>
            {primaryMarkerLabel ? (
              <div className="pointer-events-none absolute inset-x-0 top-3 z-10 flex items-start justify-around px-8 text-[11px]">
                <span className="rounded-full bg-[#5b4dff]/40 px-2.5 py-0.5 font-medium text-[#c4b5ff] shadow-[0_0_0_1px_rgba(91,77,255,0.28)] backdrop-blur-[2px]">
                  Antes da otimização
                </span>
                <span className="rounded-full bg-[#1d6feb]/40 px-2.5 py-0.5 font-medium text-[#9ec5ff] shadow-[0_0_0_1px_rgba(29,111,235,0.28)] backdrop-blur-[2px]">
                  Depois da otimização
                </span>
              </div>
            ) : null}
          </div>
        )}
      </section>

      <section className={`${ni.card} px-4 py-3`}>
        <div className="mb-2 flex items-center gap-2">
          <ClipboardList className="size-[18px] shrink-0 stroke-[1.75] text-[#3ecbff]" />
          <h3 className="text-[15px] font-semibold text-white">Resumo da análise</h3>
        </div>
        <dl className="space-y-3 text-sm">
          <div>
            <dt className="text-[12px] text-[#9db0c9]">Período analisado</dt>
            <dd className="mt-0.5 text-[14px] font-medium text-white">
              {formatShortDate(dashboard.periodStart)} – {formatShortDate(dashboard.periodEnd)}
            </dd>
          </div>
          <div>
            <dt className="text-[12px] text-[#9db0c9]">Objetivo da campanha</dt>
            <dd className="mt-0.5 text-[14px] font-medium text-white">{objectiveLabel(objective)}</dd>
          </div>
          <div>
            <dt className="text-[12px] text-[#9db0c9]">Status</dt>
            <dd className="mt-1">
              <span
                className={
                  completed
                    ? "inline-flex rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[12px] font-medium text-emerald-400"
                    : ni.badgeNeu
                }
              >
                {completed ? "Análise concluída" : "Aguardando análise"}
              </span>
            </dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
