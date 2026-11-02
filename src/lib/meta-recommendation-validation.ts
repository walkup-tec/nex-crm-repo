import { z } from "zod";
import type { MetaDataQualityReport, DataQualityStatus } from "@/lib/meta-data-quality";
import type { NexMetaAnalysisV1 } from "@/lib/meta-export";

export const META_AI_RECOMMENDATION_ENGINE = "1.1.2";

export type RecommendationLevel = "campaign" | "adset" | "ad";
export type RecommendationVerdict = "APPROVED" | "REJECTED" | "NEEDS_REVIEW";
export type RecommendationActionKind =
  | "scale_budget"
  | "pause"
  | "replace_creative"
  | "test"
  | "monitor"
  | "other";

const BLOCKING_STATES = new Set<DataQualityStatus>(["FAIL", "WARNING", "NOT_VERIFIABLE"]);

const METRIC_ALIASES: Record<string, string[]> = {
  results: ["results", "result", "resultados", "cost_per_result", "custo_por_resultado", "cpr"],
  spend: ["spend", "investimento", "cost_per_result", "custo_por_resultado", "cpr", "cpc", "cpm"],
  impressions: ["impressions", "impressoes", "impressões", "cpm", "ctr", "frequency", "frequencia", "frequência"],
  reach: ["reach", "alcance", "frequency", "frequencia", "frequência"],
  clicks: ["clicks", "cliques", "ctr", "cpc"],
  ctr: ["ctr"],
  cpc: ["cpc"],
  cpm: ["cpm"],
  frequency: ["frequency", "frequencia", "frequência", "saturacao", "saturação"],
  cost_per_result: ["cost_per_result", "custo_por_resultado", "cpr", "results", "spend"],
};

const EXTERNAL_COMMERCIAL_MARKERS =
  /\b(crm|vendas?|receita|roi\b|roas\b|faturamento|agendamento|whatsapp\s+oficial\s+do\s+crm|lead\s+qualificado\s+no\s+crm|ticket\s+m[eé]dio)\b/i;

export const structuredRecommendationSchema = z.object({
  id: z.string().min(1),
  entity_id: z.string().min(1),
  level: z.enum(["campaign", "adset", "ad"]),
  indicators_used: z.array(z.string().min(1)).min(1),
  evidence: z.array(z.string().min(1)).default([]),
  hypothesis: z.string().nullable().optional(),
  confidence: z.enum(["low", "medium", "high"]),
  recommended_action: z.string().min(1),
  action_kind: z.enum(["scale_budget", "pause", "replace_creative", "test", "monitor", "other"]),
  validation_criterion: z.string().min(1),
  arbitrary_targets: z
    .array(
      z.object({
        metric: z.string().min(1),
        value: z.number(),
        foundation: z.string().nullable().optional(),
      }),
    )
    .optional()
    .default([]),
  uses_external_commercial_data: z.boolean().optional().default(false),
});

export type StructuredRecommendation = z.infer<typeof structuredRecommendationSchema>;

export const structuredAnalysisSchema = z.object({
  format: z.string().optional(),
  stage1_markdown: z.string().default(""),
  stage2_markdown: z.string().default(""),
  recommendations: z.array(z.unknown()).default([]),
  stage4_markdown: z.string().default(""),
});

export type StructuredAnalysisPayload = {
  format?: string;
  stage1_markdown: string;
  stage2_markdown: string;
  recommendations: StructuredRecommendation[];
  stage4_markdown: string;
  parse_ok: boolean;
  parse_error?: string;
};

export type ValidatedRecommendation = StructuredRecommendation & {
  verdict: RecommendationVerdict;
  rejection_reasons: string[];
  blocked_by: Array<{
    entity_id: string;
    metric: string;
    check_code: string | null;
    state: DataQualityStatus;
  }>;
};

export type RecommendationValidationAudit = {
  engine_version: string;
  validated_at: string;
  parse_ok: boolean;
  parse_error?: string;
  regeneration_attempted: boolean;
  recommendations: ValidatedRecommendation[];
  published_recommendation_ids: string[];
  rejected_recommendation_ids: string[];
  needs_review_ids: string[];
};

export type ProcessRecommendationsResult = {
  publishedMarkdown: string;
  audit: RecommendationValidationAudit;
  approved: ValidatedRecommendation[];
  rejected: ValidatedRecommendation[];
  needsReview: ValidatedRecommendation[];
};

