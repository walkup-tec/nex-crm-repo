import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatComparisonBadge, formatMetricValue } from "@/lib/nex-intelligence/dashboard/format";
import type { MetricComparison, MetricKey } from "@/lib/nex-intelligence/dashboard/types";
import { ni } from "@/components/nex/intelligence/intelligence-theme";

type Props = {
  comparisons: MetricComparison[];
  keys?: MetricKey[];
  currency?: string;
};

const DEFAULT_KEYS: MetricKey[] = ["results", "clicks", "cpc", "cost_per_result"];

export function ComparisonBars({
  comparisons,
  keys = DEFAULT_KEYS,
  currency = "BRL",
}: Props) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {keys.map((key) => {
        const comparison = comparisons.find((row) => row.metricKey === key);
        const label = comparison?.after?.label ?? comparison?.before?.label ?? key;
        const badge = formatComparisonBadge(comparison);
        const data = [
          {
            name: "Antes",
            value: comparison?.before?.value ?? null,
            fill: "#1a3358",
          },
          {
            name: "Depois",
            value: comparison?.after?.value ?? null,
            fill: "#1d6feb",
          },
        ];
        return (
          <div key={key} className={`${ni.card} p-4`}>
            <div className="mb-2 flex items-start justify-between gap-2">
              <p className={ni.label}>{label}</p>
              {badge ? (
                <span
                  className={
                    badge.tone === "positive"
                      ? ni.badgePos
                      : badge.tone === "negative"
                        ? ni.badgeNeg
                        : ni.badgeNeu
                  }
                >
                  {badge.text}
                </span>
              ) : null}
            </div>
            {comparison?.comparisonStatus !== "VALID" ? (
              <p className={ni.muted}>
                {comparison?.comparisonStatus === "INSUFFICIENT"
                  ? "Dados insuficientes"
                  : comparison?.comparisonStatus === "INCOMPARABLE"
                    ? "Comparação inválida"
                    : "Sem comparação equivalente"}
              </p>
            ) : (
              <>
                <div className="h-36">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data}>
                      <XAxis dataKey="name" tick={{ fill: "#8fa3bf", fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis hide />
                      <Tooltip
                        contentStyle={{
                          background: "#0b1729",
                          border: "1px solid #1e3a5f",
                          borderRadius: 8,
                        }}
                        formatter={(value: number | string) => [
                          typeof value === "number"
                            ? formatMetricValue(
                                {
                                  value,
                                  unit: comparison.after?.unit ?? comparison.before?.unit ?? "other",
                                },
                                currency,
                              )
                            : "—",
                          label,
                        ]}
                      />
                      <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                        {data.map((entry) => (
                          <Cell key={entry.name} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <p className={`mt-2 text-xs ${ni.muted}`}>
                  {formatMetricValue(
                    { value: comparison.before?.value ?? null, unit: comparison.before?.unit ?? "other" },
                    currency,
                  )}{" "}
                  vs{" "}
                  {formatMetricValue(
                    { value: comparison.after?.value ?? null, unit: comparison.after?.unit ?? "other" },
                    currency,
                  )}
                </p>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
