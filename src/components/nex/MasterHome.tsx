import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  AlertTriangle,
  CalendarClock,
  CalendarRange,
  CircleDollarSign,
  UserPlus,
  Users,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  LabelList,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BrazilUfMap, regionColor } from "@/components/nex/BrazilUfMap";
import { DashboardKpiCard, type KpiTrend } from "@/components/nex/DashboardKpiCard";
import { PeriodPicker } from "@/components/nex/PeriodPicker";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { moneyFromCents } from "@/lib/client-access";
import { masterDashboardFn } from "@/lib/clients.functions";
import { todayKey } from "@/lib/finance-access";
import type { DashboardKpi, DashboardKpiKey, MasterDashboard } from "@/lib/master-dashboard";
import { DASHBOARD_REGIONS, resolveDashboardPeriod } from "@/lib/master-dashboard";
import type { MetaPeriod } from "@/lib/meta-access";

const kpiModalTitles: Record<DashboardKpiKey, string> = {
  activeClients: "Clientes ativos",
  newClients: "Clientes novos",
  periodRevenue: "Clientes com receita no período",
  overdueClients: "Clientes em atraso",
  dueThisWeek: "Vencem esta semana",
  dueNextWeek: "Vencem próxima semana",
};

const paymentColors: Record<string, string> = {
  paid: "#22c55e",
  pending: "#3b82f6",
  overdue: "#ef4444",
};

const dashPanel =
  "rounded-xl border border-slate-400/[0.14] bg-gradient-to-b from-[#101a2e] to-[#0d1527] text-white shadow-[0_8px_24px_-12px_rgba(0,0,0,0.6)]";
const dashMuted = "text-[#8190a6]";
const chartTick = { fontSize: 12, fill: "#94a3b8" } as const;
const chartGrid = "rgba(148,163,184,0.14)";

const statusColors: Record<string, string> = {
  active: "#22c55e",
  overdue: "#ef4444",
  inactive: "#3b82f6",
};

function periodPayload(period: MetaPeriod) {
  if (period.mode === "custom") return { period: "custom", since: period.since, until: period.until };
  return { period: "total" };
}

function trendTone(delta: number, danger: boolean): KpiTrend["tone"] {
  if (danger) return "negative";
  return delta < 0 ? "negative" : "positive";
}

/** Contagens: "+3 (10,3%)" — receita: "+28%" */
function countTrend(kpi: DashboardKpi, danger = false): KpiTrend | undefined {
  if (!kpi.delta) return undefined;
  const abs = kpi.delta.value;
  const sign = abs > 0 ? "+" : "";
  const percent = kpi.delta.percent;
  const text =
    percent == null ? `${sign}${abs.toLocaleString("pt-BR")}` : `${sign}${abs.toLocaleString("pt-BR")} (${percent.toLocaleString("pt-BR")}%)`;
  return {
    direction: abs < 0 ? "down" : "up",
    text,
    tone: trendTone(abs, danger),
  };
}

function revenueTrend(kpi: DashboardKpi): KpiTrend | undefined {
  if (!kpi.delta || kpi.delta.percent == null) return undefined;
  const percent = kpi.delta.percent;
  const sign = percent > 0 ? "+" : "";
  return {
    direction: percent < 0 ? "down" : "up",
    text: `${sign}${percent.toLocaleString("pt-BR")}%`,
    tone: trendTone(percent, false),
  };
}

function countComparison(kpi: DashboardKpi) {
  if (!kpi.delta) return undefined;
  return `vs. ${kpi.delta.previous.toLocaleString("pt-BR")} no mês anterior`;
}

function revenueComparison(kpi: DashboardKpi) {
  if (!kpi.delta) return undefined;
  return `vs. ${moneyFromCents(kpi.delta.previous)} no período anterior`;
}

