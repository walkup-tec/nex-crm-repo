import { Eye } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { EvolutionChart, ResultsChart } from "@/components/nex/MetaPerformance";
import { PeriodPicker } from "@/components/nex/PeriodPicker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { MasterCampaignRow, MasterCampaignsView, MetaPerformanceView, MetaPeriod } from "@/lib/meta-access";
import { getMetaPerformanceFn, listMasterCampaignsFn } from "@/lib/meta.functions";

const initialPeriod: MetaPeriod = { mode: "total" };

function periodsMatch(left: MetaPeriod, right: MetaPeriod) {
  if (left.mode === "total" || right.mode === "total") return left.mode === right.mode;
  return left.since === right.since && left.until === right.until;
}

function chartCacheKey(organizationId: string, period: MetaPeriod) {
  return period.mode === "custom" ? `${organizationId}|${period.since}|${period.until}` : `${organizationId}|total`;
}

function chartRequestData(organizationId: string, period: MetaPeriod) {
  const data: { organizationId: string; period: string; since?: string; until?: string } = {
    organizationId,
    period: period.mode,
  };
  if (period.mode === "custom") {
    data.since = period.since;
    data.until = period.until;
  }
  return data;
}

function periodCaption(period: MetaPeriod) {
  if (period.mode === "total") return "Total";
  const label = (iso: string) => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    if (!match) return iso;
    return `${match[3]}/${match[2]}/${match[1]}`;
  };
  return `${label(period.since)} – ${label(period.until)}`;
}

