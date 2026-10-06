import { Link } from "@tanstack/react-router";
import { Eye, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PeriodPicker } from "@/components/nex/PeriodPicker";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { MetaCampaignRow, MetaPerformanceView, MetaPeriod } from "@/lib/meta-access";
import { getMetaPerformanceFn } from "@/lib/meta.functions";

function readOrg() {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("org") ?? "";
}

function integer(value: number) {
  return new Intl.NumberFormat("pt-BR").format(value);
}

function money(value: number, currency: string) {
  try {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(value);
  } catch {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  }
}

function percent(value: number | null) {
  if (value == null) return "—";
  return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(value)}%`;
}

const initialPeriod: MetaPeriod = { mode: "total" };
const noCampaigns: MetaCampaignRow[] = [];

export function MetaPerformance({ mode, organizationId: organizationFromRoute = "" }: { mode: "overview" | "campaigns"; organizationId?: string }) {
  const [period, setPeriod] = useState<MetaPeriod>(initialPeriod);
  const [view, setView] = useState<MetaPerformanceView | null>(null);
  const [maximumView, setMaximumView] = useState<MetaPerformanceView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [campaignId, setCampaignId] = useState("all");
  const [chartId, setChartId] = useState<string | null>(null);
  const [chartLoading, setChartLoading] = useState(false);
  const [chartError, setChartError] = useState("");
  const organizationId = organizationFromRoute || readOrg();

  const load = async (nextPeriod: MetaPeriod) => {
    setLoading(true);
    setError("");
    const data: { organizationId?: string; period?: string; since?: string; until?: string } = { period: nextPeriod.mode };
    if (nextPeriod.mode === "custom") {
      data.since = nextPeriod.since;
      data.until = nextPeriod.until;
    }
    if (organizationId) data.organizationId = organizationId;
    try {
      const result = await getMetaPerformanceFn({ data });
      setLoading(false);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setPeriod(result.data.period);
      setView(result.data);
      if (result.data.period.mode === "total") setMaximumView(result.data);
    } catch {
      setLoading(false);
      setError("Não foi possível carregar os indicadores da Meta.");
    }
  };

  useEffect(() => {
    void load(initialPeriod);
  }, []);

  const listedCampaigns = view?.campaigns ?? noCampaigns;
  const showCampaignFilter = listedCampaigns.length > 1;
  const selectedCampaign = showCampaignFilter && campaignId !== "all" ? listedCampaigns.find((row) => row.id === campaignId) ?? null : null;

  useEffect(() => {
    if (campaignId !== "all" && !listedCampaigns.some((row) => row.id === campaignId)) setCampaignId("all");
  }, [campaignId, listedCampaigns]);

  const campaigns = useMemo(() => {
    const rows = selectedCampaign ? listedCampaigns.filter((row) => row.id === selectedCampaign.id) : listedCampaigns;
    return rows.filter((row) => {
      const matchesQuery = row.name.toLowerCase().includes(query.trim().toLowerCase());
      const matchesStatus = status === "all" || row.statusGroup === status;
      return matchesQuery && matchesStatus;
    });
  }, [listedCampaigns, selectedCampaign, query, status]);

  const chartCampaign = chartId ? maximumView?.campaigns.find((row) => row.id === chartId) ?? null : null;
  const chartName = chartCampaign?.name ?? listedCampaigns.find((row) => row.id === chartId)?.name ?? "Campanha";

  const openCharts = (id: string) => {
    setChartId(id);
    setChartError("");
    if (maximumView) return;
    setChartLoading(true);
    const data: { organizationId?: string; period?: string } = { period: "total" };
    if (organizationId) data.organizationId = organizationId;
    void getMetaPerformanceFn({ data })
      .then((result) => {
        setChartLoading(false);
        if (!result.ok) {
          setChartError(result.message);
          return;
        }
        setMaximumView(result.data);
      })
      .catch(() => {
        setChartLoading(false);
        setChartError("Não foi possível carregar os gráficos do período máximo.");
      });
  };

  const ready = Boolean(view?.kpis && view.accountId);
  const kpis = selectedCampaign
    ? {
        reach: selectedCampaign.reach,
        impressions: selectedCampaign.impressions,
        results: selectedCampaign.results,
        resultLabel: selectedCampaign.resultLabel,
        spend: selectedCampaign.spend,
        cpc: selectedCampaign.cpc,
        ctr: selectedCampaign.ctr,
      }
    : view?.kpis;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 rounded-lg border bg-card p-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <p className="text-xs font-medium text-muted-foreground">Conta de anúncios</p>
          <p className="mt-1 text-sm font-semibold">
            {view?.accountName ? `${view.accountName}${view.accountId ? ` · ${view.accountId}` : ""}` : "Conta de anúncio não vinculada"}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
          {showCampaignFilter && (
            <Select value={selectedCampaign ? selectedCampaign.id : "all"} onValueChange={setCampaignId}>
              <SelectTrigger className="w-full bg-background sm:w-64" aria-label="Campanha">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as campanhas</SelectItem>
                {listedCampaigns.map((row) => (
                  <SelectItem key={row.id} value={row.id}>
                    {row.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <PeriodPicker value={period} disabled={loading} onApply={(next) => void load(next)} />
          <Button type="button" onClick={() => void load(period)} disabled={loading}>
            <RefreshCw className={loading ? "animate-spin" : ""} />
            {loading ? "Atualizando" : "Atualizar dados"}
          </Button>
        </div>
      </div>

      {loading && !view && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-24 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      )}

      {error && <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{error}</p>}

      {view && !view.canView && (
        <p className="rounded-lg border p-4 text-sm text-muted-foreground">Você não tem permissão para ver as campanhas desta conta.</p>
      )}

      {view && view.canView && !view.accountId && !loading && (
        <div className="rounded-lg border p-5">
          <p className="font-semibold">Conta de anúncio não vinculada</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Os indicadores desta tela são os da conta definida no cadastro do usuário.
          </p>
          {view.role === "master" && (
            <Button asChild className="mt-4">
              <Link to="/usuarios">Abrir usuários</Link>
            </Button>
          )}
        </div>
      )}

      {view?.lastError && ready === false && <p className="text-sm text-destructive">{view.lastError}</p>}

      {ready && view?.kpis && (
        <>
          {mode === "overview" && kpis && (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <Kpi label="Alcance" value={integer(kpis.reach)} />
              <Kpi label="Impressões" value={integer(kpis.impressions)} />
              <Kpi label="Resultados" value={integer(kpis.results)} hint={kpis.resultLabel} />
              <Kpi label="Gasto" value={money(kpis.spend, view.currency)} />
              <Kpi label="CPC" value={kpis.cpc == null ? "—" : money(kpis.cpc, view.currency)} />
              <Kpi label="CTR" value={percent(kpis.ctr)} />
            </div>
          )}
          {mode === "overview" && (
            view.campaigns.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma campanha encontrada nesta conta no período.</p>
            ) : (
              <>
                <EvolutionChart series={view.series} selectedId={selectedCampaign?.id ?? null} />
                <ResultsChart rows={selectedCampaign ? [selectedCampaign] : view.campaigns} currency={view.currency} />
              </>
            )
          )}
          {mode === "campaigns" && (
            <div className="flex flex-col gap-3 sm:flex-row">
              <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar campanha" />
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  <SelectItem value="Ativa">Ativas</SelectItem>
                  <SelectItem value="Inativa">Inativas</SelectItem>
                  <SelectItem value="Encerrada">Encerradas</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          {mode === "campaigns" && <CampaignTable rows={campaigns} currency={view.currency} onOpenCharts={openCharts} />}
          {mode === "campaigns" && (
            <CampaignChartsDialog
              open={chartId !== null}
              name={chartName}
              resultLabel={chartCampaign?.resultLabel ?? ""}
              campaign={chartCampaign}
              currency={maximumView?.currency ?? view.currency}
              series={maximumView?.series ?? null}
              loading={chartLoading}
              error={chartError}
              onOpenChange={(open) => {
                if (!open) setChartId(null);
              }}
            />
          )}
          {mode === "campaigns" && view.campaigns.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhuma campanha encontrada nesta conta no período.</p>
          )}
          {mode === "campaigns" && view.campaigns.length > 0 && campaigns.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhuma campanha encontrada com esse filtro.</p>
          )}
        </>
      )}
    </div>
  );
}

function costPerResult(row: MetaCampaignRow) {
  if (row.results <= 0) return 0;
  return row.spend / row.results;
}

function wrapText(value: string, chars: number) {
  const clean = value.replace(/\s+/g, " ").trim();
  if (clean.length <= chars) return [clean];
  const lines: string[] = [];
  let rest = clean;
  while (rest.length > chars) {
    let cut = rest.lastIndexOf(" ", chars);
    if (cut < Math.floor(chars * 0.55)) cut = chars;
    lines.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) lines.push(rest);
  return lines;
}

const lineColors = ["var(--primary)", "var(--info)", "var(--success)", "var(--warning)", "var(--cyan)", "var(--destructive)"];

function lineColor(index: number) {
  return lineColors[index] ?? `oklch(0.62 0.16 ${(index * 47) % 360})`;
}

function dayLabel(iso: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return iso;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

export function EvolutionChart({ series, selectedId }: { series: MetaPerformanceView["series"]; selectedId: string | null }) {
  const lines = (selectedId ? series.campaigns.filter((item) => item.id === selectedId) : series.campaigns).map((item, index) => ({
    ...item,
    color: lineColor(series.campaigns.findIndex((campaign) => campaign.id === item.id) >= 0 ? series.campaigns.findIndex((campaign) => campaign.id === item.id) : index),
  }));
  if (lines.length === 0 || series.points.length === 0) return null;
  const labels = new Set(lines.map((item) => item.resultLabel));
  const subtitle = labels.size === 1 ? `${[...labels][0]} ao longo dos dias` : "Resultados ao longo dos dias";
  const data = series.points.map((point) => {
    const row: Record<string, string | number> = { date: point.date, label: dayLabel(point.date) };
    for (const line of lines) row[line.id] = point.values[line.id] ?? 0;
    return row;
  });
  return (
    <section className="rounded-lg border bg-card p-5">
      <h2 className="font-display text-lg font-semibold">Evolução dos resultados</h2>
      <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
      <div className="mt-4 h-80 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} minTickGap={24} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} width={36} />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                return (
                  <div className="min-w-48 rounded-md border bg-popover px-3 py-2.5 text-popover-foreground shadow-sm">
                    <p className="mb-2 border-b pb-2 text-xs font-semibold">{label}</p>
                    <div className="space-y-1.5 text-xs">
                      {payload.map((item) => (
                        <div key={String(item.dataKey)} className="flex justify-between gap-5">
                          <span className="text-muted-foreground">{lines.find((line) => line.id === item.dataKey)?.name ?? item.name}</span>
                          <strong>{integer(Number(item.value ?? 0))}</strong>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              }}
            />
            <Legend
              content={() => (
                <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                  {lines.map((line) => (
                    <li key={line.id} className="flex max-w-full items-center gap-1.5" title={line.name}>
                      <span className="size-2 shrink-0 rounded-full" style={{ background: line.color }} />
                      <span className="truncate">{line.name}</span>
                    </li>
                  ))}
                </ul>
              )}
            />
            {lines.map((line) => (
              <Line key={line.id} type="monotone" dataKey={line.id} name={line.name} stroke={line.color} strokeWidth={2} dot={data.length <= 31} activeDot={{ r: 4 }} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

export function ResultsChart({ rows, currency, title = "Resultados entre campanhas", description = "Volume de resultados e custo por resultado." }: { rows: MetaCampaignRow[]; currency: string; title?: string; description?: string }) {
  const frame = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  useEffect(() => {
    const element = frame.current;
    if (!element) return;
    const update = () => setWidth(element.clientWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const slot = Math.max(140, width / Math.max(rows.length, 1));
  const chars = Math.max(12, Math.floor((slot - 20) / 6.4));
  const maxLines = Math.min(3, Math.max(1, ...rows.map((row) => wrapText(row.name, chars).length)));
  const data = rows.map((row) => ({
    name: row.name,
    resultados: row.results,
    custo: costPerResult(row),
  }));
  return (
    <section className="rounded-lg border bg-card p-5">
      <h2 className="font-display text-lg font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      <div ref={frame} className="mt-4 h-96 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: maxLines * 16 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis
              dataKey="name"
              interval={0}
              tickLine={false}
              axisLine={false}
              tick={(props: { x?: number; y?: number; payload?: { value?: string } }) => (
                <CampaignTick {...props} chars={chars} slot={slot} />
              )}
            />
            <YAxis yAxisId="left" domain={[0, "auto"]} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} width={36} />
            <YAxis yAxisId="right" orientation="right" domain={[0, "auto"]} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} width={48} />
            <Tooltip
              cursor={{ fill: "var(--muted)", fillOpacity: 0.55 }}
              content={({ active, payload }) => {
                const point = payload?.[0]?.payload as { name?: string; resultados?: number; custo?: number } | undefined;
                if (!active || !point) return null;
                return (
                  <div className="min-w-48 max-w-sm rounded-md border bg-popover px-3 py-2.5 text-popover-foreground shadow-sm">
                    <p className="mb-2 border-b pb-2 text-xs font-semibold">{point.name}</p>
                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between gap-5">
                        <span className="text-muted-foreground">Resultados</span>
                        <strong>{integer(point.resultados ?? 0)}</strong>
                      </div>
                      <div className="flex justify-between gap-5">
                        <span className="text-muted-foreground">Custo por resultado</span>
                        <strong>{money(point.custo ?? 0, currency)}</strong>
                      </div>
                    </div>
                  </div>
                );
              }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar yAxisId="left" dataKey="resultados" name="Resultados" fill="var(--primary)" radius={[5, 5, 0, 0]} />
            <Bar yAxisId="right" dataKey="custo" name="Custo por resultado" fill="var(--info)" radius={[5, 5, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

function CampaignTick({ x = 0, y = 0, payload, chars, slot }: { x?: number; y?: number; payload?: { value?: string }; chars: number; slot: number }) {
  const name = payload?.value ?? "";
  const wrapped = wrapText(name, chars);
  const visible = wrapped.slice(0, 3);
  if (wrapped.length > visible.length && visible.length > 0) {
    const last = visible[visible.length - 1] ?? "";
    visible[visible.length - 1] = `${last.slice(0, Math.max(1, chars - 1))}…`;
  }
  return (
    <g transform={`translate(${x},${y})`}>
      <title>{name}</title>
      <rect x={-slot / 2} y={4} width={slot} height={visible.length * 14 + 6} fill="transparent" />
      {visible.map((line, index) => (
        <text key={index} dy={16 + index * 14} textAnchor="middle" fill="var(--muted-foreground)" fontSize={11}>
          {line}
        </text>
      ))}
    </g>
  );
}

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border bg-card p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <strong className="mt-2 block font-display text-2xl">{value}</strong>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function CampaignTable({ rows, currency, onOpenCharts }: { rows: MetaCampaignRow[]; currency: string; onOpenCharts: (id: string) => void }) {
  if (rows.length === 0) return null;
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full min-w-[920px] text-left text-sm">
        <thead className="border-b bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-medium">Nome</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Alcance</th>
            <th className="px-4 py-3 font-medium">Impressões</th>
            <th className="px-4 py-3 font-medium">Resultados</th>
            <th className="px-4 py-3 font-medium">Custo/Resultado</th>
            <th className="px-4 py-3 font-medium">Gasto</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b last:border-0">
              <td className="px-4 py-3">
                <div className="flex items-start gap-2">
                  <Button type="button" variant="ghost" size="icon" className="size-8 shrink-0 text-primary" aria-label={`Ver gráficos de ${row.name}`} onClick={() => onOpenCharts(row.id)}>
                    <Eye className="size-4" />
                  </Button>
                  <div className="min-w-0">
                    <p className="font-medium">{row.name}</p>
                    <p className="text-xs text-muted-foreground">{row.resultLabel}</p>
                  </div>
                </div>
              </td>
              <td className="px-4 py-3">{row.status}</td>
              <td className="px-4 py-3">{integer(row.reach)}</td>
              <td className="px-4 py-3">{integer(row.impressions)}</td>
              <td className="px-4 py-3">{integer(row.results)}</td>
              <td className="px-4 py-3">{row.results > 0 ? money(costPerResult(row), currency) : "—"}</td>
              <td className="px-4 py-3">{money(row.spend, currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CampaignChartsDialog({
  open,
  name,
  resultLabel,
  campaign,
  currency,
  series,
  loading,
  error,
  onOpenChange,
}: {
  open: boolean;
  name: string;
  resultLabel: string;
  campaign: MetaCampaignRow | null;
  currency: string;
  series: MetaPerformanceView["series"] | null;
  loading: boolean;
  error: string;
  onOpenChange: (open: boolean) => void;
}) {
  const hasLine = Boolean(campaign && series && series.points.length > 0 && series.campaigns.some((item) => item.id === campaign.id));
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-[calc(100%-2rem)] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="pr-8 font-display">{name}</DialogTitle>
          <DialogDescription>Período máximo{resultLabel ? ` · ${resultLabel}` : ""}</DialogDescription>
        </DialogHeader>
        {loading && <div className="h-80 animate-pulse rounded-lg bg-muted" />}
        {error && <p className="text-sm text-destructive">{error}</p>}
        {!loading && !error && campaign && series && (
          <div className="space-y-5">
            {hasLine ? (
              <EvolutionChart series={series} selectedId={campaign.id} />
            ) : (
              <p className="text-sm text-muted-foreground">Não há evolução diária desta campanha no período máximo.</p>
            )}
            <ResultsChart rows={[campaign]} currency={currency} title="Resultados da campanha" description="Volume de resultados e custo por resultado no período máximo." />
          </div>
        )}
        {!loading && !error && !campaign && <p className="text-sm text-muted-foreground">Não há indicadores desta campanha no período máximo.</p>}
      </DialogContent>
    </Dialog>
  );
}
