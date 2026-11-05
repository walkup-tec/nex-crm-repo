import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatShortDate } from "@/lib/nex-intelligence/dashboard/format";
import type { DailySeriesPoint, OptimizationMarker } from "@/lib/nex-intelligence/dashboard/types";
import { ni } from "@/components/nex/intelligence/intelligence-theme";

type Props = {
  title: string;
  subtitle?: string;
  series: DailySeriesPoint[];
  metricKey?: keyof DailySeriesPoint;
  markers?: OptimizationMarker[];
  beforeLabel?: string;
  afterLabel?: string;
};

export function PerformanceChart({
  title,
  subtitle,
  series,
  metricKey = "results",
  markers = [],
  beforeLabel = "Antes da otimização",
  afterLabel = "Depois da otimização",
}: Props) {
  const data = series.map((point) => ({
    date: point.date,
    label: formatShortDate(point.date),
    value: typeof point[metricKey] === "number" ? point[metricKey] : null,
  }));

  const markerDate = markers[0]?.effectiveAt?.slice(0, 10) ?? null;

  return (
    <div className={`${ni.card} p-4`}>
      <div className="mb-3">
        <h3 className={ni.title}>{title}</h3>
        {subtitle ? <p className={`mt-1 ${ni.muted}`}>{subtitle}</p> : null}
      </div>
      {data.length === 0 ? (
        <p className={ni.muted}>Sem série diária verificável para o período.</p>
      ) : (
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 12, right: 12, left: 0, bottom: 8 }}>
              <CartesianGrid stroke="#1a2d4a" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: "#8fa3bf", fontSize: 11 }}
                axisLine={{ stroke: "#1e3a5f" }}
                tickLine={false}
              />
              <YAxis hide domain={["auto", "auto"]} />
              <Tooltip
                contentStyle={{
                  background: "#0b1729",
                  border: "1px solid #1e3a5f",
                  borderRadius: 8,
                  color: "#f4f7fb",
                }}
                formatter={(value: number | string) => [
                  typeof value === "number"
                    ? value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })
                    : String(value),
                  title,
                ]}
              />
              {markerDate ? (
                <ReferenceLine
                  x={formatShortDate(markerDate)}
                  stroke="#dbe7f8"
                  strokeDasharray="4 4"
                  label={{
                    value: beforeLabel,
                    position: "insideTopLeft",
                    fill: "#8fa3bf",
                    fontSize: 10,
                  }}
                />
              ) : null}
              <Line
                type="monotone"
                dataKey="value"
                stroke="#3ecbff"
                strokeWidth={2}
                dot={{ r: 3, fill: "#3ecbff", strokeWidth: 0 }}
                connectNulls={false}
              />
            </LineChart>
          </ResponsiveContainer>
          {markerDate ? (
            <p className={`mt-2 text-center text-xs text-[#8fa3bf]`}>
              {beforeLabel} · {afterLabel} · marco em {formatShortDate(markerDate)}
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
