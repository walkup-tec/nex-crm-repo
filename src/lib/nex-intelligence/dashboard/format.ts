import type {
  DashboardMetric,
  MetricComparison,
} from "@/lib/nex-intelligence/dashboard/types";

export function formatMetricValue(
  metric: Pick<DashboardMetric, "value" | "unit">,
  currency = "BRL",
): string {
  if (metric.value == null) return "—";
  if (metric.unit === "currency") {
    return metric.value.toLocaleString("pt-BR", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
  if (metric.unit === "ratio_pct") {
    return `${metric.value.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}%`;
  }
  if (metric.unit === "count") {
    return metric.value.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
  }
  return metric.value.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}

export function formatComparisonBadge(comparison: MetricComparison | undefined): {
  text: string;
  tone: "positive" | "negative" | "neutral";
} | null {
  if (!comparison || comparison.comparisonStatus !== "VALID") return null;
  if (comparison.assessment === "NOT_ASSESSED" || comparison.assessment === "INCONCLUSIVE") {
    return null;
  }

  const tone =
    comparison.assessment === "IMPROVED"
      ? "positive"
      : comparison.assessment === "WORSENED"
        ? "negative"
        : "neutral";

  if (comparison.metricKey === "ctr" && comparison.pointsDelta != null) {
    const sign = comparison.pointsDelta > 0 ? "+" : "";
    return {
      text: `${sign}${comparison.pointsDelta.toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })} p.p.`,
      tone,
    };
  }

  if (comparison.relativeDeltaPercent == null) return null;
  const sign = comparison.relativeDeltaPercent > 0 ? "+" : "";
  return {
    text: `${sign}${comparison.relativeDeltaPercent.toLocaleString("pt-BR", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    })}%`,
    tone,
  };
}

export function formatShortDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const dateOnly = iso.slice(0, 10);
  const [y, m, d] = dateOnly.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}
