import { Link } from "@tanstack/react-router";
import { Eye, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CampaignAnalysis } from "@/components/nex/CampaignAnalysis";
import { PeriodPicker } from "@/components/nex/PeriodPicker";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

const initialPeriod: MetaPeriod = { mode: "total" };
const noCampaigns: MetaCampaignRow[] = [];

export function MetaPerformance({
  mode,
  organizationId: organizationFromRoute = "",
}: {
  mode: "overview" | "campaigns";
  organizationId?: string;
}) {
  const [period, setPeriod] = useState<MetaPeriod>(initialPeriod);
  const [view, setView] = useState<MetaPerformanceView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [campaignId, setCampaignId] = useState("all");
  const [chartId, setChartId] = useState<string | null>(null);
  const organizationId = organizationFromRoute || readOrg();

  const load = async (nextPeriod: MetaPeriod) => {
    setLoading(true);
    setError("");
    const data: { organizationId?: string; period?: string; since?: string; until?: string } = {
      period: nextPeriod.mode,
    };
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
  const selectedCampaign =
    showCampaignFilter && campaignId !== "all"
      ? (listedCampaigns.find((row) => row.id === campaignId) ?? null)
      : null;

  useEffect(() => {
    if (campaignId !== "all" && !listedCampaigns.some((row) => row.id === campaignId))
      setCampaignId("all");
  }, [campaignId, listedCampaigns]);

  const campaigns = useMemo(() => {
    const rows = selectedCampaign
      ? listedCampaigns.filter((row) => row.id === selectedCampaign.id)
      : listedCampaigns;
    return rows.filter((row) => {
      const matchesQuery = row.name.toLowerCase().includes(query.trim().toLowerCase());
      const matchesStatus = status === "all" || row.statusGroup === status;
      return matchesQuery && matchesStatus;
    });
  }, [listedCampaigns, selectedCampaign, query, status]);

  const chartName = listedCampaigns.find((row) => row.id === chartId)?.name ?? "Campanha";

  const ready = Boolean(view?.kpis && view.accountId);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 rounded-lg border bg-card p-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <p className="text-xs font-medium text-muted-foreground">Conta de anúncios</p>
          <p className="mt-1 text-sm font-semibold">
            {view?.accountName
              ? `${view.accountName}${view.accountId ? ` · ${view.accountId}` : ""}`
              : "Conta de anúncio não vinculada"}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
          {showCampaignFilter && (
            <Select
              value={selectedCampaign ? selectedCampaign.id : "all"}
              onValueChange={setCampaignId}
            >
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

      {error && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </p>
      )}

      {view && !view.canView && (
        <p className="rounded-lg border p-4 text-sm text-muted-foreground">
          Você não tem permissão para ver as campanhas desta conta.
        </p>
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

      {view?.lastError && ready === false && (
        <p className="text-sm text-destructive">{view.lastError}</p>
      )}

      {ready && view?.kpis && (
        <>
          {mode === "overview" && (
            <CampaignAnalysis view={view} campaignId={selectedCampaign?.id ?? null} />
          )}
          {mode === "overview" && view.campaigns.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Nenhuma campanha encontrada nesta conta no período.
            </p>
          )}
          {mode === "campaigns" && (
            <div className="flex flex-col gap-3 sm:flex-row">
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar campanha"
              />
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
          {mode === "campaigns" && (
            <CampaignTable rows={campaigns} currency={view.currency} onOpenCharts={setChartId} />
          )}
          {mode === "campaigns" && (
            <Dialog open={chartId !== null} onOpenChange={(open) => !open && setChartId(null)}>
              <DialogContent className="max-h-[90vh] w-[calc(100%-2rem)] max-w-5xl overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="pr-8 font-display">{chartName}</DialogTitle>
                  <DialogDescription>
                    Análise do período selecionado no topo da página.
                  </DialogDescription>
                </DialogHeader>
                {chartId && (
                  <CampaignAnalysis view={view} campaignId={chartId} variant="campaign" />
                )}
              </DialogContent>
            </Dialog>
          )}
          {mode === "campaigns" && view.campaigns.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Nenhuma campanha encontrada nesta conta no período.
            </p>
          )}
          {mode === "campaigns" && view.campaigns.length > 0 && campaigns.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Nenhuma campanha encontrada com esse filtro.
            </p>
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

const lineColors = [
  "var(--primary)",
  "var(--info)",
  "var(--success)",
  "var(--warning)",
  "var(--cyan)",
  "var(--destructive)",
];

function lineColor(index: number) {
  return lineColors[index] ?? `oklch(0.62 0.16 ${(index * 47) % 360})`;
}

function dayLabel(iso: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return iso;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])).toLocaleDateString(
    "pt-BR",
    { day: "2-digit", month: "short" },
  );
}

export function EvolutionChart({
  series,
  selectedId,
}: {
  series: MetaPerformanceView["series"];
  selectedId: string | null;
}) {
  const lines = (
    selectedId ? series.campaigns.filter((item) => item.id === selectedId) : series.campaigns
  ).map((item, index) => ({
    ...item,
    color: lineColor(
      series.campaigns.findIndex((campaign) => campaign.id === item.id) >= 0
        ? series.campaigns.findIndex((campaign) => campaign.id === item.id)
        : index,
    ),
  }));
  if (lines.length === 0 || series.points.length === 0) return null;
  const labels = new Set(lines.map((item) => item.resultLabel));
  const subtitle =
    labels.size === 1 ? `${[...labels][0]} ao longo dos dias` : "Resultados ao longo dos dias";
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
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              axisLine={false}
              tickLine={false}
              minTickGap={24}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              axisLine={false}
              tickLine={false}
              width={36}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                return (
                  <div className="min-w-48 rounded-md border bg-popover px-3 py-2.5 text-popover-foreground shadow-sm">
                    <p className="mb-2 border-b pb-2 text-xs font-semibold">{label}</p>
                    <div className="space-y-1.5 text-xs">
                      {payload.map((item) => (
                        <div key={String(item.dataKey)} className="flex justify-between gap-5">
                          <span className="text-muted-foreground">
                            {lines.find((line) => line.id === item.dataKey)?.name ?? item.name}
                          </span>
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
                    <li
                      key={line.id}
                      className="flex max-w-full items-center gap-1.5"
                      title={line.name}
                    >
                      <span
                        className="size-2 shrink-0 rounded-full"
                        style={{ background: line.color }}
                      />
                      <span className="truncate">{line.name}</span>
                    </li>
                  ))}
                </ul>
              )}
            />
            {lines.map((line) => (
              <Line
                key={line.id}
                type="monotone"
                dataKey={line.id}
                name={line.name}
                stroke={line.color}
                strokeWidth={2}
                dot={data.length <= 31}
                activeDot={{ r: 4 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

function CampaignTable({
  rows,
  currency,
  onOpenCharts,
}: {
  rows: MetaCampaignRow[];
  currency: string;
  onOpenCharts: (id: string) => void;
}) {
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
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 shrink-0 text-primary"
                    aria-label={`Ver gráficos de ${row.name}`}
                    onClick={() => onOpenCharts(row.id)}
                  >
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
              <td className="px-4 py-3">
                {row.results > 0 ? money(costPerResult(row), currency) : "—"}
              </td>
              <td className="px-4 py-3">{money(row.spend, currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
