import fs from "node:fs";
import path from "node:path";

const root = path.resolve("src/lib/nex-intelligence");
const src = fs.readFileSync(path.join(root, "validation/orchestrate.ts"), "utf8");
const lines = src.split(/\r?\n/);
const slice = (a, b) => lines.slice(a - 1, b).join("\n");
const write = (rel, content) => {
  const full = path.join(root, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content.replace(/\n+$/, "") + "\n");
  console.log("wrote", rel, "(~" + content.split(/\n/).length + " lines)");
};

await import("./split-orchestrate.mjs");

write(
  "validation/entity-helpers.ts",
  `import type { NexMetaAnalysisV1 } from "@/lib/meta-export";
import type { z } from "zod";
import type {
  ClaimKind,
  ClaimLevel,
  RecommendationLevel,
} from "@/lib/nex-intelligence/ai-output/types";

export const EXTERNAL_COMMERCIAL_MARKERS =
  /\\b(crm|vendas?|receita|roi\\b|roas\\b|faturamento|agendamento|whatsapp\\s+oficial\\s+do\\s+crm|lead\\s+qualificado\\s+no\\s+crm|ticket\\s+m[eé]dio)\\b/i;

export const PERFORMANCE_JUDGMENT_RE =
  /\\b(desempenho\\s+insuficiente|performance\\s+(ruim|insuficiente|fraca|positiva|elevada|aceit[aá]vel)|convers[aã]o\\s+insatisfat[oó]ria|inefici[eê]n(te|cia)|retorno\\s+(inadequado|baixo|ruim)|baixo\\s+retorno|custo\\s+por\\s+resultado\\s+(alto|elevado|ruim)|cpr\\s+(alto|elevado)|n[aã]o\\s+est[aá]\\s+performando|resultados?\\s+(ruins|fracos|insuficientes)|investimento\\s+ineficiente|sem\\s+retorno\\s+adequado|ctr\\s+(positiv[oa]|elevad[oa]|aceit[aá]vel|bom|alta?|baix[oa])|engajamento\\s+(positiv[oa]|elevad[oa]|forte))\\b/i;

export const INDIRECT_RECOMMENDATION_RE =
  /\\b(recomend(a|amos|a-se)|suger(e|imos|e-se)|vale\\s+(a\\s+pena\\s+)?(aumentar|escalar|pausar|investir)|deve(-se)?\\s+(aumentar|escalar|pausar|investir)|aument(ar|e)\\s+(o\\s+)?or[cç]amento|escal(ar|e)\\s+(a\\s+)?(campanha|conjunto|investimento)|paus(ar|e)\\s+(a\\s+)?(campanha|conjunto|an[uú]ncio)|substitu(ir|a)\\s+(o\\s+)?criativo|investir\\s+mais)\\b/i;

export const METRIC_MENTION_PATTERNS: Array<{ metric: string; re: RegExp }> = [
  { metric: "results", re: /\\b(resultados?|convers[aã]o|leads?\\s+gerados?)\\b/i },
  { metric: "cost_per_result", re: /\\b(custo\\s+por\\s+resultado|cpr|cost\\s*per\\s*result)\\b/i },
  { metric: "spend", re: /\\b(investimento|spend|gasto|or[cç]amento\\s+consumido)\\b/i },
  { metric: "ctr", re: /\\bctr\\b/i },
  { metric: "cpc", re: /\\bcpc\\b/i },
  { metric: "cpm", re: /\\bcpm\\b/i },
  { metric: "frequency", re: /\\b(frequ[eê]ncia|satura)/i },
  { metric: "impressions", re: /\\bimpress[oõ]es\\b/i },
  { metric: "reach", re: /\\balcance\\b/i },
  { metric: "clicks", re: /\\b(cliques?|clicks?)\\b/i },
];

${slice(254, 270)}

${slice(312, 357)}
`,
);