function normalizeMetric(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function expandIndicators(indicators: string[]): string[] {
  const out = new Set<string>();
  for (const indicator of indicators) {
    const key = normalizeMetric(indicator);
    out.add(key);
    for (const [base, aliases] of Object.entries(METRIC_ALIASES)) {
      if (key === base || aliases.includes(key)) {
        out.add(base);
        for (const alias of aliases) out.add(alias);
      }
    }
  }
  return [...out];
}

export function buildEntityIndex(payload: NexMetaAnalysisV1) {
  const campaigns = new Map(payload.campaigns.map((row) => [row.id, row]));
  const adsets = new Map(payload.adsets.map((row) => [row.id, row]));
  const ads = new Map(payload.ads.map((row) => [row.id, row]));
  return { campaigns, adsets, ads, accountId: payload.account.id };
}

/** Métricas bloqueadas por entidade (FAIL|WARNING|NOT_VERIFIABLE), com checagens de conta. */
export function buildCompromisedMetricIndex(report: MetaDataQualityReport) {
  const byEntity = new Map<string, Map<string, { code: string; state: DataQualityStatus }>>();
  const accountWide = new Map<string, { code: string; state: DataQualityStatus }>();

  for (const check of report.checks) {
    if (!BLOCKING_STATES.has(check.state)) continue;
    const metric = normalizeMetric(check.metric);
    const entry = { code: check.code, state: check.state };
    if (check.level === "account" || !check.entity_id) {
      accountWide.set(metric, entry);
      for (const alias of expandIndicators([metric])) {
        if (!accountWide.has(alias)) accountWide.set(alias, entry);
      }
      continue;
    }
    if (!byEntity.has(check.entity_id)) byEntity.set(check.entity_id, new Map());
    const map = byEntity.get(check.entity_id)!;
    map.set(metric, entry);
    for (const alias of expandIndicators([metric])) {
      if (!map.has(alias)) map.set(alias, entry);
    }
  }

  return { byEntity, accountWide };
}

export function metricIntegrityForEntity(
  index: ReturnType<typeof buildCompromisedMetricIndex>,
  entityId: string,
  metricRaw: string,
): { blocked: boolean; metric: string; code: string | null; state: DataQualityStatus | null } {
  const metric = normalizeMetric(metricRaw);
  const candidates = expandIndicators([metric]);
  for (const candidate of candidates) {
    const local = index.byEntity.get(entityId)?.get(candidate);
    if (local) return { blocked: true, metric: candidate, code: local.code, state: local.state };
    const account = index.accountWide.get(candidate);
    if (account) return { blocked: true, metric: candidate, code: account.code, state: account.state };
  }
  return { blocked: false, metric, code: null, state: null };
}

function entityExists(
  index: ReturnType<typeof buildEntityIndex>,
  level: RecommendationLevel,
  entityId: string,
): boolean {
  if (level === "campaign") return index.campaigns.has(entityId);
  if (level === "adset") return index.adsets.has(entityId);
  return index.ads.has(entityId);
}

function hasArbitraryUnfoundedTargets(rec: StructuredRecommendation): boolean {
  return (rec.arbitrary_targets ?? []).some((target) => !target.foundation || !String(target.foundation).trim());
}

function mentionsArbitraryTargetInText(rec: StructuredRecommendation): boolean {
  const blob = `${rec.recommended_action} ${rec.validation_criterion} ${rec.hypothesis ?? ""}`;
  return /(?:meta|alvo|target|abaixo de|acima de|menor que|maior que)\s*(?:de\s*)?R?\$?\s*\d+([.,]\d+)?/i.test(
    blob,
  );
}

function evidenceSufficient(rec: StructuredRecommendation): boolean {
  const evidences = (rec.evidence ?? []).filter((item) => item.trim().length > 0);
  if (rec.action_kind === "monitor" || rec.action_kind === "test") return evidences.length >= 1;
  if (rec.action_kind === "scale_budget" || rec.action_kind === "pause" || rec.action_kind === "replace_creative") {
    return evidences.length >= 2 && rec.indicators_used.length >= 2;
  }
  return evidences.length >= 1 && rec.indicators_used.length >= 1;
}

function usesExternalCommercial(rec: StructuredRecommendation): boolean {
  if (rec.uses_external_commercial_data) return true;
  const blob = [
    rec.recommended_action,
    rec.validation_criterion,
    rec.hypothesis ?? "",
    ...(rec.evidence ?? []),
  ].join(" ");
  return EXTERNAL_COMMERCIAL_MARKERS.test(blob);
}

export function validateStructuredRecommendation(
  raw: unknown,
  payload: NexMetaAnalysisV1,
  quality: MetaDataQualityReport,
): ValidatedRecommendation {
  const parsed = structuredRecommendationSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      id: typeof (raw as { id?: unknown })?.id === "string" ? String((raw as { id: string }).id) : "invalid",
      entity_id: "",
      level: "campaign",
      indicators_used: [],
      evidence: [],
      hypothesis: null,
      confidence: "low",
      recommended_action: "",
      action_kind: "other",
      validation_criterion: "",
      arbitrary_targets: [],
      uses_external_commercial_data: false,
      verdict: "REJECTED",
      rejection_reasons: [`schema_invalid: ${parsed.error.issues.map((i) => i.message).join("; ")}`],
      blocked_by: [],
    };
  }

  const rec = parsed.data;
  const reasons: string[] = [];
  const blockedBy: ValidatedRecommendation["blocked_by"] = [];
  const entities = buildEntityIndex(payload);
  const integrity = buildCompromisedMetricIndex(quality);

  if (!entityExists(entities, rec.level, rec.entity_id)) {
    reasons.push(`entity_not_found:${rec.level}:${rec.entity_id}`);
  }

  for (const indicator of rec.indicators_used) {
    const hit = metricIntegrityForEntity(integrity, rec.entity_id, indicator);
    if (hit.blocked && hit.state) {
      reasons.push(`metric_compromised:${hit.metric}:${hit.state}`);
      blockedBy.push({
        entity_id: rec.entity_id,
        metric: hit.metric,
        check_code: hit.code,
        state: hit.state,
      });
    }
  }

  if (rec.action_kind === "scale_budget") {
    const resultsHit = metricIntegrityForEntity(integrity, rec.entity_id, "results");
    const spendHit = metricIntegrityForEntity(integrity, rec.entity_id, "spend");
    const cprHit = metricIntegrityForEntity(integrity, rec.entity_id, "cost_per_result");
    if (resultsHit.blocked || spendHit.blocked || cprHit.blocked) {
      reasons.push("scale_blocked_by_compromised_results_or_spend");
    }
  }

  if (rec.action_kind === "pause" && rec.indicators_used.length < 2) {
    reasons.push("pause_on_single_indicator");
  }

  if (!evidenceSufficient(rec)) {
    reasons.push("insufficient_evidence");
  }

  if (hasArbitraryUnfoundedTargets(rec) || (mentionsArbitraryTargetInText(rec) && !(rec.arbitrary_targets ?? []).some((t) => t.foundation))) {
    reasons.push("arbitrary_target_without_foundation");
  }

  if (usesExternalCommercial(rec)) {
    reasons.push("external_commercial_data");
  }

  if (/\b(comprovado|prova(do)?|causalidade certa|erro comprovado)\b/i.test(rec.hypothesis ?? "") && (rec.evidence?.length ?? 0) < 2) {
    reasons.push("causality_without_evidence");
  }

  if (/\bsatura/i.test(`${rec.recommended_action} ${rec.hypothesis ?? ""}`) && !rec.indicators_used.map(normalizeMetric).includes("frequency")) {
    reasons.push("saturation_without_frequency");
  }

  let verdict: RecommendationVerdict = "APPROVED";
  if (reasons.length) {
    const softOnly =
      reasons.every((r) => r === "arbitrary_target_without_foundation") &&
      !reasons.some((r) => r.startsWith("metric_compromised") || r === "entity_not_found" || r === "external_commercial_data");
    verdict = softOnly ? "NEEDS_REVIEW" : "REJECTED";
  }

  return {
    ...rec,
    verdict,
    rejection_reasons: reasons,
    blocked_by: blockedBy,
  };
}

