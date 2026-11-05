import { formatComparisonBadge, formatMetricValue } from "@/lib/nex-intelligence/dashboard/format";
import type { DashboardMetric, MetricComparison } from "@/lib/nex-intelligence/dashboard/types";
import { ni } from "@/components/nex/intelligence/intelligence-theme";

type Props = {
  metric: DashboardMetric;
  comparison?: MetricComparison;
  currency?: string;
  referenceLabel?: string;
};

export function MetricCard({
  metric,
  comparison,
  currency = "BRL",
  referenceLabel = "vs. dia anterior",
}: Props) {
  const badge = formatComparisonBadge(comparison);
  return (
    <div className={`${ni.card} p-4`}>
      <p className={ni.label}>{metric.label}</p>
      <div className="mt-2 flex items-end justify-between gap-2">
        <p className={ni.value}>{formatMetricValue(metric, currency)}</p>
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
      {badge ? <p className={`mt-2 ${ni.muted}`}>{referenceLabel}</p> : null}
      {metric.quality === "UNAVAILABLE" ? (
        <p className={`mt-2 ${ni.muted}`}>Indisponível</p>
      ) : metric.quality === "NOT_VERIFIABLE" ? (
        <p className={`mt-2 ${ni.muted}`}>Não verificável</p>
      ) : null}
    </div>
  );
}
