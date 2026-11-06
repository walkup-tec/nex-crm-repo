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
  if (!comparison || comparison.assessment === "NOT_ASSESSED") return null;
  if (
    comparison.comparisonStatus !== "VALID" &&
    comparison.comparisonStatus !== "INCOMPARABLE"
  ) {
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

  if (comparison.relativeDeltaPercent != null) {
    const sign = comparison.relativeDeltaPercent > 0 ? "+" : "";
    return {
      text: `${sign}${comparison.relativeDeltaPercent.toLocaleString("pt-BR", {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      })}%`,
      tone,
    };
  }

  // Base anterior zerada: ainda dá para sinalizar direção pelo delta absoluto.
  if (comparison.absoluteDelta != null && comparison.absoluteDelta !== 0) {
    return {
      text: comparison.absoluteDelta > 0 ? "novo" : "zerou",
      tone: tone === "neutral" ? (comparison.absoluteDelta > 0 ? "positive" : "negative") : tone,
    };
  }

  return null;
}

export function formatShortDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const dateOnly = iso.slice(0, 10);
  const [y, m, d] = dateOnly.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

/** Data e hora no fuso local, formato pt-BR: 03/11/2026 11:24 */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return formatShortDate(iso);
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