export function MasterHome() {
  const [period, setPeriod] = useState<MetaPeriod>(() => resolveDashboardPeriod(null, todayKey()));
  const [snapshot, setSnapshot] = useState<MasterDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [ufRegion, setUfRegion] = useState("all");
  const [activeRegion, setActiveRegion] = useState("SE");
  const [kpiModal, setKpiModal] = useState<DashboardKpiKey | null>(null);
  const navigate = useNavigate();

  const load = useCallback(async (next: MetaPeriod) => {
    setLoading(true);
    setError("");
    const result = await masterDashboardFn({ data: periodPayload(next) });
    setLoading(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setPeriod(result.data.period);
    setSnapshot(result.data);
    const topRegion = result.data.regions.find((region) => region.clients > 0) ?? result.data.regions[0];
    if (topRegion) setActiveRegion(topRegion.key);
  }, []);

  useEffect(() => {
    void load(resolveDashboardPeriod(null, todayKey()));
  }, [load]);

  const openClient = (id: string) => {
    setKpiModal(null);
    void navigate({ to: "/master/financeiro/$orgId", params: { orgId: id } });
  };

  const openKpiModal = (key: DashboardKpiKey) => setKpiModal(key);
  const kpiModalRows = kpiModal && snapshot ? snapshot.kpiClients[kpiModal] : [];

  const series = useMemo(
    () =>
      (snapshot?.revenueClientsSeries ?? []).map((item) => ({
        ...item,
        revenue: item.revenueCents / 100,
      })),
    [snapshot],
  );

  const paymentData = snapshot?.paymentSlices.filter((item) => item.cents > 0) ?? [];
  const statusData = snapshot?.statusSlices.filter((item) => item.value > 0) ?? [];
  const paymentTotal = snapshot?.paymentSlices.reduce((sum, item) => sum + item.cents, 0) ?? 0;
  const statusTotal = snapshot?.statusSlices.reduce((sum, item) => sum + item.value, 0) ?? 0;
  const ufCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const row of snapshot?.ufs ?? []) map[row.uf] = row.clients;
    return map;
  }, [snapshot]);

  const ufRows = useMemo(() => {
    const rows = snapshot?.ufs ?? [];
    if (ufRegion === "all") return rows.slice(0, 10);
    const allowed = new Set(DASHBOARD_REGIONS.find((region) => region.key === ufRegion)?.ufs ?? []);
    return rows.filter((row) => allowed.has(row.uf)).slice(0, 10);
  }, [snapshot, ufRegion]);
  const maxUf = Math.max(1, ...ufRows.map((item) => item.clients), 1);
  const regionMax = Math.max(1, ...(snapshot?.regions.map((item) => item.clients) ?? [1]));

  const dueWeekRows = useMemo(
    () =>
      (snapshot?.dueWeeks ?? []).map((week, index) => ({
        ...week,
        shortLabel: index === 0 ? "Esta semana" : index === 1 ? "Próxima semana" : `Semana ${index + 1}`,
        displayLabel:
          index === 0 ? `Esta semana (${week.label})` : index === 1 ? `Próxima semana (${week.label})` : `Semana ${index + 1} (${week.label})`,
      })),
    [snapshot],
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
        <PeriodPicker
          value={period}
          disabled={loading}
          onApply={(next) => void load(next)}
          totalHint="Consolida clientes, receitas e vencimentos de todo o histórico disponível."
        />
      </div>

      {loading && <p className="text-sm text-muted-foreground">Montando o dashboard financeiro...</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}

      {snapshot && (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <DashboardKpiCard
              icon={Users}
              accentColor="#3b82f6"
              label="Clientes ativos"
              value={String(snapshot.activeClients.value)}
              trend={countTrend(snapshot.activeClients)}
              comparison={countComparison(snapshot.activeClients)}
              footerLabel={`Ver clientes (${snapshot.kpiClients.activeClients.length})`}
              onFooterClick={() => openKpiModal("activeClients")}
            />
            <DashboardKpiCard
              icon={UserPlus}
              accentColor="#22c55e"
              label="Clientes novos"
              value={String(snapshot.newClients.value)}
              trend={countTrend(snapshot.newClients)}
              comparison={countComparison(snapshot.newClients)}
              footerLabel={`Ver clientes (${snapshot.kpiClients.newClients.length})`}
              onFooterClick={() => openKpiModal("newClients")}
            />
            <DashboardKpiCard
              icon={CircleDollarSign}
              accentColor="#14b8a6"
              label="Receita do período"
              value={moneyFromCents(snapshot.periodRevenue.cents ?? 0)}
              trend={revenueTrend(snapshot.periodRevenue)}
              comparison={revenueComparison(snapshot.periodRevenue)}
              footerLabel={`Ver clientes (${snapshot.kpiClients.periodRevenue.length})`}
              onFooterClick={() => openKpiModal("periodRevenue")}
            />
            <DashboardKpiCard
              icon={AlertTriangle}
              accentColor="#ef4444"
              label="Clientes em atraso"
              value={String(snapshot.overdueClients.value)}
              trend={countTrend(snapshot.overdueClients, true)}
              comparison={countComparison(snapshot.overdueClients)}
              footerLabel={`Ver clientes (${snapshot.kpiClients.overdueClients.length})`}
              onFooterClick={() => openKpiModal("overdueClients")}
            />
            <DashboardKpiCard
              icon={CalendarClock}
              accentColor="#3b82f6"
              label="Vencem esta semana"
              value={String(snapshot.dueThisWeek.value)}
              subValue={moneyFromCents(snapshot.dueThisWeek.cents ?? 0)}
              footerLabel={`Ver clientes (${snapshot.kpiClients.dueThisWeek.length})`}
              onFooterClick={() => openKpiModal("dueThisWeek")}
            />
            <DashboardKpiCard
              icon={CalendarRange}
              accentColor="#3b82f6"
              label="Vencem próxima semana"
              value={String(snapshot.dueNextWeek.value)}
              subValue={moneyFromCents(snapshot.dueNextWeek.cents ?? 0)}
              footerLabel={`Ver clientes (${snapshot.kpiClients.dueNextWeek.length})`}
              onFooterClick={() => openKpiModal("dueNextWeek")}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.4fr_1fr]">
            <section className={`${dashPanel} p-5 sm:p-6`}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-lg font-bold text-white">Receita e clientes</h2>
                  <p className={`mt-1 text-[13px] ${dashMuted}`}>
                    Evolução mensal da receita e dos clientes que contrataram nos últimos 6 meses.
                  </p>
                </div>
                <span className="inline-flex h-9 items-center rounded-lg border border-slate-400/20 bg-[#0b1220] px-3 text-[13px] text-slate-200">
                  Últimos 6 meses
                </span>
              </div>

              <div className="mt-4 flex flex-wrap gap-5 text-xs text-slate-300">
                <span className="inline-flex items-center gap-2">
                  <span className="size-2.5 rounded-full bg-[#8b5cf6]" />
                  Receita (R$)
                </span>
                <span className="inline-flex items-center gap-2">
                  <span className="size-2.5 rounded-full bg-[#22d3ee]" />
                  Clientes contratados
                </span>
              </div>

              <div className="mt-3 h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={series} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="dashRevenueBar" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#8b5cf6" />
                        <stop offset="100%" stopColor="#3b82f6" />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" stroke={chartGrid} />
                    <XAxis dataKey="label" tick={chartTick} axisLine={false} tickLine={false} />
                    <YAxis
                      yAxisId="revenue"
                      tickFormatter={(value: number) =>
                        `R$ ${value.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`
                      }
                      tick={chartTick}
                      axisLine={false}
                      tickLine={false}
                      width={72}
                    />
                    <YAxis yAxisId="clients" orientation="right" tick={chartTick} axisLine={false} tickLine={false} width={32} />
                    <Tooltip
                      cursor={{ fill: "rgba(148,163,184,0.06)" }}
                      content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null;
                        const row = payload[0]?.payload as { revenueCents?: number; activeClients?: number };
                        return (
                          <div className="rounded-lg border border-slate-400/20 bg-[#0b1220] px-3 py-2 text-xs text-slate-200 shadow-lg">
                            <p className="font-semibold text-white">{label}</p>
                            <p className="mt-1">Receita: {moneyFromCents(row.revenueCents ?? 0)}</p>
                            <p>Contratados: {row.activeClients ?? 0}</p>
                          </div>
                        );
                      }}
                    />
                    <Bar yAxisId="revenue" dataKey="revenue" name="Receita" fill="url(#dashRevenueBar)" radius={[6, 6, 0, 0]} barSize={44} />
                    <Line
                      yAxisId="clients"
                      type="monotone"
                      dataKey="activeClients"
                      name="Contratados"
                      stroke="#22d3ee"
                      strokeWidth={2.5}
                      dot={{ r: 5, fill: "#22d3ee", stroke: "#fff", strokeWidth: 2 }}
                      activeDot={{ r: 6 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className={`${dashPanel} p-5 sm:p-6`}>
              <div>
                <h2 className="text-lg font-bold text-white">Receita por situação de pagamento</h2>
                <p className={`mt-1 text-[13px] ${dashMuted}`}>Distribuição da receita do período por status.</p>
              </div>

              <div className="mt-6 flex flex-col items-center gap-7 sm:flex-row sm:items-center">
                <div className="relative h-[200px] w-[200px] shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={paymentData.length ? paymentData : [{ key: "empty", label: "—", cents: 1, percent: 100, value: 1 }]}
                        dataKey="cents"
                        nameKey="label"
                        innerRadius={68}
                        outerRadius={94}
                        paddingAngle={2.5}
                        startAngle={90}
                        endAngle={-270}
                        stroke="none"
                      >
                        {(paymentData.length ? paymentData : [{ key: "empty" }]).map((item) => (
                          <Cell key={item.key} fill={paymentColors[item.key] ?? "#334155"} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number) => moneyFromCents(value)}
                        contentStyle={{
                          borderRadius: 8,
                          border: "1px solid rgba(148,163,184,0.2)",
                          background: "#0b1220",
                          color: "#e2e8f0",
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                    <p className="text-[17px] font-bold tabular-nums text-white">{moneyFromCents(paymentTotal)}</p>
                    <p className="text-xs text-slate-400">no período</p>
                  </div>
                </div>

                <div className="flex w-full flex-1 flex-col gap-5">
                  {snapshot.paymentSlices.map((item) => (
                    <div key={item.key} className="grid grid-cols-[10px_1fr_auto] items-center gap-x-2.5">
                      <span className="size-2.5 rounded-full" style={{ background: paymentColors[item.key] }} />
                      <span className="text-sm text-slate-200">{item.label}</span>
                      <span className="text-sm font-bold tabular-nums text-white">{item.percent}%</span>
                      <span className={`col-span-2 col-start-2 text-[12.5px] tabular-nums ${dashMuted}`}>{moneyFromCents(item.cents)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.25fr_1fr]">
            <section className={`${dashPanel} p-5 sm:p-6`}>
              <div>
                <h2 className="text-lg font-bold text-white">Distribuição de clientes por região</h2>
                <p className={`mt-1 text-[13px] ${dashMuted}`}>
                  {snapshot.unknownGeoClients
                    ? `${snapshot.unknownGeoClients} cliente(s) sem UF no cadastro de contratação.`
                    : "UF da contratação agrupada nas 5 regiões com maior concentração."}
                </p>
              </div>

              <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:items-center">
                <BrazilUfMap
                  regions={snapshot.regions}
                  ufCounts={ufCounts}
                  activeKey={activeRegion}
                  onSelect={(key) => {
                    setActiveRegion(key);
                    setUfRegion(key);
                  }}
                />

                <div>
                  <div className="grid grid-cols-[minmax(0,1fr)_64px_72px] gap-2.5 border-b border-slate-400/10 pb-2.5 text-[11px] uppercase tracking-[0.06em] text-slate-500">
                    <span>Região</span>
                    <span className="text-right">Clientes</span>
                    <span className="text-right">% do total</span>
                  </div>
                  {snapshot.regions.slice(0, 5).map((region) => {
                    const active = region.key === activeRegion;
                    const color = regionColor(region.key);
                    return (
                      <button
                        key={region.key}
                        type="button"
                        onClick={() => {
                          setActiveRegion(region.key);
                          setUfRegion(region.key);
                        }}
                        className={`grid w-full grid-cols-[minmax(0,1fr)_64px_72px] gap-x-2.5 border-b border-slate-400/[0.08] py-3 text-left last:border-0 ${
                          active ? "rounded-lg border-transparent bg-gradient-to-r from-violet-500/10 to-transparent px-2.5" : ""
                        }`}
                      >
                        <span className="min-w-0">
                          <span className="flex items-center gap-2 text-sm font-medium text-slate-100">
                            <span className="size-2.5 rounded-full" style={{ background: color, boxShadow: `0 0 0 3px color-mix(in srgb, ${color} 22%, transparent)` }} />
                            {region.label}
                          </span>
                          <span className="mt-2 block h-1 overflow-hidden rounded-full bg-slate-400/10">
                            <span
                              className="block h-full rounded-full"
                              style={{ width: `${Math.round((region.clients / regionMax) * 100)}%`, background: color }}
                            />
                          </span>
                        </span>
                        <span className="self-start text-right text-sm font-semibold tabular-nums text-white">{region.clients}</span>
                        <span className={`self-start text-right text-sm tabular-nums ${dashMuted}`}>{region.percent}%</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>

            <section className={`${dashPanel} p-5 sm:p-6`}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-lg font-bold text-white">Clientes por UF</h2>
                  <p className={`mt-1 text-[13px] ${dashMuted}`}>Top 10 estados com mais clientes.</p>
                </div>
                <Select
                  value={ufRegion}
                  onValueChange={(value) => {
                    setUfRegion(value);
                    if (value !== "all") setActiveRegion(value);
                  }}
                >
                  <SelectTrigger className="h-9 w-full border-slate-400/20 bg-[#0b1220] text-[13px] text-slate-200 sm:w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as regiões</SelectItem>
                    {DASHBOARD_REGIONS.map((region) => (
                      <SelectItem key={region.key} value={region.key}>
                        {region.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {ufRows.length === 0 ? (
                <p className={`mt-8 text-sm ${dashMuted}`}>Nenhuma UF disponível ainda.</p>
              ) : (
                <div className="mt-4 h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={ufRows} margin={{ top: 24, right: 8, left: -8, bottom: 0 }}>
                      <defs>
                        <linearGradient id="dashUfBar" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#8b5cf6" />
                          <stop offset="100%" stopColor="#38bdf8" />
                        </linearGradient>
                      </defs>
                      <CartesianGrid vertical={false} strokeDasharray="3 4" stroke={chartGrid} />
                      <XAxis dataKey="uf" tick={chartTick} axisLine={false} tickLine={false} />
                      <YAxis
                        allowDecimals={false}
                        domain={[0, Math.max(maxUf, 1)]}
                        tick={chartTick}
                        axisLine={false}
                        tickLine={false}
                        width={28}
                      />
                      <Tooltip
                        formatter={(value: number) => [`${value} cliente(s)`, "Clientes"]}
                        contentStyle={{
                          borderRadius: 8,
                          border: "1px solid rgba(148,163,184,0.2)",
                          background: "#0b1220",
                          color: "#e2e8f0",
                        }}
                      />
                      <Bar dataKey="clients" fill="url(#dashUfBar)" radius={[6, 6, 0, 0]} maxBarSize={28}>
                        <LabelList dataKey="clients" position="top" fill="#e2e8f0" fontSize={12} fontWeight={600} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </section>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <section className={`${dashPanel} p-5 sm:p-6`}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-lg font-bold text-white">Top 5 clientes em receita</h2>
                  <p className={`mt-1 text-[13px] ${dashMuted}`}>Clientes com maior receita no período selecionado.</p>
                </div>
                <Select value="period">
                  <SelectTrigger className="h-9 w-full border-slate-400/20 bg-[#0b1220] text-[13px] text-slate-200 sm:w-[168px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="period">Receita do período</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {snapshot.topClients.length === 0 ? (
                <p className={`mt-8 text-sm ${dashMuted}`}>Sem cobranças neste período.</p>
              ) : (
                <div className="mt-5">
                  <div className="grid grid-cols-[28px_minmax(0,1.2fr)_minmax(0,1fr)_88px_64px] gap-2 border-b border-slate-400/10 pb-2 text-[11px] uppercase tracking-[0.06em] text-slate-500">
                    <span>#</span>
                    <span>Cliente</span>
                    <span className="sr-only">Participação</span>
                    <span className="text-right">Receita</span>
                    <span className="text-right">% do total</span>
                  </div>
                  {snapshot.topClients.map((client, index) => {
                    const bar = Math.min(100, Math.max(client.percent, 4));
                    return (
                      <button
                        key={client.id}
                        type="button"
                        onClick={() => openClient(client.id)}
                        className="grid w-full grid-cols-[28px_minmax(0,1.2fr)_minmax(0,1fr)_88px_64px] items-center gap-2 border-b border-slate-400/[0.08] py-3 text-left last:border-0 hover:bg-white/[0.03]"
                      >
                        <span className="grid size-6 place-items-center rounded-full bg-slate-400/10 text-xs font-semibold text-slate-300">
                          {index + 1}
                        </span>
                        <span className="truncate text-sm font-medium text-slate-100" title={client.name}>
                          {client.name}
                        </span>
                        <span className="h-1.5 overflow-hidden rounded-full bg-slate-400/10">
                          <span className="block h-full rounded-full bg-gradient-to-r from-[#8b5cf6] to-[#3b82f6]" style={{ width: `${bar}%` }} />
                        </span>
                        <span className="text-right text-sm font-semibold tabular-nums text-white">{moneyFromCents(client.revenueCents)}</span>
                        <span className={`text-right text-sm tabular-nums ${dashMuted}`}>
                          {client.percent.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>

            <section className={`${dashPanel} p-5 sm:p-6`}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-lg font-bold text-white">Vencimentos por semana</h2>
                  <p className={`mt-1 text-[13px] ${dashMuted}`}>Soma dos vencimentos em aberto de cada semana.</p>
                </div>
                <span className="inline-flex h-9 items-center rounded-lg border border-slate-400/20 bg-[#0b1220] px-3 text-[13px] text-slate-200">
                  Próximas 4 semanas
                </span>
              </div>

              <div className="mt-4 h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dueWeekRows} margin={{ top: 28, right: 8, left: 4, bottom: 8 }}>
                    <defs>
                      <linearGradient id="dashDueBar" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#8b5cf6" />
                        <stop offset="100%" stopColor="#3b82f6" />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} strokeDasharray="3 4" stroke={chartGrid} />
                    <XAxis dataKey="shortLabel" tick={chartTick} axisLine={false} tickLine={false} interval={0} />
                    <YAxis
                      tickFormatter={(value: number) => `R$ ${Math.round(value / 100).toLocaleString("pt-BR")}`}
                      tick={chartTick}
                      axisLine={false}
                      tickLine={false}
                      width={64}
                    />
                    <Tooltip
                      formatter={(_value: number, _name, item) => [
                        moneyFromCents(Number(item?.payload?.cents ?? 0)),
                        `${item?.payload?.count ?? 0} cobrança(s)`,
                      ]}
                      contentStyle={{
                        borderRadius: 8,
                        border: "1px solid rgba(148,163,184,0.2)",
                        background: "#0b1220",
                        color: "#e2e8f0",
                      }}
                    />
                    <Bar dataKey="cents" fill="url(#dashDueBar)" radius={[6, 6, 0, 0]} maxBarSize={44}>
                      <LabelList
                        dataKey="cents"
                        position="top"
                        fill="#e2e8f0"
                        fontSize={11}
                        fontWeight={600}
                        formatter={(value: number) => moneyFromCents(Number(value))}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className={`${dashPanel} p-5 sm:p-6`}>
              <div>
                <h2 className="text-lg font-bold text-white">Clientes por status</h2>
                <p className={`mt-1 text-[13px] ${dashMuted}`}>Quantidade de clientes por situação.</p>
              </div>

              <div className="mt-6 flex flex-col items-center gap-6 sm:flex-row sm:items-center">
                <div className="relative h-[180px] w-[180px] shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={statusData.length ? statusData : [{ key: "empty", label: "—", value: 1, percent: 100, cents: 0 }]}
                        dataKey="value"
                        nameKey="label"
                        innerRadius={58}
                        outerRadius={82}
                        paddingAngle={2.5}
                        startAngle={90}
                        endAngle={-270}
                        stroke="none"
                      >
                        {(statusData.length ? statusData : [{ key: "empty" }]).map((item) => (
                          <Cell key={item.key} fill={statusColors[item.key] ?? "#334155"} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          borderRadius: 8,
                          border: "1px solid rgba(148,163,184,0.2)",
                          background: "#0b1220",
                          color: "#e2e8f0",
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                    <p className="text-2xl font-bold tabular-nums text-white">{statusTotal}</p>
                    <p className="text-xs text-slate-400">clientes</p>
                  </div>
                </div>

                <div className="flex w-full flex-1 flex-col gap-4">
                  {snapshot.statusSlices.map((item) => (
                    <div key={item.key} className="grid grid-cols-[10px_1fr_auto_auto] items-center gap-x-3">
                      <span className="size-2.5 rounded-full" style={{ background: statusColors[item.key] }} />
                      <span className="text-sm text-slate-200">{item.label}</span>
                      <span className="text-sm font-semibold tabular-nums text-white">{item.value}</span>
                      <span className={`text-sm tabular-nums ${dashMuted}`}>{item.percent}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>
          <Dialog open={kpiModal != null} onOpenChange={(open) => !open && setKpiModal(null)}>
            <DialogContent className="max-h-[85vh] w-[calc(100%-2rem)] max-w-lg overflow-hidden border-slate-400/20 bg-[#0d1527] text-white">
              <DialogHeader>
                <DialogTitle>{kpiModal ? kpiModalTitles[kpiModal] : "Clientes"}</DialogTitle>
                <DialogDescription className="text-slate-400">
                  {kpiModalRows.length} cliente{kpiModalRows.length === 1 ? "" : "s"} neste indicador.
                </DialogDescription>
              </DialogHeader>
              <div className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
                {kpiModalRows.length === 0 ? (
                  <p className="py-6 text-center text-sm text-slate-400">Nenhum cliente neste indicador.</p>
                ) : (
                  kpiModalRows.map((client) => (
                    <button
                      key={client.id}
                      type="button"
                      onClick={() => openClient(client.id)}
                      className="flex w-full items-center justify-between gap-3 rounded-lg border border-slate-400/10 bg-[#0b1220]/70 px-3 py-2.5 text-left transition hover:border-slate-400/25 hover:bg-white/[0.03]"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-white">{client.name}</span>
                        <span className="mt-0.5 block truncate text-xs text-slate-400">{client.detail || client.status}</span>
                      </span>
                      {client.cents != null ? (
                        <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-100">{moneyFromCents(client.cents)}</span>
                      ) : client.state ? (
                        <span className="shrink-0 text-xs tabular-nums text-slate-400">{client.state}</span>
                      ) : null}
                    </button>
                  ))
                )}
              </div>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}

