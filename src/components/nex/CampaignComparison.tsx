import { ArrowDown, ArrowUp, Info } from "lucide-react";
import {
  campaignCompareMetrics,
  formatInteger,
  formatMoney,
  formatPercent,
  type CampaignComparePanel,
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
