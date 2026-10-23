import { useEffect, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { readGoogleAdsCampaignsFn } from "@/lib/google-ads.functions";
import {
  adsLoadFailure,
  fillAccountDays,
  googleAdsDayValue,
  googleAdsMetricTotal,
  saoPauloDate,
  selectGoogleAdsMetric,
  type GoogleAdsDay,
  type GoogleAdsMetric,
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

export function GoogleAdsOverview() {
  const [days, setDays] = useState<GoogleAdsDay[]>([]);
  const [accountName, setAccountName] = useState("");
  const [currency, setCurrency] = useState("BRL");
  const [linked, setLinked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<GoogleAdsMetric[]>(["clicks"]);

  useEffect(() => {
    let active = true;
    void readGoogleAdsCampaignsFn({ data: {} })
      .then((result) => {
        if (!active) return;
        if (!result.ok) {
          setError(result.message);
          setDays(fillAccountDays([], saoPauloDate()));
          return;
        }
        setLinked(result.data.linked);
        setAccountName(result.data.account?.name ?? "");
        setCurrency(result.data.account?.currency || "BRL");
        setDays(fillAccountDays(result.data.days ?? [], saoPauloDate()));
      })
      .catch((failure) => {
        if (active) {
          setError(adsLoadFailure(failure));
          setDays(fillAccountDays([], saoPauloDate()));
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const chart = days.map((day) => {
    const row: Record<string, string | number> = { label: day.date.slice(8) };
    for (const metric of selected) row[metric] = googleAdsDayValue(day, metric);
    return row;
  });

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-card px-4 py-3">
        <p className="text-xs font-medium text-muted-foreground">Conta de anúncios</p>
        <p className="mt-1 font-semibold">{linked ? accountName : "Conta Google Ads não vinculada"}</p>
        {!linked && (
          <p className="mt-1 text-sm text-muted-foreground">Os indicadores entram quando o Master vincular a conta. A Meta continua na outra opção.</p>
        )}
      </div>
      {error ? <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{error}</p> : null}
      {loading ? (
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
