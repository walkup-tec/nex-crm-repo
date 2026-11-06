import { useLayoutEffect, useRef } from "react";
import { formatComparisonBadge, formatMetricValue } from "@/lib/nex-intelligence/dashboard/format";
import type { DashboardMetric, MetricComparison } from "@/lib/nex-intelligence/dashboard/types";
import { ni } from "@/components/nex/intelligence/intelligence-theme";

type Props = {
  metric: DashboardMetric;
  comparison?: MetricComparison;
  currency?: string;
  referenceLabel?: string;
};

const VALUE_MAX_PX = 24;
const VALUE_MIN_PX = 13;

/** Mantém o valor em uma linha, reduzindo a fonte até caber. */
function FitMetricValue({ text }: { text: string }) {
  const ref = useRef<HTMLParagraphElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const fit = () => {
      let size = VALUE_MAX_PX;
      el.style.fontSize = `${size}px`;
      while (size > VALUE_MIN_PX && el.scrollWidth > el.clientWidth + 0.5) {
        size -= 0.5;
        el.style.fontSize = `${size}px`;
      }
    };

    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(el);
    if (el.parentElement) observer.observe(el.parentElement);
    return () => observer.disconnect();
  }, [text]);

  return (
    <p
      ref={ref}
      className="min-w-0 flex-1 whitespace-nowrap font-semibold leading-none tracking-tight text-white"
      style={{ fontSize: VALUE_MAX_PX }}
      title={text}
    >
      {text}
    </p>
  );
}

export function MetricCard({
  metric,
  comparison,
  currency = "BRL",
  referenceLabel = "vs. dia anterior",
}: Props) {
  const badge = formatComparisonBadge(comparison);
  const delta = comparison?.absoluteDelta ?? comparison?.relativeDeltaPercent ?? null;
  const arrow = delta == null || delta === 0 ? "" : delta < 0 ? "↓ " : "↑ ";
  const valueText = formatMetricValue(metric, currency);

  const toneClass =
    badge?.tone === "positive"
      ? "bg-emerald-500/20 text-emerald-300"
      : badge?.tone === "negative"
        ? "bg-rose-500/20 text-rose-300"
        : "bg-white/10 text-white/70";

  return (
    <div className={`${ni.card} border-l-2 border-l-[#1d6feb] p-4`}>
      <p className={ni.label}>{metric.label}</p>
      <div className="mt-2 flex min-h-7 items-center justify-between gap-2">
        <FitMetricValue text={valueText} />
        {badge ? (
          <span
            className={`inline-flex shrink-0 items-center rounded-md px-2 py-0.5 text-xs font-semibold ${toneClass}`}
          >
            {arrow}
            {badge.text}
          </span>
        ) : (
          <span className="inline-flex shrink-0 items-center rounded-md bg-white/10 px-2 py-0.5 text-xs font-semibold text-white/55">
            Sem base
          </span>
        )}
      </div>
      <p className={`mt-2 text-xs text-[#8fa3bf]`}>
        {badge ? referenceLabel : "Sem base comparável no período anterior"}
      </p>
      {metric.quality === "UNAVAILABLE" ? (
        <p className={`mt-2 ${ni.muted}`}>Indisponível</p>
      ) : metric.quality === "NOT_VERIFIABLE" ? (
        <p className={`mt-2 ${ni.muted}`}>Não verificável</p>
      ) : null}
    </div>
  );
}
