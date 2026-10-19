import QRCode from "../vendor/qrcode/lib/core/qrcode.js";
import { adsServiceDescription, dateBr, moneyFromCents, promoChargeCopy } from "@/lib/client-access";

const createQr = QRCode.create as (
  data: string,
  options?: { errorCorrectionLevel?: string },
) => { modules: { size: number; get: (row: number, col: number) => number } };

const beneficiaryName = "WALKUP SISTEMAS E INTELIGENCIA LTDA";
const beneficiaryDocument = "69.511.558/0001-38";
const cardWidth = 1080;
const primary = "#c026ff";
const ink = "#f8f7ff";
const muted = "#b7b3c9";
const panel = "#17142a";
const panelAlt = "#211c38";
const line = "#3a3358";

export type ChargeCardInput = {
  clientName: string;
  totalCents: number;
  dueDate: string;
  pixPayload: string;
  adsMeta: boolean;
  adsGoogle: boolean;
  delinquencyAmountCents: number | null;
  promotions: { startsOn: string; endsOn: string; amountCents: number; nominalCents: number }[];
  promoMonthlyCents: number | null;
  nominalMonthlyCents: number | null;
  logoBase64: string;
};

export function buildChargeCardSvg(input: ChargeCardInput) {
  const afterDue =
    input.delinquencyAmountCents != null && input.delinquencyAmountCents > 0
      ? moneyFromCents(input.delinquencyAmountCents)
      : "";
  const matched = input.promotions.find((promo) => input.dueDate >= promo.startsOn && input.dueDate <= promo.endsOn);
  const promo =
    afterDue && matched
      ? promoChargeCopy(moneyFromCents(matched.nominalCents), moneyFromCents(matched.amountCents), afterDue)
      : afterDue && input.promotions.length === 0 && input.promoMonthlyCents != null && input.nominalMonthlyCents != null
        ? promoChargeCopy(moneyFromCents(input.nominalMonthlyCents), moneyFromCents(input.promoMonthlyCents), afterDue)
        : null;
  const description = adsServiceDescription({ adsMeta: input.adsMeta, adsGoogle: input.adsGoogle });
  const symbol = createQr(input.pixPayload, { errorCorrectionLevel: "M" });
  const quiet = 2;
  const matrix = symbol.modules.size + quiet * 2;
  const cell = Math.max(3, Math.floor(400 / matrix));
  const qrPixels = matrix * cell;
  const qrLeft = 590 + Math.round((450 - qrPixels) / 2);
  const qrTop = 356;
  const rects: string[] = [];
  for (let row = 0; row < symbol.modules.size; row += 1) {
    for (let col = 0; col < symbol.modules.size; col += 1) {
      if (!symbol.modules.get(row, col)) continue;
      const x = qrLeft + (col + quiet) * cell;
      const y = qrTop + (row + quiet) * cell;
      rects.push(
        `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" fill="#111111" shape-rendering="crispEdges"/>`,
      );
    }
  }
  const left: string[] = [];
  let y = 292;
  y = section(left, "Beneficiário", y, false);
  y = paragraph(left, wrap(beneficiaryName, 34), y, 18, ink, 700, 26);
  y = paragraph(left, [`CNPJ ${beneficiaryDocument}`], y, 15, muted, 400, 22);
  y += 8;
  y = section(left, "Descrição", y);
  y = paragraph(left, wrap(description, 42), y, 16, ink, 500, 24);
  if (promo) {
    y += 8;
    y = section(left, "Sobre o valor da mensalidade", y);
    y = paragraph(left, wrap(promo.about, 46), y, 15, ink, 400, 22);
    y += 8;
    y = paragraph(left, wrap(promo.keep, 46), y, 15, ink, 400, 22);
  }
  if (afterDue) {
    y += 8;
    y = section(left, "Após vencimento", y);
    y = paragraph(left, [afterDue], y, 22, ink, 700, 30);
  }
  const height = Math.max(y + 36, qrTop + qrPixels + 40);
  const logo = input.logoBase64
    ? `<image href="data:image/png;base64,${input.logoBase64}" x="40" y="36" width="230" height="62"/>`
    : "";
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${cardWidth}" height="${height}" viewBox="0 0 ${cardWidth} ${height}">
  <rect width="${cardWidth}" height="${height}" fill="#0c1020"/>
  ${logo}
  <text x="1040" y="62" text-anchor="end" font-family="Inter, sans-serif" font-size="34" font-weight="700" fill="${ink}">Essa é a sua <tspan fill="${primary}">cobrança</tspan></text>
  <text x="1040" y="96" text-anchor="end" font-family="Inter, sans-serif" font-size="16" fill="${muted}">${xml(input.clientName)}</text>
  ${stat(40, 132, "Valor", moneyFromCents(input.totalCents), dollarIcon(62, 180))}
  ${stat(556, 132, "Vencimento", dateBr(input.dueDate), calendarIcon(578, 180))}
  ${left.join("\n  ")}
  <rect x="590" y="268" width="450" height="${height - 304}" rx="22" fill="${panel}" stroke="${line}"/>
  <text x="815" y="312" text-anchor="middle" font-family="Inter, sans-serif" font-size="16" font-weight="600" fill="${ink}">Escaneie o QR code abaixo</text>
  <text x="815" y="336" text-anchor="middle" font-family="Inter, sans-serif" font-size="15" fill="${muted}">para realizar o pagamento</text>
  <rect x="${qrLeft}" y="${qrTop}" width="${qrPixels}" height="${qrPixels}" fill="#ffffff"/>
  ${corner(qrLeft, qrTop, qrPixels)}
  ${rects.join("\n  ")}
</svg>`;
}

function stat(x: number, y: number, label: string, value: string, icon: string) {
  return `<rect x="${x}" y="${y}" width="484" height="108" rx="22" fill="${x === 40 ? panel : panelAlt}" stroke="${line}"/>
  ${icon}
  <text x="${x + 84}" y="${y + 42}" font-family="Inter, sans-serif" font-size="15" fill="${muted}">${xml(label)}</text>
  <text x="${x + 84}" y="${y + 76}" font-family="Inter, sans-serif" font-size="30" font-weight="700" fill="${ink}">${xml(value)}</text>`;
}

function section(lines: string[], title: string, y: number, ruled = true) {
  if (ruled) lines.push(`<line x1="40" y1="${y - 18}" x2="540" y2="${y - 18}" stroke="${line}"/>`);
  lines.push(
    `<text x="40" y="${y + 8}" font-family="Inter, sans-serif" font-size="20" font-weight="700" fill="${primary}">${xml(title)}</text>`,
  );
  return y + 36;
}

function paragraph(lines: string[], rows: string[], y: number, size: number, fill: string, weight: number, gap: number) {
  for (const row of rows) {
    lines.push(
      `<text x="40" y="${y}" font-family="Inter, sans-serif" font-size="${size}" font-weight="${weight}" fill="${fill}">${xml(row)}</text>`,
    );
    y += gap;
  }
  return y;
}

function wrap(value: string, max: number) {
  const words = value.split(/\s+/).filter(Boolean);
  const rows: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > max && line) {
      rows.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) rows.push(line);
  return rows;
}

function xml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function dollarIcon(x: number, y: number) {
  return `<circle cx="${x}" cy="${y}" r="26" fill="${primary}"/>
  <text x="${x}" y="${y + 8}" text-anchor="middle" font-family="Inter, sans-serif" font-size="26" font-weight="700" fill="#ffffff">$</text>`;
}

function calendarIcon(x: number, y: number) {
  return `<circle cx="${x}" cy="${y}" r="26" fill="${primary}"/>
  <rect x="${x - 12}" y="${y - 10}" width="24" height="20" rx="3" fill="none" stroke="#ffffff" stroke-width="2"/>
  <line x1="${x - 12}" y1="${y - 4}" x2="${x + 12}" y2="${y - 4}" stroke="#ffffff" stroke-width="2"/>`;
}

function corner(x: number, y: number, size: number) {
  const arm = 28;
  const right = x + size;
  const bottom = y + size;
  return `<path d="M${x} ${y + arm} V${y} H${x + arm}" fill="none" stroke="${primary}" stroke-width="4"/>
  <path d="M${right - arm} ${y} H${right} V${y + arm}" fill="none" stroke="${primary}" stroke-width="4"/>
  <path d="M${x} ${bottom - arm} V${bottom} H${x + arm}" fill="none" stroke="${primary}" stroke-width="4"/>
  <path d="M${right - arm} ${bottom} H${right} V${bottom - arm}" fill="none" stroke="${primary}" stroke-width="4"/>`;
}
