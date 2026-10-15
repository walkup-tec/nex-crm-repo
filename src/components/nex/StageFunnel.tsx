import { useId } from "react";
import { funnelStageWidths } from "@/lib/meta-analysis";

const journeyFills = [
  "var(--primary)",
  "var(--info)",
  "color-mix(in oklch, var(--info) 42%, var(--cyan))",
  "var(--success)",
];

export function JourneyFunnel({
  stages,
  fills = journeyFills,
  label = "Funil da jornada da campanha",
  floor = 0,
  compact = false,
}: {
  stages: { label: string; value: string; amount: number | null }[];
  fills?: string[];
  label?: string;
  floor?: number;
  compact?: boolean;
}) {
  const measured = funnelStageWidths(stages.map((stage) => stage.amount));
  const positive = measured.filter((width) => width > 0);
  const smallest = positive.length ? Math.min(...positive) : 0;
  const emptyWidth = floor <= 0 ? 0 : positive.length ? Math.min(floor, smallest * 0.65) : floor;
  const widths = measured.map((width) => (width > 0 ? width : emptyWidth));
  return (
    <ol className="m-0 list-none space-y-0 p-0" aria-label={label}>
      {stages.map((stage, index) => {
        const top = widths[index] ?? 0;
        const next = widths[index + 1];
        const bottom = next == null ? top * 0.62 : next;
        const fill = fills[index] ?? journeyFills[index] ?? "var(--primary)";
        return (
          <li
            key={`${stage.label}-${index}`}
            className={
              compact
                ? "grid grid-cols-[minmax(0,1fr)_5.75rem] items-center gap-1.5"
                : "grid grid-cols-[minmax(0,1fr)_8.75rem] items-center gap-2 sm:gap-3"
            }
          >
            <div className="min-w-0 w-full">
              <FunnelSlice top={top} bottom={bottom} color={fill} close={next == null} compact={compact} />
            </div>
            <div className={compact ? "flex min-w-0 items-center gap-2" : "flex min-w-0 items-center gap-2.5"}>
              <span className="h-7 w-1 shrink-0 rounded-full" style={{ background: fill }} aria-hidden />
              <div className="min-w-0">
                <p className={compact ? "truncate text-xs leading-tight text-muted-foreground" : "text-xs leading-tight text-muted-foreground"}>{stage.label}</p>
                <p className="text-sm font-semibold tabular-nums">{stage.value}</p>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function FunnelSlice({
  top,
  bottom,
  color,
  close,
  compact,
}: {
  top: number;
  bottom: number;
  color: string;
  close: boolean;
  compact: boolean;
}) {
  const uid = useId().replace(/:/g, "");
  const cx = 100;
  const maxRx = 92;
  const rx0 = top * maxRx;
  const rx1 = bottom * maxRx;
  const ry0 = ellipseHeight(rx0);
  const ry1 = ellipseHeight(rx1);
  const y0 = Math.max(ry0, 1.5) + 1;
  const y1 = 64 - Math.max(ry1, 1.5) - 1;
  const side = `jf-side-${uid}`;
  const face = `jf-face-${uid}`;
  const body = frustumPath(cx, y0, rx0, ry0, y1, rx1, ry1);
  return (
    <svg
      viewBox="0 0 200 64"
      preserveAspectRatio="xMidYMid meet"
      className={compact ? "block aspect-[25/8] h-auto w-full" : "mx-auto block aspect-[25/8] h-auto w-full max-w-[18.75rem]"}
      aria-hidden
    >
      <defs>
        <linearGradient id={side} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={`color-mix(in oklch, black 22%, ${color})`} />
          <stop offset="38%" stopColor={`color-mix(in oklch, white 20%, ${color})`} />
          <stop offset="100%" stopColor={`color-mix(in oklch, black 34%, ${color})`} />
        </linearGradient>
        <linearGradient id={face} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={`color-mix(in oklch, white 32%, ${color})`} />
          <stop offset="100%" stopColor={color} />
        </linearGradient>
      </defs>
      {body ? <path d={body} fill={`url(#${side})`} /> : null}
      {rx0 >= 0.4 ? <ellipse cx={cx} cy={y0} rx={rx0} ry={ry0} fill={`url(#${face})`} /> : null}
      {close && rx1 >= 0.4 ? (
        <ellipse cx={cx} cy={y1} rx={rx1} ry={ry1} fill={`color-mix(in oklch, black 18%, ${color})`} />
      ) : null}
    </svg>
  );
}

function ellipseHeight(radius: number) {
  if (radius <= 0) return 0;
  return Math.min(13, Math.max(radius * 0.22, 0.7));
}

function frustumPath(
  cx: number,
  y0: number,
  rx0: number,
  ry0: number,
  y1: number,
  rx1: number,
  ry1: number,
) {
  if (rx0 < 0.4 && rx1 < 0.4) return "";
  const arc = (
    radius: number,
    height: number,
    _fromX: number,
    toX: number,
    y: number,
    sweep: 0 | 1,
  ) =>
    radius < 0.4
      ? `L ${toX} ${y}`
      : `A ${radius} ${Math.max(height, 0.4)} 0 0 ${sweep} ${toX} ${y}`;
  return [
    `M ${cx - rx0} ${y0}`,
    `L ${cx - rx1} ${y1}`,
    arc(rx1, ry1, cx - rx1, cx + rx1, y1, 0),
    `L ${cx + rx0} ${y0}`,
    arc(rx0, ry0, cx + rx0, cx - rx0, y0, 1),
    "Z",
  ].join(" ");
}
