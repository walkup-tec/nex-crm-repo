import { claimIrSchema, isClaimOperation, type ClaimIR } from "@/lib/nex-intelligence/claim-ir/schema";
import { normalizeCanonicalMetric } from "@/lib/nex-intelligence/trace";

/**
 * Normaliza proposta da IA ou claim legado v1.2 para Claim IR.
 * Nunca usa texto livre como prova — apenas mapeia estrutura.
 */
export function normalizeClaimIRDraft(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const row = { ...(raw as Record<string, unknown>) };

  // Envelope legado StructuredClaim → METRIC_VALUE / MONITOR / etc.
  if (!row.operation && typeof row.claim_kind === "string") {
    const kind = String(row.claim_kind);
    const metrics = Array.isArray(row.metrics_used)
      ? (row.metrics_used as unknown[]).map((m) => normalizeCanonicalMetric(String(m)))
      : [];
    const traceIds = Array.isArray(row.trace_ids) ? (row.trace_ids as string[]) : [];
    const entityLevel = (row.level as ClaimIR["entity_level"]) || "account";
    const entityId = (row.entity_id as string | null) ?? null;
    const claimId = String(row.id || row.claim_id || "legacy-claim");

    if (kind === "descriptive") {
      return {
        claim_id: claimId,
        operation: "METRIC_VALUE",
        entity_level: entityLevel,
        entity_id: entityId,
        args: { metric: metrics[0] || "ctr" },
        metric_refs: traceIds,
        comparison_ref: null,
        hypothesis_ref: null,
        action_ref: null,
      };
    }
    if (kind === "performance_judgment") {
      return {
        claim_id: claimId,
        operation: "QUALITATIVE_CLASSIFICATION",
        entity_level: entityLevel,
        entity_id: entityId,
        args: {
          metric: metrics[0] || "ctr",
          label: "unspecified",
          criterion: "legacy_judgment",
        },
        metric_refs: traceIds,
        comparison_ref: row.comparison_ref ?? null,
        hypothesis_ref: null,
        action_ref: null,
      };
    }
    if (kind === "indirect_recommendation") {
      return {
        claim_id: claimId,
        operation: "STRATEGIC_TEST",
        entity_level: entityLevel === "account" ? "campaign" : entityLevel,
        entity_id: entityId || "unknown",
        args: {
          action_kind: "other",
          action: String(row.text || "legacy_action"),
          hypothesis: "legacy",
          validation_criterion: "legacy",
        },
        metric_refs: traceIds,
        comparison_ref: null,
        hypothesis_ref: null,
        action_ref: null,
      };
    }
  }

  if (typeof row.operation === "string" && !isClaimOperation(row.operation)) {
    return row; // validate will reject UNSUPPORTED_OPERATION
  }

  if (row.claim_id == null && row.id != null) row.claim_id = row.id;
  if (Array.isArray(row.metric_refs)) {
    row.metric_refs = row.metric_refs.map((id: unknown) => String(id));
  }
  if (Array.isArray(row.trace_ids) && (!row.metric_refs || !(row.metric_refs as unknown[]).length)) {
    row.metric_refs = row.trace_ids;
  }

  return row;
}

export function parseClaimIR(raw: unknown): ClaimIR | null {
  const normalized = normalizeClaimIRDraft(raw);
  const parsed = claimIrSchema.safeParse(normalized);
  return parsed.success ? parsed.data : null;
}