export function validateRecommendationList(
  items: unknown[],
  payload: NexMetaAnalysisV1,
  quality: MetaDataQualityReport,
): ValidatedRecommendation[] {
  return items.map((item) => validateStructuredRecommendation(item, payload, quality));
}

export function extractJsonObject(text: string): unknown | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    /* continue */
  }
  const fence = trimmed.match(/```(?:json|nex-intelligence)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) {
    try {
      return JSON.parse(fence[1].trim());
    } catch {
      /* continue */
    }
  }
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(trimmed.slice(start, end + 1));
    } catch {
      return null;
    }
  }
  return null;
}

export function parseStructuredAnalysis(text: string): StructuredAnalysisPayload {
  const raw = extractJsonObject(text);
  if (!raw || typeof raw !== "object") {
    return {
      stage1_markdown: "",
      stage2_markdown: "",
      recommendations: [],
      stage4_markdown: "",
      parse_ok: false,
      parse_error: "structured_json_missing",
    };
  }
  const base = structuredAnalysisSchema.safeParse(raw);
  if (!base.success) {
    return {
      stage1_markdown: "",
      stage2_markdown: "",
      recommendations: [],
      stage4_markdown: "",
      parse_ok: false,
      parse_error: `structured_schema_invalid: ${base.error.issues[0]?.message ?? "unknown"}`,
    };
  }
  const recommendations: StructuredRecommendation[] = [];
  for (const item of base.data.recommendations) {
    const parsed = structuredRecommendationSchema.safeParse(item);
    if (parsed.success) recommendations.push(parsed.data);
  }
  if (base.data.recommendations.length > 0 && recommendations.length === 0) {
    return {
      stage1_markdown: base.data.stage1_markdown,
      stage2_markdown: base.data.stage2_markdown,
      recommendations: [],
      stage4_markdown: base.data.stage4_markdown,
      parse_ok: false,
      parse_error: "recommendations_failed_schema",
    };
  }
  return {
    format: base.data.format,
    stage1_markdown: base.data.stage1_markdown,
    stage2_markdown: base.data.stage2_markdown,
    recommendations,
    stage4_markdown: base.data.stage4_markdown,
    parse_ok: true,
  };
}

function renderApprovedMarkdown(approved: ValidatedRecommendation[]): string {
  if (!approved.length) {
    return "_Nenhuma recomendação aprovada após validação determinística pós-IA._";
  }
  return approved
    .map((rec, index) => {
      return [
        `### ${index + 1}. ${rec.recommended_action}`,
        `- Entidade: ${rec.level} \`${rec.entity_id}\``,
        `- Indicadores: ${rec.indicators_used.join(", ")}`,
        `- Evidências: ${rec.evidence.join(" | ")}`,
        `- Hipótese: ${rec.hypothesis ?? "—"}`,
        `- Confiança: ${rec.confidence}`,
        `- Critério de validação: ${rec.validation_criterion}`,
        `- Status: APPROVED`,
      ].join("\n");
    })
    .join("\n\n");
}

