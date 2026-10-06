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
  };

  useEffect(() => {
    void load(initialPeriod);
  }, []);

  const openCampaign = (row: MasterCampaignRow) => {
    setSelected(row);
    setChartError("");
    const cached = chartCache.current.get(row.organizationId);
    if (cached) {
      setChartView(cached);
      setChartLoading(false);
      return;
    }
    const ticket = chartRequest.current + 1;
    chartRequest.current = ticket;
    setChartView(null);
    setChartLoading(true);
    void getMetaPerformanceFn({ data: { organizationId: row.organizationId, period: "total" } })
      .then((result) => {
        if (ticket !== chartRequest.current) return;
        setChartLoading(false);
        if (!result.ok) {
          setChartError(result.message);
          return;
        }
        chartCache.current.set(row.organizationId, result.data);
        setChartView(result.data);
      })
      .catch(() => {
        if (ticket !== chartRequest.current) return;
        setChartLoading(false);
        setChartError("Não foi possível carregar os gráficos desta campanha.");
      });
  };

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
              {selected ? `${selected.clientName} • ${selected.accountName}` : ""} • somente leitura
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
          {chartLoading && <div className="h-80 animate-pulse rounded-lg bg-muted" />}
          {chartError && <p className="text-sm text-destructive">{chartError}</p>}
          {selected && chartView && !chartLoading && !chartError && <CampaignCharts row={selected} view={chartView} />}
          <p className="text-sm text-muted-foreground">A campanha não pode ser alterada pelo NEX Ads.</p>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CampaignCharts({ row, view }: { row: MasterCampaignRow; view: MetaPerformanceView }) {
  const campaign = view.campaigns.find((item) => item.id === row.id) ?? null;
  const hasLine = Boolean(campaign && view.series.points.length > 0 && view.series.campaigns.some((item) => item.id === campaign.id));
  if (!campaign) return <p className="text-sm text-muted-foreground">Não há indicadores desta campanha no período máximo.</p>;
  return (
    <div className="space-y-5">
      {hasLine ? (
        <EvolutionChart series={view.series} selectedId={campaign.id} />
      ) : (
        <p className="text-sm text-muted-foreground">Não há evolução diária desta campanha no período máximo.</p>
      )}
      <ResultsChart rows={[campaign]} currency={view.currency || row.currency} title="Resultados da campanha" description="Volume de resultados e custo por resultado no período máximo." />
    </div>
  );
}

function StatusBadge({ status, group }: { status: string; group: MasterCampaignRow["statusGroup"] }) {
  const variant = group === "Ativa" ? "default" : group === "Encerrada" ? "secondary" : "outline";
  return <Badge variant={variant}>{status}</Badge>;
}