function nextIso(iso: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return iso;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function datesBetween(since: string, until: string) {
  const days: string[] = [];
  let cursor = since;
  while (cursor <= until && days.length < 400) {
    days.push(cursor);
    cursor = nextIso(cursor);
  }
  return days;
}

function seriesForSelection(row: MasterCampaignRow, view: MetaPerformanceView, period: MetaPeriod): MetaPerformanceView["series"] {
  const values = new Map(view.series.points.map((point) => [point.date, point.values[row.id] ?? 0]));
  const dates = period.mode === "custom" ? datesBetween(period.since, period.until) : view.series.points.map((point) => point.date);
  return {
    campaigns: [{ id: row.id, name: row.name, resultLabel: row.resultLabel }],
    points: dates.map((date) => ({ date, values: { [row.id]: values.get(date) ?? 0 } })),
  };
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

function costPerResult(row: MasterCampaignRow) {
  if (row.results <= 0) return null;
  return row.spend / row.results;
}

export function MasterCampaigns() {
  const [period, setPeriod] = useState<MetaPeriod>(initialPeriod);
  const [view, setView] = useState<MasterCampaignsView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [clientId, setClientId] = useState("all");
  const [selected, setSelected] = useState<MasterCampaignRow | null>(null);
  const [chartView, setChartView] = useState<MetaPerformanceView | null>(null);
  const [chartLoading, setChartLoading] = useState(false);
  const [chartError, setChartError] = useState("");
  const chartCache = useRef(new Map<string, MetaPerformanceView>());
  const chartRequest = useRef(0);

  const load = async (nextPeriod: MetaPeriod) => {
    setLoading(true);
    setError("");
    const data: { period?: string; since?: string; until?: string } = { period: nextPeriod.mode };
    if (nextPeriod.mode === "custom") {
      data.since = nextPeriod.since;
      data.until = nextPeriod.until;
    }
    const result = await listMasterCampaignsFn({ data });
    setLoading(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setPeriod(result.data.period);
    setView(result.data);
    setSelected((current) => {
      if (!current) return null;
      return (
        result.data.campaigns.find((row) => row.organizationId === current.organizationId && row.id === current.id) ?? current
      );
    });
  };

  useEffect(() => {
    void load(initialPeriod);
  }, []);

  const openCampaign = (row: MasterCampaignRow) => {
    const cached = chartCache.current.get(chartCacheKey(row.organizationId, period));
    setChartError("");
    setChartView(cached ?? null);
    setChartLoading(!cached);
    setSelected(row);
  };

  useEffect(() => {
    if (!selected) return;
    const key = chartCacheKey(selected.organizationId, period);
    const cached = chartCache.current.get(key);
    if (cached) {
      setChartView(cached);
      setChartLoading(false);
      setChartError("");
      return;
    }
    const ticket = chartRequest.current + 1;
    chartRequest.current = ticket;
    setChartView(null);
    setChartLoading(true);
    setChartError("");
    void getMetaPerformanceFn({ data: chartRequestData(selected.organizationId, period) })
      .then((result) => {
        if (ticket !== chartRequest.current) return;
        setChartLoading(false);
        if (!result.ok) {
          setChartError(result.message);
          return;
        }
        chartCache.current.set(key, result.data);
        setChartView(result.data);
      })
      .catch(() => {
        if (ticket !== chartRequest.current) return;
        setChartLoading(false);
        setChartError("Não foi possível carregar os gráficos desta campanha.");
      });
  }, [selected, period]);

  const rows = view?.campaigns ?? [];
  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesClient = clientId === "all" || row.organizationId === clientId;
      const matchesQuery = !needle || row.name.toLowerCase().includes(needle) || row.clientName.toLowerCase().includes(needle);
      const matchesStatus = status === "all" || row.statusGroup === status;
      return matchesClient && matchesQuery && matchesStatus;
    });
  }, [rows, query, status, clientId]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="relative min-w-0 flex-1">
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar campanha ou cliente" />
        </div>
        <Select value={clientId} onValueChange={setClientId}>
          <SelectTrigger className="w-full sm:w-64" aria-label="Cliente">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os clientes</SelectItem>
            {(view?.clients ?? []).map((client) => (
              <SelectItem key={client.id} value={client.id}>
                {client.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-full sm:w-48" aria-label="Status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="Ativa">Ativas</SelectItem>
            <SelectItem value="Inativa">Inativas</SelectItem>
            <SelectItem value="Encerrada">Encerradas</SelectItem>
          </SelectContent>
        </Select>
        <PeriodPicker value={period} disabled={loading} onApply={(next) => void load(next)} />
      </div>

      {loading && <p className="text-sm text-muted-foreground">Lendo as campanhas na Meta...</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}
      {view?.notices.map((notice) => (
        <p key={notice} className="text-sm text-muted-foreground">
          {notice}
        </p>
      ))}

      {view && rows.length === 0 && !loading && <p className="text-sm text-muted-foreground">Nenhuma campanha encontrada nas contas vinculadas.</p>}
      {view && rows.length > 0 && shown.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma campanha encontrada com esse filtro.</p>}

      {shown.length > 0 && (
        <>
          <div className="hidden overflow-x-auto rounded-lg border md:block">
            <table className="w-full min-w-[980px] text-sm">
              <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
                <tr>
                  {["Cliente", "Campanha", "Status", "Alcance", "Impressões", "Resultados", "Custo / resultado", "Gasto", ""].map((heading) => (
                    <th key={heading || "acao"} className="px-4 py-3 font-medium">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {shown.map((row) => (
                  <tr key={`${row.organizationId}-${row.id}`} className="hover:bg-muted/30">
                    <td className="px-4 py-4">{row.clientName}</td>
                    <td className="px-4 py-4 font-medium">{row.name}</td>
                    <td className="px-4 py-4">
                      <StatusBadge status={row.status} group={row.statusGroup} />
                    </td>
                    <td className="px-4 py-4">{integer(row.reach)}</td>
                    <td className="px-4 py-4">{integer(row.impressions)}</td>
                    <td className="px-4 py-4">
                      <strong>{integer(row.results)}</strong> <span className="text-xs text-muted-foreground">{row.resultLabel}</span>
                    </td>
                    <td className="px-4 py-4">{costPerResult(row) == null ? "—" : money(costPerResult(row) ?? 0, row.currency)}</td>
                    <td className="px-4 py-4">{money(row.spend, row.currency)}</td>
                    <td className="px-4 py-4">
                      <Button variant="ghost" size="icon" aria-label={`Ver ${row.name}`} onClick={() => openCampaign(row)}>
                        <Eye />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="space-y-3 md:hidden">
            {shown.map((row) => (
              <div key={`${row.organizationId}-${row.id}`} className="rounded-lg border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground">{row.clientName}</p>
                    <p className="font-semibold">{row.name}</p>
                    <div className="mt-2">
                      <StatusBadge status={row.status} group={row.statusGroup} />
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" aria-label={`Ver ${row.name}`} onClick={() => openCampaign(row)}>
                    <Eye />
                  </Button>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Resultados</p>
                    <strong>
                      {integer(row.results)} {row.resultLabel}
                    </strong>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Gasto</p>
                    <strong>{money(row.spend, row.currency)}</strong>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <Dialog open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-h-[90vh] w-[calc(100%-2rem)] max-w-5xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="pr-8">{selected?.name}</DialogTitle>
            <DialogDescription>
              {selected ? `${selected.clientName} • ${selected.accountName} • ` : ""}
              {periodCaption(period)} • somente leitura
            </DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="grid grid-cols-2 gap-3">
              {[
                ["Status", selected.status],
                ["Alcance", integer(selected.reach)],
                ["Impressões", integer(selected.impressions)],
                ["Resultados", `${integer(selected.results)} ${selected.resultLabel}`],
                ["Custo por resultado", costPerResult(selected) == null ? "—" : money(costPerResult(selected) ?? 0, selected.currency)],
                ["Gasto", money(selected.spend, selected.currency)],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg border p-4">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="mt-1 font-bold">{value}</p>
                </div>
              ))}
            </div>
          )}
          {chartError && <p className="text-sm text-destructive">{chartError}</p>}
          {selected && !chartError && !chartsMatch(chartView, selected, period) && <div className="h-80 animate-pulse rounded-lg bg-muted" />}
          {selected && chartsMatch(chartView, selected, period) && !chartError && <CampaignCharts row={selected} view={chartView} period={period} />}
          <p className="text-sm text-muted-foreground">A campanha não pode ser alterada pelo NEX Ads.</p>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function chartsMatch(view: MetaPerformanceView | null, row: MasterCampaignRow, period: MetaPeriod): view is MetaPerformanceView {
  return Boolean(view && view.organizationId === row.organizationId && periodsMatch(view.period, period));
}

function CampaignCharts({ row, view, period }: { row: MasterCampaignRow; view: MetaPerformanceView; period: MetaPeriod }) {
  const periodLabel = periodCaption(period);
  const series = seriesForSelection(row, view, period);
  return (
    <div className="space-y-5">
      {series.points.length > 0 ? (
        <EvolutionChart series={series} selectedId={row.id} />
      ) : (
        <p className="text-sm text-muted-foreground">Não há evolução diária desta campanha no período {periodLabel}.</p>
      )}
      <ResultsChart rows={[row]} currency={view.currency || row.currency} title="Resultados da campanha" description={`Volume de resultados e custo por resultado no período ${periodLabel}.`} />
    </div>
  );
}

function StatusBadge({ status, group }: { status: string; group: MasterCampaignRow["statusGroup"] }) {
  const variant = group === "Ativa" ? "default" : group === "Encerrada" ? "secondary" : "outline";
  return <Badge variant={variant}>{status}</Badge>;
}
