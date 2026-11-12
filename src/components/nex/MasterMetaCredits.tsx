import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Ban,
  Check,
  Coins,
  Copy,
  CreditCard,
  RefreshCw,
  Search,
} from "lucide-react";
import { DashboardKpiCard } from "@/components/nex/DashboardKpiCard";
import { PeriodPicker } from "@/components/nex/PeriodPicker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { refreshMasterMetaCreditsFn } from "@/lib/meta-credit.functions";
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
  const named = client.metaAccounts?.[0]?.id?.trim();
  if (named) return named.replace(/^act_/i, "");
  const raw = client.adAccountIds?.[0]?.trim();
  if (!raw) return "";
  return raw.replace(/^act_/i, "");
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
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [accountFilter, setAccountFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [query, setQuery] = useState("");
  const [copiedId, setCopiedId] = useState("");

  const loadClients = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await listClientsFn();
      if (!result.ok) {
        setError(result.message);
        setClients([]);
        return;
      }
      setClients(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível carregar os créditos.");
      setClients([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadClients();
  }, [loadClients]);

  async function refreshBalances() {
    if (refreshing) return;
    setRefreshing(true);
    setError("");
    setNotice("");
    try {
      const result = await refreshMasterMetaCreditsFn();
      if (!result.ok) {
        setError(result.message);
        return;
      }
      await loadClients();
      const { synced, skipped, failed, total } = result.data;
      if (failed > 0) {
        setNotice(
          `Atualização parcial: ${synced} conta(s) sincronizada(s), ${failed} falha(s), ${skipped} sem recarga registrada (${total} no total).`,
        );
      } else {
        setNotice(
          `Saldos atualizados: ${synced} conta(s) sincronizada(s)${skipped ? `, ${skipped} sem recarga registrada` : ""}.`,
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível atualizar os saldos.");
    } finally {
      setRefreshing(false);
    }
  }

  const rows = useMemo(() => toRows(Array.isArray(clients) ? clients : []), [clients]);

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
  const maxBalance = Math.max(...filtered.map((row) => row.balanceCents), 1);

  const dashPanel = dark
    ? "rounded-xl border border-slate-400/[0.14] bg-gradient-to-b from-[#101a2e] to-[#0d1527] text-white shadow-[0_8px_24px_-12px_rgba(0,0,0,0.6)]"
    : "rounded-xl border border-slate-200 bg-white text-slate-900 shadow-sm";
  const dashTitle = dark ? "text-white" : "text-slate-900";
  const dashMuted = dark ? "text-[#8190a6]" : "text-slate-500";
  const dashBody = dark ? "text-slate-200" : "text-slate-700";
  const dashStrong = dark ? "text-white" : "text-slate-900";

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
        <PeriodPicker
          value={period}
          disabled={loading || refreshing}
          onApply={(next) => setPeriod(next)}
          totalHint="Todo o histórico sincronizado"
        />
        <Select value={accountFilter} onValueChange={setAccountFilter} disabled={loading || refreshing}>
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
        <Button
          type="button"
          variant="outline"
          disabled={loading || refreshing}
          onClick={() => void refreshBalances()}
        >
          <RefreshCw className={cn("size-4", refreshing ? "animate-spin" : "")} />
          {refreshing ? "Atualizando" : "Atualizar"}
        </Button>
      </div>

      {error ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
          {notice}
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
                      <td className="px-4 py-3">
                        {row.accountId ? (
                          <div className="flex items-center gap-1">
                            <span className={cn("font-mono text-xs tabular-nums", dashBody)}>
                              {row.accountId}
                            </span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
                              aria-label={`Copiar ID ${row.accountId}`}
                              onClick={() => {
                                void navigator.clipboard.writeText(row.accountId).then(() => {
                                  setCopiedId(row.accountId);
                                  window.setTimeout(() => setCopiedId(""), 1500);
                                });
                              }}
                            >
                              {copiedId === row.accountId ? (
                                <Check className="h-3.5 w-3.5 text-emerald-500" />
                              ) : (
                                <Copy className="h-3.5 w-3.5" />
                              )}
                            </Button>
                          </div>
                        ) : (
                          <span className={dashMuted}>—</span>
                        )}
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
