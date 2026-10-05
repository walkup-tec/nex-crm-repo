import { Link } from "@tanstack/react-router";
import { RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PeriodPicker } from "@/components/nex/PeriodPicker";
import { Button } from "@/components/ui/button";
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

export function MetaPerformance({ mode }: { mode: "overview" | "campaigns" }) {
  const [period, setPeriod] = useState<MetaPeriod>(initialPeriod);
  const [view, setView] = useState<MetaPerformanceView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [campaignId, setCampaignId] = useState("all");
  const organizationId = readOrg();

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
              <ResultsChart rows={selectedCampaign ? [selectedCampaign] : view.campaigns} currency={view.currency} />
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
          {mode === "campaigns" && <CampaignTable rows={campaigns} currency={view.currency} />}
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

function shortCampaignName(name: string) {
  const clean = name.replace(/\s+/g, " ").trim();
  return clean.length > 22 ? `${clean.slice(0, 20)}…` : clean;
}

function ResultsChart({ rows, currency }: { rows: MetaCampaignRow[]; currency: string }) {
  const data = rows.map((row) => ({
    name: shortCampaignName(row.name),
    fullName: row.name,
    resultados: row.results,
    custo: costPerResult(row),
  }));
  return (
    <section className="rounded-lg border bg-card p-5">
      <h2 className="font-display text-lg font-semibold">Resultados entre campanhas</h2>
      <p className="mt-1 text-sm text-muted-foreground">Volume de resultados e custo por resultado.</p>
      <div className="mt-4 h-80 w-full overflow-x-auto">
        <div className="h-full" style={{ minWidth: Math.max(320, rows.length * 88) }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} interval={0} />
              <YAxis yAxisId="left" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} width={36} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} width={48} />
              <Tooltip
                cursor={{ fill: "var(--muted)", fillOpacity: 0.55 }}
                content={({ active, payload }) => {
                  const point = payload?.[0]?.payload as { fullName?: string; resultados?: number; custo?: number } | undefined;
                  if (!active || !point) return null;
                  return (
                    <div className="min-w-48 rounded-md border bg-popover px-3 py-2.5 text-popover-foreground shadow-sm">
                      <p className="mb-2 border-b pb-2 text-xs font-semibold">{point.fullName}</p>
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
      </div>
    </section>
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

function CampaignTable({ rows, currency }: { rows: MetaCampaignRow[]; currency: string }) {
  if (rows.length === 0) return null;
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead className="border-b bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-medium">Nome</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Alcance</th>
            <th className="px-4 py-3 font-medium">Impressões</th>
            <th className="px-4 py-3 font-medium">Resultados</th>
            <th className="px-4 py-3 font-medium">Gasto</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b last:border-0">
              <td className="px-4 py-3">
                <p className="font-medium">{row.name}</p>
                <p className="text-xs text-muted-foreground">{row.resultLabel}</p>
              </td>
              <td className="px-4 py-3">{row.status}</td>
              <td className="px-4 py-3">{integer(row.reach)}</td>
              <td className="px-4 py-3">{integer(row.impressions)}</td>
              <td className="px-4 py-3">{integer(row.results)}</td>
              <td className="px-4 py-3">{money(row.spend, currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
