import { normalizeCanonicalMetric } from "@/lib/nex-intelligence/trace";

/** Extrai percentuais citados (PT: 1,94% / 1.94%). Evita IDs/contagens sem %. */
export function extractClaimedNumbers(text: string): number[] {
  const out: number[] = [];
  const re = /(\d{1,3}(?:[.,]\d+)?|\d+)\s*%/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text))) {
    const raw = match[1]!.replace(",", ".");
    const n = Number(raw);
    if (!Number.isFinite(n)) continue;
    out.push(n);
  }
  return out;
}

function closeEnough(claimed: number, expected: number, metric: string): boolean {
  const absTol = metric === "spend" || metric === "cpc" || metric === "cpm" || metric === "cost_per_result" ? 0.05 : 0.05;
  const relTol = 0.02;
  if (Math.abs(claimed - expected) <= absTol) return true;
  if (expected !== 0 && Math.abs(claimed - expected) / Math.abs(expected) <= relTol) return true;
  // Percentuais exibidos com 2 casas (1,00 vs 1).
  if (Math.abs(Number(claimed.toFixed(2)) - Number(expected.toFixed(2))) <= 0.01) return true;
  return false;
}

/**
 * Confere se os percentuais do texto batem com o result do catálogo para as métricas usadas.
 * Sem % no texto → ok. Todo % citado deve casar com algum result esperado.
 */
export function claimValuesMatchCatalog(input: {
  text: string;
  metricsUsed: string[];
  catalogResults: Array<{ metric: string; result: number | null }>;
}): string[] {
  const claimed = extractClaimedNumbers(input.text);
  if (!claimed.length) return [];

  const metrics = input.metricsUsed.map(normalizeCanonicalMetric);
  const expected = input.catalogResults
    .filter((row) => metrics.includes(normalizeCanonicalMetric(row.metric)))
    .map((row) => row.result)
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v));

  if (!expected.length) return [];

  const ok = claimed.every((n) =>
    expected.some((exp, idx) => {
      const metric = metrics[Math.min(idx, metrics.length - 1)] ?? "ctr";
      return closeEnough(n, exp, metric);
    }),
  );

  if (ok) return [];
  return [
    `claim_value_mismatch:text[${claimed.join(",")}]!=catalog[${expected.map((v) => v.toFixed(4)).join(",")}]`,
  ];
}
