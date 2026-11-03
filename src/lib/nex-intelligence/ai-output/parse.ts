import {
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

function parseClaimArray(
  items: unknown[],
  section: "observations" | "executive_points",
  attempt: SchemaFieldError["attempt"] = "initial",
): { claims: StructuredClaim[]; errors: SchemaFieldError[]; discarded: number } {
  const claims: StructuredClaim[] = [];
  const errors: SchemaFieldError[] = [];
  let discarded = 0;
  for (let i = 0; i < items.length; i++) {
    const parsed = structuredClaimSchema.safeParse(normalizeClaimDraft(items[i]));
    if (parsed.success) {
      claims.push(parsed.data);
      continue;
    }
    discarded += 1;
    for (const issue of formatZodIssues(parsed.error.issues, `${section}[${i}]`)) {
      errors.push({ path: issue.path, message: issue.message, section, attempt });
    }
  }
  return { claims, errors, discarded };
}

export function emptyStructuredPayload(
  partial: Partial<StructuredAnalysisPayload> & {
    parse_ok: boolean;
    parse_error?: string;
    schema_errors?: SchemaFieldError[];
  },
): StructuredAnalysisPayload {
  const emptyTrace: MetricTraceability = { version: "1.0", records: [] };
  const schema_errors = partial.schema_errors ?? [];
  const observations = partial.observations ?? [];
  const recommendations = partial.recommendations ?? [];
  const executive_points = partial.executive_points ?? [];
  const claim_ir = partial.claim_ir ?? [];
  const metric_traceability = partial.metric_traceability ?? emptyTrace;
  const has_recoverable_content =
    observations.length > 0 ||
    recommendations.length > 0 ||
    executive_points.length > 0 ||
    claim_ir.length > 0 ||
    metric_traceability.records.length > 0 ||
    Boolean(partial.stage1_markdown?.trim()) ||
    Boolean(partial.stage2_markdown?.trim()) ||
    Boolean(partial.stage4_markdown?.trim());
  return {
    ...(partial.format ? { format: partial.format } : {}),
    claim_ir,
    stage1_markdown: partial.stage1_markdown ?? "",
    stage2_markdown: partial.stage2_markdown ?? "",
    observations,
    recommendations,
    executive_points,
    stage4_markdown: partial.stage4_markdown ?? "",
    metric_traceability,
    parse_ok: partial.parse_ok,
    has_recoverable_content,
    ...(partial.parse_error ? { parse_error: partial.parse_error } : {}),
    schema_errors,
    discarded_recommendations: partial.discarded_recommendations ?? 0,
    discarded_observations: partial.discarded_observations ?? 0,
    discarded_executive_points: partial.discarded_executive_points ?? 0,
  };
}

export function parseStructuredAnalysis(
  text: string,
  attempt: SchemaFieldError["attempt"] = "initial",
): StructuredAnalysisPayload {
  const raw = extractJsonObject(text);
  if (!raw || typeof raw !== "object") {
    return emptyStructuredPayload({
      parse_ok: false,
      parse_error: "structured_json_missing",
      schema_errors: [
        {
          path: "(root)",
          message: "structured_json_missing",
          section: "envelope",
          attempt,
        },
      ],
    });
  }
  const base = structuredAnalysisSchema.safeParse(raw);
  if (!base.success) {
    return emptyStructuredPayload({
      parse_ok: false,
      parse_error: `structured_schema_invalid: ${base.error.issues[0]?.path?.join(".") || "(root)"}: ${base.error.issues[0]?.message ?? "unknown"}`,
      schema_errors: formatZodIssues(base.error.issues, "(root)").map((issue) => ({
        path: issue.path,
        message: issue.message,
        section: "envelope" as const,
        attempt,
      })),
    });
  }

  const schema_errors: SchemaFieldError[] = [];
  const recommendations: StructuredRecommendation[] = [];
  let discarded_recommendations = 0;
  for (let i = 0; i < base.data.recommendations.length; i++) {
    const parsed = structuredRecommendationSchema.safeParse(
      normalizeRecommendationDraft(base.data.recommendations[i]),
    );
    if (parsed.success) {
      recommendations.push(parsed.data);
      continue;
    }
    discarded_recommendations += 1;
    for (const issue of formatZodIssues(parsed.error.issues, `recommendations[${i}]`)) {
      schema_errors.push({
        path: issue.path,
        message: issue.message,
        section: "recommendations",
        attempt,
      });
    }
  }

  const obs = parseClaimArray(base.data.observations ?? [], "observations", attempt);
  const exec = parseClaimArray(base.data.executive_points ?? [], "executive_points", attempt);
  schema_errors.push(...obs.errors, ...exec.errors);

  const traceParsed = parseMetricTraceability(base.data.metric_traceability);
  for (const issue of traceParsed.issues ?? []) {
    schema_errors.push({
      path: issue.path,
      message: issue.message,
      section: "metric_traceability",
      attempt,
    });
  }

  const sectionErrors: string[] = [];
  if (base.data.recommendations.length > 0 && recommendations.length === 0) {
    sectionErrors.push("recommendations_failed_schema");
  }
  if (!traceParsed.ok && (base.data.metric_traceability != null)) {
    sectionErrors.push(`metric_traceability_invalid: ${traceParsed.error ?? "unknown"}`);
  }

  return emptyStructuredPayload({
    ...(base.data.format ? { format: base.data.format } : {}),
    claim_ir: base.data.claim_ir,
    stage1_markdown: base.data.stage1_markdown,
    stage2_markdown: base.data.stage2_markdown,
    observations: obs.claims,
    recommendations,
    executive_points: exec.claims,
    stage4_markdown: base.data.stage4_markdown,
    metric_traceability: traceParsed.value,
    parse_ok: true,
    ...(sectionErrors.length ? { parse_error: sectionErrors.join("; ") } : {}),
    schema_errors,
    discarded_recommendations,
    discarded_observations: obs.discarded,
    discarded_executive_points: exec.discarded,
  });
}

export function needsStructuralRegeneration(parsed: StructuredAnalysisPayload): boolean {
  if (!parsed.parse_ok) return true;
  const hasAnySection =
    parsed.observations.length > 0 ||
    parsed.recommendations.length > 0 ||
    parsed.executive_points.length > 0;
  if (parsed.claim_ir.length > 0) return false;
  if (!hasAnySection && parsed.schema_errors.some((e) => e.section !== "envelope")) return true;
  return false;
}

export function mergeStructuredPayloads(
  primary: StructuredAnalysisPayload,
  secondary: StructuredAnalysisPayload | null,
): StructuredAnalysisPayload {
  if (!secondary) return primary;
  const byObs = new Map(primary.observations.map((row) => [row.id, row]));
  for (const row of secondary.observations) byObs.set(row.id, row);
  const byRec = new Map(primary.recommendations.map((row) => [row.id, row]));
  for (const row of secondary.recommendations) byRec.set(row.id, row);
  const byExec = new Map(primary.executive_points.map((row) => [row.id, row]));
  for (const row of secondary.executive_points) byExec.set(row.id, row);
  const byTrace = new Map(primary.metric_traceability.records.map((row) => [row.trace_id, row]));
  for (const row of secondary.metric_traceability.records) byTrace.set(row.trace_id, row);
  return emptyStructuredPayload({
    ...(secondary.format ?? primary.format
      ? { format: secondary.format ?? primary.format }
      : {}),
    claim_ir: secondary.claim_ir.length ? secondary.claim_ir : primary.claim_ir,
    stage1_markdown: secondary.stage1_markdown || primary.stage1_markdown,
    stage2_markdown: secondary.stage2_markdown || primary.stage2_markdown,
    stage4_markdown: secondary.stage4_markdown || primary.stage4_markdown,
    observations: [...byObs.values()],
    recommendations: [...byRec.values()],
    executive_points: [...byExec.values()],
    metric_traceability: {
      version: secondary.metric_traceability.version || primary.metric_traceability.version || "1.0",
      records: [...byTrace.values()],
    },
    parse_ok: primary.parse_ok || secondary.parse_ok,
    ...([primary.parse_error, secondary.parse_error].filter(Boolean).join("; ")
      ? {
          parse_error: [primary.parse_error, secondary.parse_error]
            .filter(Boolean)
            .join("; "),
        }
      : {}),
    schema_errors: [...primary.schema_errors, ...secondary.schema_errors],
    discarded_recommendations: primary.discarded_recommendations + secondary.discarded_recommendations,
    discarded_observations: primary.discarded_observations + secondary.discarded_observations,
    discarded_executive_points: primary.discarded_executive_points + secondary.discarded_executive_points,
  });
}