function renderLimitations(
  quality: MetaDataQualityReport,
  rejected: ValidatedRecommendation[],
  needsReview: ValidatedRecommendation[],
  parseError?: string,
): string {
  const lines: string[] = [];
  if (parseError) {
    lines.push(`- Falha estrutural na resposta da IA: \`${parseError}\`. Recomendações não verificadas não foram publicadas.`);
  }
  if (quality.status !== "PASS") {
    lines.push(
      `- data_quality.status = ${quality.status}; métricas afetadas: ${quality.affected_metrics.join(", ") || "n/d"}.`,
    );
  }
  for (const rec of [...rejected, ...needsReview]) {
    lines.push(
      `- Recomendação \`${rec.id}\` (${rec.verdict}) omitida: ${rec.rejection_reasons.join("; ") || "sem justificativa"}.`,
    );
  }
  if (!lines.length) return "_Sem limitações adicionais registradas._";
  return lines.join("\n");
}

function sanitizeExecutiveSummary(
  stage4: string,
  approved: ValidatedRecommendation[],
  rejected: ValidatedRecommendation[],
): string {
  let text = stage4.trim();
  for (const rec of rejected) {
    if (rec.recommended_action.trim()) {
      const escaped = rec.recommended_action.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      text = text.replace(new RegExp(escaped, "gi"), "[ação omitida — rejeitada na validação]");
    }
  }
  const approvedActions = approved.map((rec) => `- ${rec.recommended_action} (\`${rec.entity_id}\`)`);
  const block = [
    text || "_Resumo descritivo indisponível._",
    "",
    "**Recomendações aprovadas (somente estas são ações válidas):**",
    approvedActions.length ? approvedActions.join("\n") : "- Nenhuma recomendação aprovada.",
  ].join("\n");
  return block;
}

export function composePublishedMarkdown(input: {
  stage1: string;
  stage2: string;
  stage4: string;
  approved: ValidatedRecommendation[];
  rejected: ValidatedRecommendation[];
  needsReview: ValidatedRecommendation[];
  quality: MetaDataQualityReport;
  parseError?: string;
}): string {
  return [
    "## Etapa 1 — Validação dos dados",
    input.stage1.trim() || `_Status determinístico: ${input.quality.status}._`,
    "",
    "## Etapa 2 — Análise independente",
    input.stage2.trim() || "_Análise descritiva indisponível._",
    "",
    "## Etapa 3 — Recomendações",
    "### Recomendações aprovadas",
    renderApprovedMarkdown(input.approved),
    "",
    "### Limitações relevantes",
    renderLimitations(input.quality, input.rejected, input.needsReview, input.parseError),
    "",
    "## Etapa 4 — Resumo executivo",
    sanitizeExecutiveSummary(input.stage4, input.approved, input.rejected),
  ].join("\n");
}

