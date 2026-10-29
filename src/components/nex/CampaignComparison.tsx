import { ArrowDown, ArrowUp, BarChart3, Check, Info, X } from "lucide-react";
import {
  campaignCompareMetrics,
  formatInteger,
  formatMoney,
  formatPercent,
  type CampaignComparePanel,
  type CampaignCompareSummary,
  type CompareMetricKey,
} from "@/lib/meta-analysis";
import type { MetaCampaignRow } from "@/lib/meta-access";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

function formatMetric(key: CompareMetricKey, value: number | null, currency: string) {
  if (key === "ctr") return formatPercent(value);
  if (key === "reach" || key === "impressions") return formatCompactCount(value);
  return formatMoney(value, currency);
}

function formatCompactCount(value: number | null | undefined) {
  const number = typeof value === "number" && Number.isFinite(value) ? value : null;
  if (number == null) return "—";
  if (Math.abs(number) >= 1000) {
    return new Intl.NumberFormat("en", {
      notation: "compact",
      maximumFractionDigits: 1,
    })
      .format(number)
      .toLowerCase();
  }
  return formatInteger(number);
}

function barWidthPercent(value: number | null, peak: number) {
  if (value == null || peak <= 0) return 0;
  return Math.max(6, Math.round((value / peak) * 100));
}

function CompareSummary({ summary }: { summary: CampaignCompareSummary }) {
  return (
    <section className="rounded-lg border bg-card p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-md bg-info/15 text-info">
              <BarChart3 className="size-4" aria-hidden />
            </span>
            <div className="min-w-0">
              <h2 className="font-display text-lg font-semibold">Resumo</h2>
              <p className="text-sm text-muted-foreground">Melhor campanha no período</p>
            </div>
          </div>
          <p className="mt-4 font-display text-xl font-semibold leading-snug sm:text-2xl">
            {summary.winnerName}
          </p>
          <span className="mt-3 inline-flex rounded-full border border-success/40 bg-success/10 px-2.5 py-1 text-[11px] font-medium text-success">
            {summary.tied
              ? `Empatada em ${summary.wins} de ${summary.total} indicadores`
              : `Venceu em ${summary.wins} de ${summary.total} indicadores`}
          </span>
          <p className="mt-3 max-w-xl text-sm text-muted-foreground">
            Esta campanha apresentou o melhor desempenho na maioria dos indicadores analisados no
            período selecionado.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-4 text-xs text-muted-foreground lg:justify-end">
          <span className="inline-flex items-center gap-2">
            <span className="size-2 rounded-full bg-success" aria-hidden />
            Melhor desempenho
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="size-2 rounded-full bg-destructive" aria-hidden />
            Melhor desempenho da concorrente
          </span>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {summary.indicators.map((item) => (
          <article
            key={item.key}
            className={`rounded-lg border p-3 ${
              item.leaderWon
                ? "border-success/30 bg-success/5"
                : "border-destructive/30 bg-destructive/5"
            }`}
          >
            <p className="text-xs font-semibold text-foreground">{item.shortTitle}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {item.lowerIsBetter ? "Menor valor é melhor" : "Maior valor é melhor"}
            </p>
            <div className="mt-3 flex items-center gap-2">
              <span
                className={`grid size-6 place-items-center rounded-full ${
                  item.leaderWon ? "bg-success text-white" : "bg-destructive text-white"
                }`}
              >
                {item.leaderWon ? (
                  <Check className="size-3.5" aria-hidden />
                ) : (
                  <X className="size-3.5" aria-hidden />
                )}
              </span>
              <span
                className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                  item.leaderWon
                    ? "bg-success/20 text-success"
                    : "bg-destructive/20 text-destructive"
                }`}
              >
                {item.leaderLabel}
              </span>
            </div>
            <p className="mt-3 truncate text-[11px] text-muted-foreground" title={item.winnerName}>
              {item.winnerShortName}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

function ComparePanel({
  panel,
  currency,
  warnObjectives,
}: {
  panel: CampaignComparePanel;
  currency: string;
  warnObjectives: boolean;
}) {
  const peak = panel.rows.reduce((max, row) => {
    if (row.value == null) return max;
    return row.value > max ? row.value : max;
  }, 0);

  return (
    <section className="rounded-lg border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <h2 className="font-display text-base font-semibold sm:text-lg">{panel.title}</h2>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="inline-flex size-5 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
                  aria-label={`Sobre ${panel.title}`}
                >
                  <Info className="size-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-64">
                {panel.hint}
              </TooltipContent>
            </Tooltip>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {panel.lowerIsBetter
              ? "Menor valor no topo = melhor desempenho"
              : "Maior valor no topo = melhor desempenho"}
          </p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-success/40 bg-success/10 px-2.5 py-1 text-[11px] font-medium text-success">
          {panel.lowerIsBetter ? (
            <ArrowDown className="size-3" aria-hidden />
          ) : (
            <ArrowUp className="size-3" aria-hidden />
          )}
          {panel.lowerIsBetter ? "Menor é melhor" : "Maior é melhor"}
        </span>
      </div>

      {warnObjectives && panel.key === "costPerResult" && (
        <p className="mt-2 text-xs text-warning">
          Objetivos diferentes — compare com cuidado.
        </p>
      )}

      <ul className="mt-5 space-y-4">
        {panel.rows.map((row) => {
          const width = barWidthPercent(row.value, peak);
          return (
            <li key={row.id} className="space-y-1.5">
              <div className="flex items-center justify-between gap-3">
                <p className="min-w-0 truncate text-sm text-foreground">{row.name}</p>
                <p className="shrink-0 text-sm font-semibold tabular-nums">
                  {formatMetric(panel.key, row.value, currency)}
                </p>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-info"
                  style={{ width: `${width}%` }}
                  title={formatMetric(panel.key, row.value, currency)}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function CampaignComparison({
  campaigns,
  currency,
}: {
  campaigns: MetaCampaignRow[];
  currency: string;
}) {
  const model = campaignCompareMetrics(campaigns);
  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Compare os indicadores das campanhas ativas no período selecionado e identifique quais
          apresentam os melhores resultados.
        </p>
        {model.summary ? <CompareSummary summary={model.summary} /> : null}
        <div className="grid gap-4 sm:grid-cols-2">
          {model.panels.map((panel) => (
            <ComparePanel
              key={panel.key}
              panel={panel}
              currency={currency}
              warnObjectives={!model.comparable}
            />
          ))}
        </div>
      </div>
    </TooltipProvider>
  );
}