write(
  "validation/recommendations.ts",
  `import type { MetaDataQualityReport } from "@/lib/nex-intelligence/quality/validate-export";
import type { NexMetaAnalysisV1 } from "@/lib/meta-export";
import {
  buildCompromisedMetricIndex,
  metricIntegrityForEntity,
  normalizeCanonicalMetric,
  validateTraceIdsForClaim,
  type MetricTraceRecord,
} from "@/lib/nex-intelligence/trace";
import {
  classifyAchievedEvidenceLevel,
  evidenceLevelAtLeast,
  requiredEvidenceLevelForAction,
  textHasCausalPromise,
  textHasInventedBenchmark,
  textHasUnfoundedQualitativeLabel,
} from "@/lib/nex-intelligence/evidence/levels";
import { tryCmsE1PartialRecovery } from "@/lib/nex-intelligence/recovery/cms-e1";
import {
  structuredRecommendationSchema,
  type StructuredRecommendation,
} from "@/lib/nex-intelligence/ai-output/schemas";
import { normalizeRecommendationDraft } from "@/lib/nex-intelligence/ai-output/normalize-drafts";
import type { ValidatedRecommendation } from "@/lib/nex-intelligence/ai-output/types";
import {
  buildEntityIndex,
  EXTERNAL_COMMERCIAL_MARKERS,
  formatZodIssues,
} from "@/lib/nex-intelligence/validation/entity-helpers";

${slice(271, 310)}

${slice(427, 678)}

${slice(860, 870)}
`,
);

write(
  "validation/claims.ts",
  `import type { MetaDataQualityReport } from "@/lib/nex-intelligence/quality/validate-export";
import type { NexMetaAnalysisV1 } from "@/lib/meta-export";
import {
  mentionsNumericClaim,
  mentionsSimpleAverageCtr,
  metricIntegrityForAccountClaim,
  metricIntegrityForEntity,
  normalizeCanonicalMetric,
  validateTraceIdsForClaim,
  type MetricTraceRecord,
} from "@/lib/nex-intelligence/trace";
import {
  claimRequiresComparativeEvidence,
  classifyAchievedEvidenceLevel,
  textHasCausalPromise,
  textHasInventedBenchmark,
  textHasUnfoundedQualitativeLabel,
} from "@/lib/nex-intelligence/evidence/levels";
import { structuredClaimSchema } from "@/lib/nex-intelligence/ai-output/schemas";
import { normalizeClaimDraft } from "@/lib/nex-intelligence/ai-output/normalize-drafts";
import type { ValidatedClaim } from "@/lib/nex-intelligence/ai-output/types";
import {
  detectClaimKindFromText,
  formatZodIssues,
  inferMetricsFromText,
  resolveEntityFromText,
} from "@/lib/nex-intelligence/validation/entity-helpers";

${slice(680, 880)}
`,
);

write(
  "ai-output/parse.ts",
  `import {
  structuredAnalysisSchema,
  structuredClaimSchema,
  structuredRecommendationSchema,
  type StructuredClaim,
  type StructuredRecommendation,
} from "@/lib/nex-intelligence/ai-output/schemas";
import { normalizeClaimDraft, normalizeRecommendationDraft } from "@/lib/nex-intelligence/ai-output/normalize-drafts";
import type { SchemaFieldError, StructuredAnalysisPayload } from "@/lib/nex-intelligence/ai-output/types";
import { parseMetricTraceability, type MetricTraceability } from "@/lib/nex-intelligence/trace";
import { formatZodIssues } from "@/lib/nex-intelligence/validation/entity-helpers";

${slice(882, 1065)}

${slice(1234, 1276)}
`,
);

write(
  "validation/narrative.ts",
  `import type { MetaDataQualityReport } from "@/lib/nex-intelligence/quality/validate-export";
import type { NexMetaAnalysisV1 } from "@/lib/meta-export";
import { validateStructuredClaim } from "@/lib/nex-intelligence/validation/claims";
import {
  detectClaimKindFromText,
  inferMetricsFromText,
  resolveEntityFromText,
} from "@/lib/nex-intelligence/validation/entity-helpers";

${slice(1067, 1111)}
`,
);

write(
  "report/compose-published-markdown.ts",
  `import type { MetaDataQualityReport } from "@/lib/nex-intelligence/quality/validate-export";
import type { ValidatedClaim, ValidatedRecommendation } from "@/lib/nex-intelligence/ai-output/types";

${slice(1113, 1232)}
`,
);

write(
  "report/deterministic-fallback.ts",
  `import type { MetaDataQualityReport } from "@/lib/nex-intelligence/quality/validate-export";
import type { NexMetaAnalysisV1 } from "@/lib/meta-export";

${slice(1278, 1324)}
`,
);

