import { Link } from "@tanstack/react-router";
import { RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { MetaCampaignRow, MetaDatePreset, MetaPerformanceView } from "@/lib/meta-access";
import { getMetaPerformanceFn } from "@/lib/meta.functions";

const periods: { value: MetaDatePreset; label: string }[] = [
  { value: "today", label: "Hoje" },
  { value: "yesterday", label: "Ontem" },
  { value: "last_7d", label: "Últimos 7 dias" },
  { value: "last_30d", label: "Últimos 30 dias" },
  { value: "this_month", label: "Este mês" },
];

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

export function MetaPerformance({ mode }: { mode: "overview" | "campaigns" }) {
  const [preset, setPreset] = useState<MetaDatePreset>("last_30d");
  const [view, setView] = useState<MetaPerformanceView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const organizationId = readOrg();

  const load = async (nextPreset: MetaDatePreset) => {
    setLoading(true);
    setError("");
    const data: { organizationId?: string; datePreset?: string } = { datePreset: nextPreset };
    if (organizationId) data.organizationId = organizationId;
    try {
      const result = await getMetaPerformanceFn({ data });
      setLoading(false);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setView(result.data);
    } catch {
      setLoading(false);
      setError("Não foi possível carregar os indicadores da Meta.");
    }
  };

  useEffect(() => {
    void load("last_30d");
  }, []);

  const campaigns = useMemo(() => {
    const rows = view?.campaigns ?? [];
    return rows.filter((row) => {
      const matchesQuery = row.name.toLowerCase().includes(query.trim().toLowerCase());
      const matchesStatus = status === "all" || row.statusGroup === status;
      return matchesQuery && matchesStatus;
    });
  }, [view, query, status]);

  const ready = Boolean(view?.kpis && view.accountId);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 rounded-lg border bg-card p-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <p className="text-xs font-medium text-muted-foreground">Conta de anúncios</p>
          <p className="mt-1 text-sm font-semibold">
            {view?.accountName ? `${view.accountName}${view.accountId ? ` · ${view.accountId}` : ""}` : "Conta de anúncio não vinculada"}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Select
            value={preset}
            onValueChange={(value) => {
              const next = value as MetaDatePreset;
              setPreset(next);
              void load(next);
            }}
          >
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {periods.map((period) => (
                <SelectItem key={period.value} value={period.value}>
                  {period.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="button" onClick={() => void load(preset)} disabled={loading}>
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
          <p className="text-sm text-muted-foreground">
            Leitura das campanhas na Meta. O NEX não cria, pausa nem altera anúncios.
          </p>
          {mode === "overview" && (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <Kpi label="Alcance" value={integer(view.kpis.reach)} />
              <Kpi label="Impressões" value={integer(view.kpis.impressions)} />
              <Kpi label="Resultados" value={integer(view.kpis.results)} hint={view.kpis.resultLabel} />
              <Kpi label="Gasto" value={money(view.kpis.spend, view.currency)} />
              <Kpi label="CPC" value={view.kpis.cpc == null ? "—" : money(view.kpis.cpc, view.currency)} />
              <Kpi label="CTR" value={percent(view.kpis.ctr)} />
            </div>
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
          <CampaignTable rows={mode === "campaigns" ? campaigns : view.campaigns} currency={view.currency} />
          {view.campaigns.length === 0 && (
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
