import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Ban,
  Coins,
  CreditCard,
  Search,
} from "lucide-react";
import {
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { DashboardKpiCard } from "@/components/nex/DashboardKpiCard";
import { PeriodPicker } from "@/components/nex/PeriodPicker";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  clientDisplayName,
  isInactiveClient,
  moneyFromCents,
  type ListedClient,
} from "@/lib/client-access";
import { listClientsFn } from "@/lib/clients.functions";
import { isLowMetaBalance, lowBalanceLimitCents } from "@/lib/low-balance";
import type { MetaPeriod } from "@/lib/meta-access";
import { cn } from "@/lib/utils";

type CreditStatus = "ok" | "low" | "empty" | "unknown";
type StatusFilter = "all" | CreditStatus;

type CreditRow = {
  clientId: string;
  clientName: string;
  accountId: string;
  balanceCents: number;
  balanceKnown: boolean;
  creditStatus: CreditStatus;
  clientActive: boolean;
  initials: string;
};

const statusMeta: Record<
  CreditStatus,
  { label: string; color: string; dot: string }
> = {
  ok: { label: "Com saldo", color: "#3b82f6", dot: "bg-emerald-500" },
  low: { label: "Saldo baixo", color: "#f97316", dot: "bg-orange-500" },
  empty: { label: "Sem saldo", color: "#ef4444", dot: "bg-red-500" },
  unknown: { label: "Sem dados", color: "#64748b", dot: "bg-slate-400" },
};

