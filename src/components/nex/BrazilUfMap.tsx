import type { DashboardRegion } from "@/lib/master-dashboard";
import {
  BRAZIL_MAP_VIEWBOX,
  BRAZIL_REGION_ANCHORS,
  BRAZIL_REGION_CALLOUT_BOXES,
  BRAZIL_UF_PATHS,
  BRAZIL_UF_REGION,
  type BrazilRegionKey,
  type BrazilUfCode,
} from "@/lib/brazil-uf-map";

const regionColors: Record<BrazilRegionKey, string> = {
  SE: "#8b5cf6",
  S: "#6366f1",
  NE: "#38bdf8",
  CO: "#22d3ee",
  N: "#64748b",
};

const EMPTY = "#1e293b";

type Props = {
  regions: DashboardRegion[];
  ufCounts: Record<string, number>;
  activeKey: string;
  onSelect: (key: string) => void;
};

export function BrazilUfMap({ regions, ufCounts, activeKey, onSelect }: Props) {
  const maxUf = Math.max(1, ...Object.values(ufCounts));
  const topRegions = regions.slice(0, 5);

  const fillFor = (uf: BrazilUfCode) => {
    const regionKey = BRAZIL_UF_REGION[uf];
    const clients = ufCounts[uf] ?? 0;
    const base = regionColors[regionKey];
    if (clients <= 0) return EMPTY;
    const t = Math.max(0.4, Math.min(1, clients / maxUf));
    return `color-mix(in srgb, ${base} ${Math.round(t * 100)}%, ${EMPTY})`;
  };

  return (
    <svg
      viewBox={BRAZIL_MAP_VIEWBOX}
      className="mx-auto h-auto w-full max-w-xl overflow-visible"
      role="img"
      aria-label="Mapa do Brasil por UF com indicadores regionais de clientes contratantes"
    >
      <g>
        {(Object.keys(BRAZIL_UF_PATHS) as BrazilUfCode[]).map((uf) => {
          const regionKey = BRAZIL_UF_REGION[uf];
          const active = activeKey === regionKey;
          return (
            <path
              key={uf}
              d={BRAZIL_UF_PATHS[uf]}
              fill={fillFor(uf)}
              stroke="#0b1220"
              strokeWidth={1}
              strokeLinejoin="round"
              className={`cursor-pointer transition ${active ? "brightness-110" : "hover:brightness-125"}`}
              onClick={() => onSelect(regionKey)}
            >
              <title>
                {uf}: {ufCounts[uf] ?? 0} cliente(s)
              </title>
            </path>
          );
        })}
      </g>

      {topRegions.map((region) => {
        const key = region.key as BrazilRegionKey;
        const anchor = BRAZIL_REGION_ANCHORS[key];
        const box = BRAZIL_REGION_CALLOUT_BOXES[key];
        if (!anchor || !box) return null;
        const active = activeKey === key;
        const color = region.clients > 0 ? regionColors[key] : EMPTY;
        const w = 108;
        const h = 44;
        const attachX = box.side === "left" ? box.x + w : box.x;
        const attachY = box.y + h / 2;
        return (
          <g key={`callout-${key}`} className="cursor-pointer" onClick={() => onSelect(key)}>
            <line
              x1={anchor.x}
              y1={anchor.y}
              x2={attachX}
              y2={attachY}
              stroke={active ? "#8b5cf6" : "rgba(148,163,184,0.5)"}
              strokeWidth={active ? 1.6 : 1}
              pointerEvents="none"
            />
            <circle cx={anchor.x} cy={anchor.y} r={4} fill={color} stroke="#0b1220" strokeWidth={1.5} />
            <rect
              x={box.x}
              y={box.y}
              width={w}
              height={h}
              rx={8}
              fill={active ? "rgba(139,92,246,0.16)" : "#0d1628"}
              stroke={active ? "#8b5cf6" : "rgba(148,163,184,0.22)"}
              strokeWidth={active ? 1.5 : 1}
            />
            <text x={box.x + 12} y={box.y + 18} fill={active ? "#c4b5fd" : "#94a3b8"} fontSize={11}>
              {region.label}
            </text>
            <text x={box.x + 12} y={box.y + 35} fill="#f1f5f9" fontSize={13} fontWeight={600}>
              {region.clients} ({region.percent}%)
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function regionColor(key: string) {
  return regionColors[key as BrazilRegionKey] ?? "#64748b";
}
