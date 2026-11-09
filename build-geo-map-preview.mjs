import fs from "node:fs";
import {
  BRAZIL_MAP_VIEWBOX,
  BRAZIL_REGION_ANCHORS,
  BRAZIL_REGION_CALLOUT_BOXES,
  BRAZIL_UF_PATHS,
  BRAZIL_UF_REGION,
} from "./src/lib/brazil-uf-map.ts";

const regionColors = { SE: "#8b5cf6", S: "#6366f1", NE: "#38bdf8", CO: "#22d3ee", N: "#64748b" };
const EMPTY = "#1e293b";
const ufCounts = { SP: 8, RS: 6, MG: 5, PR: 4, SC: 3, RJ: 3, BA: 2, GO: 2, PE: 1, CE: 1, AM: 1, PA: 1, DF: 1 };
const regions = [
  { key: "SE", label: "Sudeste", clients: 14, percent: 42 },
  { key: "S", label: "Sul", clients: 9, percent: 28 },
  { key: "NE", label: "Nordeste", clients: 5, percent: 15 },
  { key: "CO", label: "Centro-Oeste", clients: 3, percent: 9 },
  { key: "N", label: "Norte", clients: 2, percent: 6 },
];
const maxUf = Math.max(...Object.values(ufCounts));
const active = "SE";

function fill(uf) {
  const clients = ufCounts[uf] ?? 0;
  const base = regionColors[BRAZIL_UF_REGION[uf]];
  if (!clients) return EMPTY;
  const t = Math.max(0.4, Math.min(1, clients / maxUf));
  return `color-mix(in srgb, ${base} ${Math.round(t * 100)}%, ${EMPTY})`;
}

const paths = Object.entries(BRAZIL_UF_PATHS)
  .map(([uf, d]) => `<path d="${d}" fill="${fill(uf)}" stroke="#0b1220" stroke-width="1" stroke-linejoin="round"><title>${uf}: ${ufCounts[uf] ?? 0}</title></path>`)
  .join("\n          ");

const callouts = regions
  .map((region) => {
    const box = BRAZIL_REGION_CALLOUT_BOXES[region.key];
    const anchor = BRAZIL_REGION_ANCHORS[region.key];
    const isActive = region.key === active;
    const color = regionColors[region.key];
    const w = 108;
    const h = 44;
    const attachX = box.side === "left" ? box.x + w : box.x;
    const attachY = box.y + h / 2;
    return `<g>
            <line x1="${anchor.x}" y1="${anchor.y}" x2="${attachX}" y2="${attachY}" stroke="${isActive ? "#8b5cf6" : "rgba(148,163,184,.5)"}" stroke-width="${isActive ? 1.6 : 1}"/>
            <circle cx="${anchor.x}" cy="${anchor.y}" r="4" fill="${color}" stroke="#0b1220" stroke-width="1.5"/>
            <rect x="${box.x}" y="${box.y}" width="${w}" height="${h}" rx="8" fill="${isActive ? "rgba(139,92,246,.16)" : "#0d1628"}" stroke="${isActive ? "#8b5cf6" : "rgba(148,163,184,.22)"}" stroke-width="${isActive ? 1.5 : 1}"/>
            <text x="${box.x + 12}" y="${box.y + 18}" fill="${isActive ? "#c4b5fd" : "#94a3b8"}" font-size="11">${region.label}</text>
            <text x="${box.x + 12}" y="${box.y + 35}" fill="#f1f5f9" font-size="13" font-weight="600">${region.clients} (${region.percent}%)</text>
          </g>`;
  })
  .join("\n          ");

const mapBlock = `<!-- MAP -->
      <div class="map-wrap">
        <svg viewBox="${BRAZIL_MAP_VIEWBOX}" role="img" aria-label="Mapa do Brasil por UF com indicadores regionais">
          ${paths}
          ${callouts}
        </svg>
      </div>`;

const geoPath = "dashboard-geo-preview.html";
let geo = fs.readFileSync(geoPath, "utf8");
geo = geo.replace(/<!-- MAP -->[\s\S]*?<\/div>\s*\n\s*<!-- TABLE -->/, `${mapBlock}\n\n      <!-- TABLE -->`);
geo = geo.replace(
  "Quantidade de clientes ativos por região do Brasil.",
  "UF da contratação agrupada nas 5 regiões com maior concentração.",
);
fs.writeFileSync(geoPath, geo);
console.log("updated geo map preview");