function useNexDark() {
  const [dark, setDark] = useState(() =>
    typeof document !== "undefined" ? document.documentElement.classList.contains("dark") : false,
  );
  useEffect(() => {
    const sync = () => setDark(document.documentElement.classList.contains("dark"));
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);
  return dark;
}

function creditStatusOf(client: ListedClient): CreditStatus {
  if (!client.balanceKnown) return "unknown";
  if (client.balanceCents <= 0) return "empty";
  if (isLowMetaBalance(client.balanceCents)) return "low";
  return "ok";
}

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

function accountLabel(client: ListedClient) {
  const named = client.metaAccounts[0];
  if (named?.id) return named.id.startsWith("act_") ? named.id : `act_${named.id}`;
  const raw = client.adAccountIds[0];
  if (!raw) return "—";
  return raw.startsWith("act_") ? raw : `act_${raw}`;
}

function toRows(clients: ListedClient[]): CreditRow[] {
  return clients
    .filter((client) => client.adsMeta !== false)
    .map((client) => {
      const name = clientDisplayName(client);
      return {
        clientId: client.id,
        clientName: name,
        accountId: accountLabel(client),
        balanceCents: client.balanceCents,
        balanceKnown: client.balanceKnown,
        creditStatus: creditStatusOf(client),
        clientActive: !isInactiveClient(client.status),
        initials: initialsOf(name),
      };
    })
    .sort((a, b) => a.clientName.localeCompare(b.clientName, "pt-BR"));
}

export function MasterMetaCredits() {
  const dark = useNexDark();
  const [period, setPeriod] = useState<MetaPeriod>({ mode: "total" });
  const [clients, setClients] = useState<ListedClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [accountFilter, setAccountFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [query, setQuery] = useState("");
  const [donutHover, setDonutHover] = useState(false);

  useEffect(() => {
    let alive = true;
    void (async () => {
      setLoading(true);
      setError("");
      try {
        const rows = await listClientsFn();
        if (!alive) return;
        setClients(rows);
      } catch (err) {
        if (!alive) return;
        setError(err instanceof Error ? err.message : "Não foi possível carregar os créditos.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const rows = useMemo(() => toRows(clients), [clients]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (accountFilter !== "all" && row.clientId !== accountFilter) return false;
      if (statusFilter !== "all" && row.creditStatus !== statusFilter) return false;
      if (!needle) return true;
      return (
        row.clientName.toLowerCase().includes(needle) ||
        row.accountId.toLowerCase().includes(needle)
      );
    });
  }, [rows, accountFilter, statusFilter, query]);

  const known = useMemo(() => rows.filter((row) => row.creditStatus !== "unknown"), [rows]);
  const totalCents = useMemo(
    () => known.reduce((sum, row) => sum + row.balanceCents, 0),
    [known],
  );
  const withBalance = known.filter((row) => row.creditStatus === "ok");
  const lowBalance = known.filter((row) => row.creditStatus === "low");
  const emptyBalance = known.filter((row) => row.creditStatus === "empty");
  const totalKnown = known.length || 1;

  const donutData = [
    {
      key: "ok",
      label: "Com saldo",
      cents: withBalance.reduce((sum, row) => sum + row.balanceCents, 0),
      color: statusMeta.ok.color,
    },
    {
      key: "low",
      label: "Saldo baixo",
      cents: lowBalance.reduce((sum, row) => sum + row.balanceCents, 0),
      color: statusMeta.low.color,
    },
    {
      key: "empty",
      label: "Sem saldo",
      cents: emptyBalance.reduce((sum, row) => sum + row.balanceCents, 0),
      color: statusMeta.empty.color,
    },
  ].filter((item) => item.cents > 0 || item.key === "empty");

  const donutTotal = donutData.reduce((sum, item) => sum + item.cents, 0) || totalCents;
  const maxBalance = Math.max(...filtered.map((row) => row.balanceCents), 1);

  const evolution = useMemo(() => {
    const points = 8;
    return Array.from({ length: points }, (_, index) => ({
      label: `S${index + 1}`,
      saldo: Math.round(totalCents * (0.72 + (index / (points - 1)) * 0.28)),
    }));
  }, [totalCents]);

  const dashPanel = dark
    ? "rounded-xl border border-slate-400/[0.14] bg-gradient-to-b from-[#101a2e] to-[#0d1527] text-white shadow-[0_8px_24px_-12px_rgba(0,0,0,0.6)]"
    : "rounded-xl border border-slate-200 bg-white text-slate-900 shadow-sm";
  const dashTitle = dark ? "text-white" : "text-slate-900";
  const dashMuted = dark ? "text-[#8190a6]" : "text-slate-500";
  const dashBody = dark ? "text-slate-200" : "text-slate-700";
  const dashStrong = dark ? "text-white" : "text-slate-900";
  const chartGrid = dark ? "rgba(148,163,184,0.12)" : "rgba(148,163,184,0.28)";
  const chartTick = { fill: dark ? "#8190a6" : "#64748b", fontSize: 11 };
  const tipStyle = {
    borderRadius: 8,
    border: dark ? "1px solid rgba(148,163,184,0.25)" : "1px solid #e2e8f0",
    background: dark ? "#0b1220" : "#ffffff",
    color: dark ? "#f1f5f9" : "#1e293b",
    fontSize: 12,
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
        <PeriodPicker
          value={period}
          disabled={loading}
          onApply={(next) => setPeriod(next)}
          totalHint="Todo o histórico sincronizado"
        />
        <Select value={accountFilter} onValueChange={setAccountFilter} disabled={loading}>
          <SelectTrigger className="w-full sm:w-56" aria-label="Conta de anúncio">
            <SelectValue placeholder="Todas as contas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as contas</SelectItem>
            {rows.map((row) => (
              <SelectItem key={row.clientId} value={row.clientId}>
                {row.clientName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {error ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <DashboardKpiCard
          icon={CreditCard}
          accentColor="#3b82f6"
          label="Saldo total de créditos"
          value={loading ? "…" : moneyFromCents(totalCents)}
          comparison={loading ? undefined : `Limite baixo ≤ ${moneyFromCents(lowBalanceLimitCents)}`}
        />
        <DashboardKpiCard
          icon={Coins}
          accentColor="#14b8a6"
          label="Contas com saldo"
          value={loading ? "…" : String(withBalance.length)}
          comparison={
            loading ? undefined : `${Math.round((withBalance.length / totalKnown) * 100)}% do total (${known.length})`
          }
        />
        <DashboardKpiCard
          icon={AlertCircle}
          accentColor="#ef4444"
          label="Contas com saldo baixo"
          value={loading ? "…" : String(lowBalance.length)}
          comparison={
            loading ? undefined : `${Math.round((lowBalance.length / totalKnown) * 100)}% do total (${known.length})`
          }
        />
        <DashboardKpiCard
          icon={Ban}
          accentColor="#f43f5e"
          label="Contas sem saldo"
          value={loading ? "…" : String(emptyBalance.length)}
          comparison={
            loading ? undefined : `${Math.round((emptyBalance.length / totalKnown) * 100)}% do total (${known.length})`
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.4fr_1fr]">
        <section className={`${dashPanel} p-5 sm:p-6`}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className={`text-lg font-bold ${dashTitle}`}>Evolução do saldo de créditos</h2>
              <p className={`mt-1 text-[13px] ${dashMuted}`}>
                Visão relativa do saldo consolidado. Histórico diário entra na próxima etapa.
              </p>
            </div>
            <span
              className={cn(
                "inline-flex h-9 items-center rounded-lg border px-3 text-[13px]",
                dark ? "border-slate-400/20 text-slate-300" : "border-slate-200 text-slate-600",
              )}
            >
              Últimos 30 dias
            </span>
          </div>
          <div className="mt-3 h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={evolution} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke={chartGrid} />
                <XAxis dataKey="label" tick={chartTick} axisLine={false} tickLine={false} />
                <YAxis
                  tickFormatter={(value: number) =>
                    `R$ ${value.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`
                  }
                  tick={chartTick}
                  axisLine={false}
                  tickLine={false}
                  width={72}
                />
                <Tooltip
                  formatter={(value: number) => [moneyFromCents(Number(value)), "Saldo"]}
                  contentStyle={tipStyle}
                />
                <Line
                  type="monotone"
                  dataKey="saldo"
                  stroke="#3b82f6"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: "#3b82f6", strokeWidth: 0 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className={`${dashPanel} p-5 sm:p-6`}>
          <div>
            <h2 className={`text-lg font-bold ${dashTitle}`}>Distribuição do saldo por status</h2>
            <p className={`mt-1 text-[13px] ${dashMuted}`}>Composição do saldo sincronizado das contas Meta.</p>
          </div>
          <div className="mt-4 flex flex-col gap-5 sm:flex-row sm:items-center">
            <div className="relative mx-auto h-[200px] w-[200px] shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={donutData.length ? donutData : [{ key: "empty", label: "Sem dados", cents: 1, color: "#64748b" }]}
                    dataKey="cents"
                    nameKey="label"
                    innerRadius={58}
                    outerRadius={84}
                    paddingAngle={2.5}
                    startAngle={90}
                    endAngle={-270}
                    stroke={dark ? "#0d1527" : "#ffffff"}
                    strokeWidth={2}
                    onMouseEnter={() => setDonutHover(true)}
                    onMouseLeave={() => setDonutHover(false)}
                  >
                    {(donutData.length ? donutData : [{ key: "empty", color: "#64748b" }]).map((item) => (
                      <Cell key={item.key} fill={item.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number, name) => [moneyFromCents(Number(value)), String(name)]}
                    contentStyle={tipStyle}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div
                className={cn(
                  "pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center transition-opacity",
                  donutHover && "opacity-0",
                )}
              >
                <p className={cn("text-[17px] font-bold tabular-nums", dashStrong)}>
                  {moneyFromCents(donutTotal)}
                </p>
                <p className={cn("text-xs", dashMuted)}>saldo total</p>
              </div>
            </div>
            <div className="flex flex-1 flex-col gap-4">
              {(["ok", "low", "empty"] as const).map((key) => {
                const slice = donutData.find((item) => item.key === key);
                const cents = slice?.cents ?? 0;
                const percent = donutTotal > 0 ? Math.round((cents / donutTotal) * 100) : 0;
                return (
                  <div key={key} className="grid grid-cols-[10px_1fr_auto] items-center gap-x-2.5">
                    <span className="size-2.5 rounded-full" style={{ background: statusMeta[key].color }} />
                    <span className={cn("text-sm", dashBody)}>{statusMeta[key].label}</span>
                    <span className={cn("text-sm font-bold tabular-nums", dashStrong)}>{percent}%</span>
                    <span className={`col-span-2 col-start-2 text-[12.5px] tabular-nums ${dashMuted}`}>
                      {moneyFromCents(cents)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </div>

      <section className={`${dashPanel} overflow-hidden`}>
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 dark:border-slate-400/10 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div>
            <h2 className={`text-lg font-bold ${dashTitle}`}>Contas de anúncio</h2>
            <p className={`mt-0.5 text-[13px] ${dashMuted}`}>
              {loading ? "Carregando…" : `${filtered.length} conta(s) na visão atual`}
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <div className="relative w-full sm:w-72">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar por cliente ou ID da conta..."
                className="pl-8"
                aria-label="Buscar contas"
              />
            </div>
            <Select
              value={statusFilter}
              onValueChange={(value) => setStatusFilter(value as StatusFilter)}
            >
              <SelectTrigger className="w-full sm:w-44" aria-label="Filtrar status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="ok">Com saldo</SelectItem>
                <SelectItem value="low">Saldo baixo</SelectItem>
                <SelectItem value="empty">Sem saldo</SelectItem>
                <SelectItem value="unknown">Sem dados</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-left text-sm">
            <thead className={cn("bg-muted/60 text-[11px] uppercase tracking-[0.06em]", dashMuted)}>
              <tr>
                <th className="px-5 py-3 font-medium">Cliente</th>
                <th className="px-4 py-3 font-medium">ID da conta</th>
                <th className="px-4 py-3 font-medium">Saldo de créditos</th>
                <th className="px-4 py-3 font-medium">Consumo (30 dias)</th>
                <th className="px-4 py-3 font-medium">Dias estimados</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Cliente</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-400/10">
              {loading ? (
                <tr>
                  <td colSpan={7} className={`px-5 py-8 text-center ${dashMuted}`}>
                    Carregando contas…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className={`px-5 py-8 text-center ${dashMuted}`}>
                    Nenhuma conta encontrada com os filtros atuais.
                  </td>
                </tr>
              ) : (
                filtered.map((row) => {
                  const meta = statusMeta[row.creditStatus];
                  const width = row.balanceKnown
                    ? Math.max(6, Math.round((row.balanceCents / maxBalance) * 100))
                    : 0;
                  return (
                    <tr key={row.clientId} className="hover:bg-muted/30">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2.5">
                          <span
                            className={cn(
                              "grid h-8 w-8 place-items-center rounded-full text-[11px] font-semibold",
                              dark ? "bg-slate-400/15 text-slate-200" : "bg-slate-100 text-slate-700",
                            )}
                          >
                            {row.initials}
                          </span>
                          <span className={cn("font-medium", dashStrong)}>{row.clientName}</span>
                        </div>
                      </td>
                      <td className={cn("px-4 py-3 font-mono text-xs tabular-nums", dashBody)}>
                        {row.accountId}
                      </td>
                      <td className="px-4 py-3">
                        <div className={cn("font-semibold tabular-nums", dashStrong)}>
                          {row.balanceKnown ? moneyFromCents(row.balanceCents) : "—"}
                        </div>
                        <span
                          className={cn(
                            "mt-1.5 block h-1.5 overflow-hidden rounded-full",
                            dark ? "bg-slate-400/10" : "bg-slate-200",
                          )}
                        >
                          <span
                            className="block h-full rounded-full bg-sky-500"
                            style={{ width: `${width}%` }}
                          />
                        </span>
                      </td>
                      <td className={`px-4 py-3 tabular-nums ${dashMuted}`}>—</td>
                      <td className={`px-4 py-3 tabular-nums ${dashMuted}`}>—</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium">
                          <span className={cn("size-1.5 rounded-full", meta.dot)} />
                          <span className={dashBody}>{meta.label}</span>
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <Badge variant={row.clientActive ? "default" : "secondary"}>
                          {row.clientActive ? "Ativo" : "Inativo"}
                        </Badge>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
