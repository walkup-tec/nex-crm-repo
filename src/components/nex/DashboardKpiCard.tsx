import type { CSSProperties } from "react";
import type { LucideIcon } from "lucide-react";
import { ArrowDown, ArrowUp, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type KpiTrendTone = "positive" | "negative";

export type KpiTrend = {
  direction: "up" | "down";
  /** Ex.: "+3 (10,3%)" ou "+28%" */
  text: string;
  /** "negative" força vermelho (atraso sobe = ruim) */
  tone: KpiTrendTone;
};

export type DashboardKpiCardProps = {
  label: string;
  value: string;
  icon: LucideIcon;
  /** Hex da barra, ícone e glow. Ex.: "#3b82f6" */
  accentColor: string;
  /** Dinheiro cinza sob o valor (vencimentos) */
  subValue?: string;
  trend?: KpiTrend;
  /** Ex.: "vs. 29 no mês anterior" */
  comparison?: string;
  footerLabel: string;
  onFooterClick?: () => void;
  className?: string;
};

export function DashboardKpiCard({
  label,
  value,
  icon: Icon,
  accentColor,
  subValue,
  trend,
  comparison,
  footerLabel,
  onFooterClick,
  className,
}: DashboardKpiCardProps) {
  const TrendArrow = trend?.direction === "down" ? ArrowDown : ArrowUp;

  return (
    <article
      style={{ "--accent": accentColor } as CSSProperties}
      className={cn(
        "relative flex flex-col overflow-hidden rounded-xl border border-slate-400/[0.14]",
        "bg-gradient-to-b from-[#101a2e] to-[#0d1527]",
        "shadow-[0_8px_24px_-12px_rgba(0,0,0,0.6)] transition-colors hover:border-slate-400/30",
        className,
      )}
    >
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-[3px] bg-[var(--accent)] shadow-[0_0_10px_1px_var(--accent),0_0_22px_2px_color-mix(in_srgb,var(--accent)_45%,transparent)]"
      />

      <div className="flex-1 py-3.5 pl-6 pr-3.5">
        <div className="flex items-center gap-2">
          <span className="grid h-[30px] w-[30px] flex-none place-items-center rounded-lg border border-[color-mix(in_srgb,var(--accent)_28%,transparent)] bg-[color-mix(in_srgb,var(--accent)_16%,transparent)] text-[var(--accent)]">
            <Icon className="h-4 w-4" strokeWidth={2} aria-hidden />
          </span>
          <span className="min-w-0 flex-1 text-[12.5px] font-medium leading-tight text-white" title={label}>
            {label}
          </span>
        </div>

        <div className="mt-3 whitespace-nowrap text-2xl font-bold leading-[1.1] tracking-tight text-white tabular-nums xl:text-[21px] 2xl:text-2xl">
          {value}
        </div>

        {subValue ? <div className="mt-1 text-[13px] font-medium tabular-nums text-slate-400">{subValue}</div> : null}

        {trend ? (
          <>
            <div
              className={cn(
                "mt-2 flex items-center gap-[3px] text-xs font-semibold tabular-nums",
                trend.tone === "negative" ? "text-red-400" : "text-emerald-400",
              )}
            >
              <TrendArrow className="h-[13px] w-[13px]" strokeWidth={2.5} aria-hidden />
              <span>{trend.text}</span>
            </div>
            {comparison ? <div className="mt-0.5 text-[11px] leading-snug text-[#8190a6]">{comparison}</div> : null}
          </>
        ) : null}
      </div>

      <button
        type="button"
        onClick={onFooterClick}
        className="group/foot flex w-full items-center justify-between border-t border-slate-400/10 bg-[#02060f]/60 py-2.5 pl-6 pr-3.5 text-left text-xs font-medium text-slate-300 transition-colors hover:bg-white/5 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--accent)]"
      >
        <span>{footerLabel}</span>
        <ChevronRight className="h-[15px] w-[15px] text-slate-500 transition group-hover/foot:translate-x-0.5 group-hover/foot:text-white" />
      </button>
    </article>
  );
}