export async function processMetaAiRecommendations(input: {
  rawText: string;
  payload: NexMetaAnalysisV1;
  quality: MetaDataQualityReport;
  now?: string;
  regenerate?: (invalid: ValidatedRecommendation[]) => Promise<string>;
}): Promise<ProcessRecommendationsResult> {
  const now = input.now ?? new Date().toISOString();
  const parsed = parseStructuredAnalysis(input.rawText);

  if (!parsed.parse_ok) {
    const audit: RecommendationValidationAudit = {
      engine_version: META_AI_RECOMMENDATION_ENGINE,
      validated_at: now,
      parse_ok: false,
      parse_error: parsed.parse_error,
      regeneration_attempted: false,
      recommendations: [],
      published_recommendation_ids: [],
      rejected_recommendation_ids: [],
      needs_review_ids: [],
    };
    return {
      publishedMarkdown: composePublishedMarkdown({
        stage1: parsed.stage1_markdown,
        stage2: parsed.stage2_markdown,
        stage4: parsed.stage4_markdown,
        approved: [],
        rejected: [],
        needsReview: [],
        quality: input.quality,
        parseError: parsed.parse_error,
      }),
      audit,
      approved: [],
      rejected: [],
      needsReview: [],
    };
  }

  let validated = validateRecommendationList(parsed.recommendations, input.payload, input.quality);
  let regenerationAttempted = false;

  const invalid = validated.filter((row) => row.verdict !== "APPROVED");
  if (invalid.length && input.regenerate) {
    regenerationAttempted = true;
    try {
      const regeneratedText = await input.regenerate(invalid);
      const regeneratedParsed = extractJsonObject(regeneratedText);
      let candidates: unknown[] = [];
      if (Array.isArray(regeneratedParsed)) {
        candidates = regeneratedParsed;
      } else if (regeneratedParsed && typeof regeneratedParsed === "object") {
        const row = regeneratedParsed as { recommendations?: unknown[] };
        if (Array.isArray(row.recommendations)) candidates = row.recommendations;
      }
      const revalidated = validateRecommendationList(candidates, input.payload, input.quality);
      const byId = new Map(validated.map((row) => [row.id, row]));
      for (const row of revalidated) {
        byId.set(row.id, row);
      }
      // Drop original invalids that were not successfully replaced with APPROVED.
      for (const original of invalid) {
        const current = byId.get(original.id);
        if (!current || current.verdict !== "APPROVED") {
          byId.set(original.id, current ?? original);
        }
      }
      validated = [...byId.values()];
    } catch {
      regenerationAttempted = true;
    }
  }

  const approved = validated.filter((row) => row.verdict === "APPROVED");
  const rejected = validated.filter((row) => row.verdict === "REJECTED");
  const needsReview = validated.filter((row) => row.verdict === "NEEDS_REVIEW");

  const audit: RecommendationValidationAudit = {
    engine_version: META_AI_RECOMMENDATION_ENGINE,
    validated_at: now,
    parse_ok: true,
    regeneration_attempted: regenerationAttempted,
    recommendations: validated,
    published_recommendation_ids: approved.map((row) => row.id),
    rejected_recommendation_ids: rejected.map((row) => row.id),
    needs_review_ids: needsReview.map((row) => row.id),
  };

  return {
    publishedMarkdown: composePublishedMarkdown({
      stage1: parsed.stage1_markdown,
      stage2: parsed.stage2_markdown,
      stage4: parsed.stage4_markdown,
      approved,
      rejected,
      needsReview,
      quality: input.quality,
    }),
    audit,
    approved,
    rejected,
    needsReview,
  };
}

export function regenerationUserPrompt(invalid: ValidatedRecommendation[], payload: NexMetaAnalysisV1) {
  return [
    "Regenere APENAS as recomendações inválidas abaixo em JSON válido.",
    'Formato: { "recommendations": [ ...mesmo schema estruturado... ] }',
    "Não invente recomendações substitutas sem evidência Meta verificável.",
    "Não use métricas comprometidas nem dados comerciais externos.",
    "",
    "Inválidas:",
    JSON.stringify(
      invalid.map((row) => ({
        id: row.id,
        verdict: row.verdict,
        reasons: row.rejection_reasons,
        previous: row,
      })),
      null,
      2,
    ),
    "",
    "Contexto resumido da conta:",
    JSON.stringify({
      account_id: payload.account.id,
      campaign_ids: payload.campaigns.map((c) => c.id),
      adset_ids: payload.adsets.map((a) => a.id),
      ad_ids: payload.ads.map((a) => a.id),
    }),
  ].join("\n");
}
