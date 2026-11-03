import type { NexMetaAnalysisV1 } from "@/lib/meta-export";
import type { z } from "zod";
import type {
  ClaimKind,
  ClaimLevel,
  RecommendationLevel,
} from "@/lib/nex-intelligence/ai-output/types";

export const EXTERNAL_COMMERCIAL_MARKERS =
  /\b(crm|vendas?|receita|roi\b|roas\b|faturamento|agendamento|whatsapp\s+oficial\s+do\s+crm|lead\s+qualificado\s+no\s+crm|ticket\s+m[eé]dio)\b/i;

export const PERFORMANCE_JUDGMENT_RE =
  /\b(desempenho\s+(insuficiente|abaixo)|performance\s+(ruim|insuficiente|fraca|positiva|elevada|aceit[aá]vel|abaixo)|convers[aã]o\s+insatisfat[oó]ria|inefici[eê]n(te|cia)|retorno\s+(inadequado|baixo|ruim)|baixo\s+retorno|custo\s+por\s+resultado\s+(alto|elevado|ruim)|cpr\s+(alto|elevado)|n[aã]o\s+est[aá]\s+performando|resultados?\s+(ruins|fracos|insuficientes)|investimento\s+ineficiente|sem\s+retorno\s+adequado|ctr\s+(positiv[oa]|elevad[oa]|aceit[aá]vel|bom|alta?|baix[oa]|que\s+pode\s+ser\s+melhorad[oa])|engajamento\s+(positiv[oa]|elevad[oa]|forte)|pode(?:m)?\s+ser\s+melhorad[oa]s?|precisa(?:m)?\s+(?:ser\s+)?melhor(?:ar|ad[oa]s?)|abaixo\s+d[oa]\s+(esperado|expectativa|m[eé]dia)|acima\s+d[oa]\s+(esperado|expectativa|m[eé]dia)|m[eé]dia\s+das\s+campanhas)\b/i;

export const INDIRECT_RECOMMENDATION_RE =
  /\b(recomend(a|amos|a-se)|suger(e|imos|e-se)|vale\s+(a\s+pena\s+)?(aumentar|escalar|pausar|investir)|deve(-se)?\s+(aumentar|escalar|pausar|investir)|aument(ar|e)\s+(o\s+)?or[cç]amento|escal(ar|e)\s+(a\s+)?(campanha|conjunto|investimento)|paus(ar|e)\s+(a\s+)?(campanha|conjunto|an[uú]ncio)|substitu(ir|a)\s+(o\s+)?criativo|investir\s+mais)\b/i;

export const METRIC_MENTION_PATTERNS: Array<{ metric: string; re: RegExp }> = [
  { metric: "results", re: /\b(resultados?|convers[aã]o|leads?\s+gerados?)\b/i },
  { metric: "cost_per_result", re: /\b(custo\s+por\s+resultado|cpr|cost\s*per\s*result)\b/i },
  { metric: "spend", re: /\b(investimento|spend|gasto|or[cç]amento\s+consumido)\b/i },
  { metric: "ctr", re: /\bctr\b/i },
  { metric: "cpc", re: /\bcpc\b/i },
  { metric: "cpm", re: /\bcpm\b/i },
  { metric: "frequency", re: /\b(frequ[eê]ncia|satura)/i },
  { metric: "impressions", re: /\bimpress[oõ]es\b/i },
  { metric: "reach", re: /\balcance\b/i },
  { metric: "clicks", re: /\b(cliques?|clicks?)\b/i },
];

export function buildEntityIndex(payload: NexMetaAnalysisV1) {
  const campaigns = new Map(payload.campaigns.map((row) => [row.id, row]));
  const adsets = new Map(payload.adsets.map((row) => [row.id, row]));
  const ads = new Map(payload.ads.map((row) => [row.id, row]));
  const nameToId = new Map<string, { id: string; level: RecommendationLevel }>();
  for (const row of payload.campaigns) {
    if (row.name) nameToId.set(row.name.trim().toLowerCase(), { id: row.id, level: "campaign" });
  }
  for (const row of payload.adsets) {
    if (row.name) nameToId.set(row.name.trim().toLowerCase(), { id: row.id, level: "adset" });
  }
  for (const row of payload.ads) {
    if (row.name) nameToId.set(row.name.trim().toLowerCase(), { id: row.id, level: "ad" });
  }
  return { campaigns, adsets, ads, accountId: payload.account.id, nameToId };
}

export function entityExists(
  index: ReturnType<typeof buildEntityIndex>,
  level: RecommendationLevel,
  entityId: string,
): boolean {
  if (level === "campaign") return index.campaigns.has(entityId);
  if (level === "adset") return index.adsets.has(entityId);
  return index.ads.has(entityId);
}


export function inferMetricsFromText(text: string): string[] {
  const found = new Set<string>();
  for (const item of METRIC_MENTION_PATTERNS) {
    if (item.re.test(text)) found.add(item.metric);
  }
  if (PERFORMANCE_JUDGMENT_RE.test(text) && found.size === 0) {
    found.add("results");
    found.add("cost_per_result");
  }
  return [...found];
}

export function detectClaimKindFromText(text: string): ClaimKind {
  if (INDIRECT_RECOMMENDATION_RE.test(text)) return "indirect_recommendation";
  if (PERFORMANCE_JUDGMENT_RE.test(text)) return "performance_judgment";
  return "descriptive";
}

export function resolveEntityFromText(
  text: string,
  payload: NexMetaAnalysisV1,
): { entity_id: string | null; level: ClaimLevel } {
  const index = buildEntityIndex(payload);
  for (const id of [...index.campaigns.keys(), ...index.adsets.keys(), ...index.ads.keys()]) {
    if (text.includes(id)) {
      if (index.campaigns.has(id)) return { entity_id: id, level: "campaign" };
      if (index.adsets.has(id)) return { entity_id: id, level: "adset" };
      return { entity_id: id, level: "ad" };
    }
  }
  const lower = text.toLowerCase();
  for (const [name, ref] of index.nameToId) {
    if (name.length >= 3 && lower.includes(name)) return { entity_id: ref.id, level: ref.level };
  }
  return { entity_id: null, level: "account" };
}

export function formatZodIssues(
  issues: z.ZodIssue[],
  prefix: string,
): Array<{ path: string; message: string }> {
  return issues.map((issue) => ({
    path: issue.path.length ? `${prefix}.${issue.path.join(".")}` : prefix,
    message: issue.message,
  }));
}
