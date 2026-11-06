import { useState } from "react";
import { formatDateTime } from "@/lib/nex-intelligence/dashboard/format";
import type { OptimizationMarker } from "@/lib/nex-intelligence/dashboard/types";

type LabelProps = {
  viewBox?: { x?: number; y?: number; width?: number; height?: number };
  marker: OptimizationMarker;
};

/** Bandeirinha no topo do marco — hover abre balão com o que foi feito. */
export function OptimizationChartMarkerLabel({ viewBox, marker }: LabelProps) {
  const [open, setOpen] = useState(false);
  const x = viewBox?.x ?? 0;
  const y = (viewBox?.y ?? 0) + 4;

  const title = marker.type?.trim() || "Otimização";
  const body = marker.description?.trim() || "Otimização aplicada na campanha.";
  const when = marker.effectiveAt ? formatDateTime(marker.effectiveAt) : null;

  const tipWidth = 210;
  const tipX = Math.max(-tipWidth / 2, -x + 8);

  return (
    <g
      transform={`translate(${x}, ${y})`}
      style={{ cursor: "pointer", pointerEvents: "all" }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <circle r={14} fill="transparent" />
      <line x1={0} y1={2} x2={0} y2={18} stroke="#f4f7fb" strokeWidth={1.75} />
      <path d="M0 2 L14 7 L0 12 Z" fill="#3ecbff" stroke="#122038" strokeWidth={0.75} />
      <circle cx={0} cy={18} r={4} fill="#3ecbff" stroke="#ffffff" strokeWidth={1.75} />

      {open ? (
        <foreignObject x={tipX} y={24} width={tipWidth} height={100}>
          <div
            xmlns="http://www.w3.org/1999/xhtml"
            className="rounded-lg border border-[#2a4060] bg-[#0b1729] px-2.5 py-2 text-left shadow-[0_10px_28px_rgba(0,0,0,0.45)]"
            style={{ pointerEvents: "none" }}
          >
            <p className="m-0 text-[11px] font-semibold text-[#3ecbff]">{title}</p>
            <p className="m-0 mt-1 text-[11px] leading-snug text-[#f4f7fb]">{body}</p>
            {when ? <p className="m-0 mt-1 text-[10px] text-[#8fa3bf]">em {when}</p> : null}
          </div>
        </foreignObject>
      ) : null}
    </g>
  );
}
