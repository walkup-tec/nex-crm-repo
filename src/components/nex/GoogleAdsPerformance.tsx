import { RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PeriodPicker } from "@/components/nex/PeriodPicker";
import { Button } from "@/components/ui/button";
import { readDashboardSnapshot, retryDroppedDashboard, writeDashboardSnapshot, type DashboardStorage } from "@/lib/dashboard-cache";
import { readGoogleAdsCampaignsFn } from "@/lib/google-ads.functions";
import {
  adsLoadFailure,
  googleAdsDayValue,
  googleAdsMetricTotal,
  selectGoogleAdsMetric,
  type GoogleAdsDay,
  type GoogleAdsMetric,
  type GoogleAdsPeriod,
} from "@/lib/google-ads";

const metrics: { id: GoogleAdsMetric; label: string; money: boolean; color: string }[] = [
  { id: "clicks", label: "Cliques", money: false, color: "var(--primary)" },
  { id: "impressions", label: "Impressões", money: false, color: "var(--cyan)" },
  { id: "cpc", label: "CPC méd.", money: true, color: "var(--warning)" },
  { id: "cost", label: "Custo", money: true, color: "var(--success)" },
];

function money(value: number, currency: string) {
  try {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(value);
  } catch {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  }
}

function integer(value: number) {
  return new Intl.NumberFormat("pt-BR").format(value);
}

function formatMetric(metric: GoogleAdsMetric, value: number, currency: string) {
  return metrics.find((item) => item.id === metric)?.money ? money(value, currency) : integer(value);
}

function axisLabel(iso: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return iso;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(".", "");
}

const initialPeriod: GoogleAdsPeriod = { mode: "total" };
const googleCacheKey = "nex.dashboard.google";

type GoogleSnapshot = {
  period: GoogleAdsPeriod;
  days: GoogleAdsDay[];
  accountName: string;
  currency: string;
  linked: boolean;
};

function browserStorage(): DashboardStorage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function isGoogleSnapshot(value: unknown): value is GoogleSnapshot {
  if (!value || typeof value !== "object") return false;
  const row = value as Partial<GoogleSnapshot>;
  return (row.period?.mode === "total" || row.period?.mode === "custom") && Array.isArray(row.days) && typeof row.linked === "boolean";
}

function storedGoogle() {
  return readDashboardSnapshot(browserStorage(), googleCacheKey, isGoogleSnapshot);
}

export function GoogleAdsOverview() {
  const cached = storedGoogle();
  const [days, setDays] = useState<GoogleAdsDay[]>(cached?.days ?? []);
  const [period, setPeriod] = useState<GoogleAdsPeriod>(cached?.period ?? initialPeriod);
  const [accountName, setAccountName] = useState(cached?.accountName ?? "");
  const [currency, setCurrency] = useState(cached?.currency || "BRL");
  const [linked, setLinked] = useState(cached?.linked ?? false);
  const [seen, setSeen] = useState(Boolean(cached));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<GoogleAdsMetric[]>(["clicks"]);

  const load = async (nextPeriod: GoogleAdsPeriod) => {
    setLoading(true);
    setError("");
    const data: { period: string; since?: string; until?: string } = { period: nextPeriod.mode };
    if (nextPeriod.mode === "custom") {
      data.since = nextPeriod.since;
      data.until = nextPeriod.until;
    }
    try {
      const result = await retryDroppedDashboard(() => readGoogleAdsCampaignsFn({ data }));
      if (!result.ok) {
        setError(result.message);
        return;
      }
      const snapshot: GoogleSnapshot = {
        period: result.data.period ?? nextPeriod,
        days: result.data.days ?? [],
        accountName: result.data.account?.name ?? "",
        currency: result.data.account?.currency || "BRL",
        linked: result.data.linked,
      };
      setPeriod(snapshot.period);
      setLinked(snapshot.linked);
      setAccountName(snapshot.accountName);
      setCurrency(snapshot.currency);
      setDays(snapshot.days);
      setSeen(true);
      writeDashboardSnapshot(browserStorage(), googleCacheKey, snapshot);
    } catch (failure) {
      setError(seen ? "A conexão caiu. Os indicadores na tela são a última leitura." : adsLoadFailure(failure));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load(period);
  }, []);

  const chart = days.map((day) => {
    const row: Record<string, string | number> = { label: axisLabel(day.date) };
    for (const metric of selected) row[metric] = googleAdsDayValue(day, metric);
    return row;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-lg border bg-card p-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <p className="text-xs font-medium text-muted-foreground">Conta de anúncios</p>
          <p className="mt-1 text-sm font-semibold">
            {seen ? (linked ? accountName : "Conta Google Ads não vinculada") : "Lendo a conta do Google Ads"}
          </p>
          {seen && !linked && (
            <p className="mt-1 text-sm text-muted-foreground">Os indicadores entram quando o Master vincular a conta. A Meta continua na outra opção.</p>
          )}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
          <PeriodPicker value={period} disabled={loading} onApply={(next) => void load(next)} />
          <Button type="button" onClick={() => void load(period)} disabled={loading}>
            <RefreshCw className={loading ? "animate-spin" : ""} />
            {loading ? "Atualizando" : "Atualizar dados"}
          </Button>
        </div>
      </div>
      {error ? <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{error}</p> : null}
      {loading && !seen ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {metrics.map((metric) => (
            <div key={metric.id} className="h-24 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" role="group" aria-label="Indicadores do Google Ads">
          {metrics.map((metric) => {
            const active = selected.includes(metric.id);
            return (
              <button
                key={metric.id}
                type="button"
                aria-pressed={active}
                onClick={() => setSelected((current) => selectGoogleAdsMetric(current, metric.id))}
                className="rounded-lg border bg-card px-4 py-3 text-left"
                style={active ? { borderTopColor: metric.color, borderTopWidth: 3 } : undefined}
              >
                <span className="text-xs font-medium text-muted-foreground">{metric.label}</span>
                <span className="mt-2 block text-2xl font-semibold tabular-nums" style={active ? { color: metric.color } : undefined}>
                  {formatMetric(metric.id, googleAdsMetricTotal(days, metric.id), currency)}
                </span>
              </button>
            );
          })}
        </div>
      )}
      <section className="rounded-lg border bg-card p-4">
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} minTickGap={16} />
              {selected.map((metric, index) => (
                <YAxis
                  key={metric}
                  yAxisId={metric}
                  orientation={index === 0 ? "left" : "right"}
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                  width={56}
                  tickFormatter={(value: number) => formatMetric(metric, value, currency)}
                />
              ))}
              <Tooltip
                contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--foreground)" }}
                formatter={(value, name) => {
                  const metric = metrics.find((item) => item.id === name);
                  const amount = typeof value === "number" ? value : Number(value);
                  return [formatMetric(metric?.id ?? "clicks", Number.isFinite(amount) ? amount : 0, currency), metric?.label ?? String(name)];
                }}
              />
              {selected.map((metric) => (
                <Line
                  key={metric}
                  yAxisId={metric}
                  type="monotone"
                  dataKey={metric}
                  name={metric}
                  stroke={metrics.find((item) => item.id === metric)?.color}
                  strokeWidth={2}
                  dot={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}
