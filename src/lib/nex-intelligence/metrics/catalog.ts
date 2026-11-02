/** Catálogo canônico de métricas monitoráveis (CMS-E1 / monitor). */
export const MONITORABLE_METRICS = new Set([
  "ctr",
  "link_ctr",
  "cpc",
  "link_cpc",
  "cpm",
  "impressions",
  "clicks",
  "reach",
  "frequency",
]);

export { normalizeCanonicalMetric } from "@/lib/nex-intelligence/trace";