write(
  "report/index.ts",
  `export { composePublishedMarkdown } from "@/lib/nex-intelligence/report/compose-published-markdown";
export { buildDeterministicFallbackReport } from "@/lib/nex-intelligence/report/deterministic-fallback";
`,
);

write(
  "ai-output/index.ts",
  `export * from "@/lib/nex-intelligence/ai-output/types";
export * from "@/lib/nex-intelligence/ai-output/schemas";
export * from "@/lib/nex-intelligence/ai-output/normalize-drafts";
export {
  extractJsonObject,
  parseStructuredAnalysis,
  emptyStructuredPayload,
  mergeStructuredPayloads,
  needsStructuralRegeneration,
} from "@/lib/nex-intelligence/ai-output/parse";
`,
);

// Thin orchestrate: process + prompts + facade re-exports
const processBody = slice(1326, 1741);
write(
  "validation/orchestrate.ts",
  `import type { MetaDataQualityReport } from "@/lib/nex-intelligence/quality/validate-export";
import type { NexMetaAnalysisV1 } from "@/lib/meta-export";
import {
  indexTracesById,
  type MetricTraceRecord,
} from "@/lib/nex-intelligence/trace";
import {
  syncTraceUsedByForClaim,
  tryCmsE1PartialRecovery,
  type CmsE1RecoveryAudit,
} from "@/lib/nex-intelligence/recovery/cms-e1";
import { NEX_INTELLIGENCE_ENGINE_VERSION } from "@/lib/nex-intelligence/versions";
import {
  emptyStructuredPayload,
  extractJsonObject,
  mergeStructuredPayloads,
  needsStructuralRegeneration,
  parseStructuredAnalysis,
} from "@/lib/nex-intelligence/ai-output/parse";
import type {
  AnalyticalStatus,
  ProcessRecommendationsResult,
  RecoveryAudit,
  RecommendationValidationAudit,
  SchemaFieldError,
  StructuredAnalysisPayload,
  ValidatedRecommendation,
} from "@/lib/nex-intelligence/ai-output/types";
import { validateRecommendationList } from "@/lib/nex-intelligence/validation/recommendations";
import { validateClaimList } from "@/lib/nex-intelligence/validation/claims";
import { sanitizeNarrativeText } from "@/lib/nex-intelligence/validation/narrative";
import {
  buildDeterministicFallbackReport,
  composePublishedMarkdown,
} from "@/lib/nex-intelligence/report";

export {
  buildCompromisedMetricIndex,
  metricIntegrityForAccountClaim,
  metricIntegrityForEntity,
  normalizeCanonicalMetric,
} from "@/lib/nex-intelligence/trace";

export type { EvidenceComparison, EvidenceLevel } from "@/lib/nex-intelligence/evidence/levels";
export type { CmsE1RecoveryAudit } from "@/lib/nex-intelligence/recovery/cms-e1";

export const META_AI_RECOMMENDATION_ENGINE = NEX_INTELLIGENCE_ENGINE_VERSION;

export * from "@/lib/nex-intelligence/ai-output/types";
export * from "@/lib/nex-intelligence/ai-output/schemas";
export {
  normalizeRecommendationDraft,
  normalizeClaimDraft,
} from "@/lib/nex-intelligence/ai-output/normalize-drafts";
export {
  extractJsonObject,
  parseStructuredAnalysis,
} from "@/lib/nex-intelligence/ai-output/parse";
export {
  buildEntityIndex,
  inferMetricsFromText,
  detectClaimKindFromText,
  resolveEntityFromText,
  formatZodIssues,
} from "@/lib/nex-intelligence/validation/entity-helpers";
export {
  validateStructuredRecommendation,
  validateRecommendationList,
} from "@/lib/nex-intelligence/validation/recommendations";
export {
  validateStructuredClaim,
  validateClaimList,
} from "@/lib/nex-intelligence/validation/claims";
export { sanitizeNarrativeText } from "@/lib/nex-intelligence/validation/narrative";
export {
  composePublishedMarkdown,
  buildDeterministicFallbackReport,
} from "@/lib/nex-intelligence/report";

${processBody}
`,
);

write(
  "validation/index.ts",
  `export * from "@/lib/nex-intelligence/validation/orchestrate";
`,
);

console.log("split complete");
