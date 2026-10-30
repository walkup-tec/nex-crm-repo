import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
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
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PeriodPicker } from "@/components/nex/PeriodPicker";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { moneyFromCents } from "@/lib/client-access";
import { masterDashboardFn } from "@/lib/clients.functions";
import { todayKey } from "@/lib/finance-access";
import type { DashboardKpi, MasterDashboard } from "@/lib/master-dashboard";
import { resolveDashboardPeriod } from "@/lib/master-dashboard";
import type { MetaPeriod } from "@/lib/meta-access";

const paymentColors: Record<string, string> = {
  paid: "#22c55e",
  pending: "#3b82f6",
  overdue: "#ef4444",
};

const statusColors: Record<string, string> = {
  active: "#8b5cf6",
  overdue: "#ef4444",
  inactive: "#64748b",
};

const regionColors: Record<string, string> = {
  SE: "#7c3aed",
  S: "#6366f1",
  NE: "#38bdf8",
  CO: "#22d3ee",
  N: "#94a3b8",
};

function periodPayload(period: MetaPeriod) {
  if (period.mode === "custom") return { period: "custom", since: period.since, until: period.until };
  return { period: "total" };
}

function deltaTone(value: number | null | undefined) {
  if (value == null || value === 0) return "text-muted-foreground";
  return value > 0 ? "text-success" : "text-destructive";
}

function formatDelta(kpi: DashboardKpi) {
  if (!kpi.delta) return null;
  const percent = kpi.delta.percent;
  if (percent == null) return null;
  const sign = percent > 0 ? "+" : "";
  return `${sign}${percent.toLocaleString("pt-BR")}%`;
}

export function MasterHome() {
  const [period, setPeriod] = useState<MetaPeriod>(() => resolveDashboardPeriod(null, todayKey()));
  const [snapshot, setSnapshot] = useState<MasterDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
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
  }, []);

  useEffect(() => {
    void load(resolveDashboardPeriod(null, todayKey()));
  }, [load]);

  const openClients = () => {
    void navigate({ to: "/master/clientes" });
  };

  const openFinance = () => {
    void navigate({ to: "/master/financeiro" });
  };

  const openClient = (id: string) => {
    void navigate({ to: "/master/financeiro/$orgId", params: { orgId: id } });
  };

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
  const maxUf = Math.max(1, ...(snapshot?.ufs.map((item) => item.clients) ?? [1]));

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
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
            <KpiCard
              icon={Users}
              label="Clientes ativos"
              value={String(snapshot.activeClients.value)}
              delta={formatDelta(snapshot.activeClients)}
              deltaValue={snapshot.activeClients.delta?.percent}
              onClients={openClients}
            />
            <KpiCard
              icon={UserPlus}
              label="Clientes novos"
              value={String(snapshot.newClients.value)}
              delta={formatDelta(snapshot.newClients)}
              deltaValue={snapshot.newClients.delta?.percent}
              onClients={openClients}
            />
            <KpiCard
              icon={CircleDollarSign}
              label="Receita do período"
              value={moneyFromCents(snapshot.periodRevenue.cents ?? 0)}
              delta={formatDelta(snapshot.periodRevenue)}
              deltaValue={snapshot.periodRevenue.delta?.percent}
              onClients={openFinance}
              actionLabel="Ver financeiro"
            />
            <KpiCard
              icon={AlertTriangle}
              label="Clientes em atraso"
              value={String(snapshot.overdueClients.value)}
              delta={formatDelta(snapshot.overdueClients)}
              deltaValue={snapshot.overdueClients.delta?.percent}
              danger
              onClients={openFinance}
              actionLabel="Ver financeiro"
            />
            <KpiCard
              icon={CalendarClock}
              label="Vencem esta semana"
              value={String(snapshot.dueThisWeek.value)}
              detail={moneyFromCents(snapshot.dueThisWeek.cents ?? 0)}
              onClients={openFinance}
              actionLabel="Ver financeiro"
            />
            <KpiCard
              icon={CalendarRange}
              label="Vencem próxima semana"
              value={String(snapshot.dueNextWeek.value)}
              detail={moneyFromCents(snapshot.dueNextWeek.cents ?? 0)}
              onClients={openFinance}
              actionLabel="Ver financeiro"
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
            <Card>
              <CardHeader>
                <CardTitle>Receita e clientes</CardTitle>
                <p className="text-sm text-muted-foreground">Últimos 6 meses</p>
              </CardHeader>
              <CardContent>
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                      <YAxis
                        yAxisId="revenue"
                        tickFormatter={(value: number) =>
                          value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })
                        }
                        tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                        axisLine={false}
                        tickLine={false}
                        width={72}
                      />
                      <YAxis
                        yAxisId="clients"
                        orientation="right"
                        tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                        axisLine={false}
                        tickLine={false}
                        width={36}
                      />
                      <Tooltip
                        content={({ active, payload, label }) => {
                          if (!active || !payload?.length) return null;
                          const row = payload[0]?.payload as { revenueCents?: number; activeClients?: number };
                          return (
                            <div className="rounded-md border bg-popover px-3 py-2 text-xs shadow-sm">
                              <p className="font-semibold">{label}</p>
                              <p className="mt-1">Receita: {moneyFromCents(row.revenueCents ?? 0)}</p>
                              <p>Clientes: {row.activeClients ?? 0}</p>
                            </div>
                          );
                        }}
                      />
                      <Legend />
                      <Bar yAxisId="revenue" dataKey="revenue" name="Receita" fill="#6366f1" radius={[4, 4, 0, 0]} />
                      <Line
                        yAxisId="clients"
                        type="monotone"
                        dataKey="activeClients"
                        name="Clientes"
                        stroke="#38bdf8"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Receita por situação</CardTitle>
                <p className="text-sm text-muted-foreground">Cobranças do período selecionado</p>
              </CardHeader>
              <CardContent>
                <div className="relative mx-auto h-56 w-full max-w-xs">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={paymentData} dataKey="cents" nameKey="label" innerRadius={58} outerRadius={82} paddingAngle={2}>
                        {paymentData.map((item) => (
                          <Cell key={item.key} fill={paymentColors[item.key] ?? "#94a3b8"} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number) => moneyFromCents(value)}
                        contentStyle={{ borderRadius: 8, border: "1px solid var(--border)", background: "var(--popover)" }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
                    <div>
                      <p className="font-display text-lg font-semibold">{moneyFromCents(paymentTotal)}</p>
                      <p className="text-[11px] text-muted-foreground">no período</p>
                    </div>
                  </div>
                </div>
                <div className="mt-2 space-y-2">
                  {snapshot.paymentSlices.map((item) => (
                    <div key={item.key} className="flex items-center justify-between gap-3 text-sm">
                      <span className="flex items-center gap-2">
                        <span className="size-2.5 rounded-full" style={{ background: paymentColors[item.key] }} />
                        {item.label}
                      </span>
                      <span className="text-muted-foreground">
                        {item.percent}% · {moneyFromCents(item.cents)}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Distribuição por região</CardTitle>
                <p className="text-sm text-muted-foreground">
                  {snapshot.unknownGeoClients
                    ? `${snapshot.unknownGeoClients} cliente(s) sem UF no cadastro de contratação.`
                    : "Com base no estado informado na contratação."}
                </p>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-[1fr_180px] sm:items-center">
                <BrazilRegions regions={snapshot.regions} />
                <div className="space-y-3">
                  {snapshot.regions.map((region) => (
                    <div key={region.key}>
                      <div className="mb-1 flex justify-between text-sm">
                        <span>{region.label}</span>
                        <span className="text-muted-foreground">
                          {region.clients} · {region.percent}%
                        </span>
                      </div>
                      <Progress value={region.percent} className="h-1.5" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Clientes por UF</CardTitle>
                <p className="text-sm text-muted-foreground">Top 10 estados</p>
              </CardHeader>
              <CardContent>
                {snapshot.ufs.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhuma UF disponível ainda.</p>
                ) : (
                  <div className="h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={snapshot.ufs} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--border)" />
                        <XAxis dataKey="uf" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} width={28} />
                        <Tooltip
                          formatter={(value: number) => [`${value} cliente(s)`, "Clientes"]}
                          contentStyle={{ borderRadius: 8, border: "1px solid var(--border)", background: "var(--popover)" }}
                        />
                        <Bar dataKey="clients" fill="#8b5cf6" radius={[4, 4, 0, 0]} maxBarSize={36} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
                <p className="sr-only">Máximo {maxUf}</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Top 5 clientes em receita</CardTitle>
                <p className="text-sm text-muted-foreground">No período selecionado</p>
              </CardHeader>
              <CardContent className="space-y-4">
                {snapshot.topClients.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sem cobranças neste período.</p>
                ) : (
                  snapshot.topClients.map((client, index) => (
                    <button
                      key={client.id}
                      type="button"
                      className="w-full rounded-lg border p-3 text-left transition hover:bg-muted/40"
                      onClick={() => openClient(client.id)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {index + 1}. {client.name}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">{client.percent}% da receita</p>
                        </div>
                        <strong className="text-sm">{moneyFromCents(client.revenueCents)}</strong>
                      </div>
                      <Progress value={Math.min(100, client.percent)} className="mt-3 h-1.5" />
                    </button>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Vencimentos por semana</CardTitle>
                <p className="text-sm text-muted-foreground">Próximas 4 semanas</p>
              </CardHeader>
              <CardContent>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={snapshot.dueWeeks} margin={{ top: 8, right: 8, left: 0, bottom: 24 }}>
                      <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                        axisLine={false}
                        tickLine={false}
                        interval={0}
                        angle={-20}
                        textAnchor="end"
                        height={48}
                      />
                      <YAxis
                        tickFormatter={(value: number) =>
                          value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })
                        }
                        tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                        axisLine={false}
                        tickLine={false}
                        width={64}
                      />
                      <Tooltip
                        formatter={(value: number, _name, item) => [
                          moneyFromCents(Number(item?.payload?.cents ?? value)),
                          `${item?.payload?.count ?? 0} cobrança(s)`,
                        ]}
                        contentStyle={{ borderRadius: 8, border: "1px solid var(--border)", background: "var(--popover)" }}
                      />
                      <Bar dataKey="cents" fill="#6366f1" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Clientes por status</CardTitle>
                <p className="text-sm text-muted-foreground">Carteira atual</p>
              </CardHeader>
              <CardContent>
                <div className="relative mx-auto h-56 w-full max-w-xs">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={statusData} dataKey="value" nameKey="label" innerRadius={58} outerRadius={82} paddingAngle={2}>
                        {statusData.map((item) => (
                          <Cell key={item.key} fill={statusColors[item.key] ?? "#94a3b8"} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid var(--border)", background: "var(--popover)" }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
                    <div>
                      <p className="font-display text-2xl font-semibold">{statusTotal}</p>
                      <p className="text-[11px] text-muted-foreground">clientes</p>
                    </div>
                  </div>
                </div>
                <div className="mt-2 space-y-2">
                  {snapshot.statusSlices.map((item) => (
                    <div key={item.key} className="flex items-center justify-between gap-3 text-sm">
                      <span className="flex items-center gap-2">
                        <span className="size-2.5 rounded-full" style={{ background: statusColors[item.key] }} />
                        {item.label}
                      </span>
                      <span className="text-muted-foreground">
                        {item.value} · {item.percent}%
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  detail,
  delta,
  deltaValue,
  danger,
  onClients,
  actionLabel = "Ver clientes",
}: {
  icon: typeof Users;
  label: string;
  value: string;
  detail?: string;
  delta?: string | null;
  deltaValue?: number | null;
  danger?: boolean;
  onClients: () => void;
  actionLabel?: string;
}) {
  const up = (deltaValue ?? 0) >= 0;
  return (
    <Card className={danger ? "border-destructive/40" : undefined}>
      <CardContent className="flex h-full flex-col p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <strong className={`mt-3 block font-display text-2xl sm:text-3xl ${danger ? "text-destructive" : ""}`}>{value}</strong>
            {detail ? <p className="mt-1 text-xs text-muted-foreground">{detail}</p> : null}
          </div>
          <span className={`grid size-9 place-items-center rounded-lg ${danger ? "bg-destructive/15 text-destructive" : "bg-secondary text-primary"}`}>
            <Icon className="size-4" />
          </span>
        </div>
        {delta ? (
          <p className={`mt-3 flex items-center gap-1 text-xs font-semibold ${deltaTone(deltaValue)}`}>
            {up ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
            {delta}
            <span className="font-normal text-muted-foreground">vs período anterior</span>
          </p>
        ) : (
          <p className="mt-3 text-xs text-muted-foreground">Atualizado agora</p>
        )}
        <Button variant="link" className="mt-auto h-auto justify-start px-0 pt-3 text-xs" onClick={onClients}>
          {actionLabel}
        </Button>
      </CardContent>
    </Card>
  );
}

function BrazilRegions({ regions }: { regions: MasterDashboard["regions"] }) {
  const tone = (key: string) => {
    const region = regions.find((item) => item.key === key);
    if (!region || region.clients === 0) return "#1e293b";
    return regionColors[key] ?? "#64748b";
  };
  return (
    <svg viewBox="0 0 200 220" className="mx-auto h-56 w-full max-w-xs" role="img" aria-label="Mapa de regiões do Brasil">
      <path d="M70 18 L120 10 L145 40 L130 75 L95 70 L70 45 Z" fill={tone("N")} opacity="0.9" />
      <path d="M130 75 L165 70 L175 110 L150 130 L120 115 L115 90 Z" fill={tone("NE")} opacity="0.9" />
      <path d="M95 70 L115 90 L120 115 L95 145 L70 130 L65 95 Z" fill={tone("CO")} opacity="0.9" />
      <path d="M95 145 L120 115 L150 130 L145 165 L110 180 L90 165 Z" fill={tone("SE")} opacity="0.9" />
      <path d="M70 130 L95 145 L90 165 L70 190 L45 170 L50 140 Z" fill={tone("S")} opacity="0.9" />
    </svg>
  );
}
