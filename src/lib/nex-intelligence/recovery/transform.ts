import type { MetaDataQualityReport } from "@/lib/nex-intelligence/quality/validate-export";
import type { NexMetaAnalysisV1 } from "@/lib/meta-export";
import type { MetricTraceRecord } from "@/lib/nex-intelligence/trace";
import type { ValidatedClaimIR } from "@/lib/nex-intelligence/claim-ir/validate";
import { validateClaimIR } from "@/lib/nex-intelligence/claim-ir/validate";
import type { ClaimIR } from "@/lib/nex-intelligence/claim-ir/schema";
import { normalizeCanonicalMetric } from "@/lib/nex-intelligence/trace";

export type RecoveryTransformAudit = {
  source_claim_id: string;
  transform: string;
  produced_claim_ids: string[];
  discarded: boolean;
  evidence_before: string;
  evidence_after: string | null;
};

/**
 * Recuperação por transformação estrutural (nunca sobe evidência sem prova nova).
 */
export function recoverClaimIRStructural(
  claim: ValidatedClaimIR,
  payload: NexMetaAnalysisV1,
  quality: MetaDataQualityReport,
  traces: Map<string, MetricTraceRecord>,
): { claims: ValidatedClaimIR[]; audit: RecoveryTransformAudit } {
  const evidenceBefore = claim.evidence_level;
  if (claim.verdict === "APPROVED") {
    return {
      claims: [claim],
      audit: {
        source_claim_id: claim.claim_id,
        transform: "noop",
        produced_claim_ids: [claim.claim_id],
        discarded: false,
        evidence_before: evidenceBefore,
        evidence_after: evidenceBefore,
      },
    };
  }

  // 8.1 / refs inválidas: tentar METRIC_VALUE só com scalars válidos (nunca nx-cmp)
  const validRefs = claim.metric_refs.filter((id) => {
    const row = traces.get(id);
    if (!row) return false;
    if (id.startsWith("nx-cmp-") || row.calculation.comparable === true) return false;
    if (row.validation.status === "FAIL" || row.validation.status === "NOT_VERIFIABLE") return false;
    return true;
  });

  if (
    claim.operation === "PERIOD_COMPARISON" ||
    claim.operation === "ENTITY_COMPARISON" ||
    claim.operation === "QUALITATIVE_CLASSIFICATION"
  ) {
    // 8.3 / 8.4 — remover comparação/juízo; preservar METRIC_VALUE se possível
    if (validRefs.length && "metric" in claim.args) {
      const metric = normalizeCanonicalMetric(String((claim.args as { metric: string }).metric));
      const draft: ClaimIR = {
        claim_id: `${claim.claim_id}__metric_value`,
        operation: "METRIC_VALUE",
        entity_level: claim.entity_level,
        entity_id: claim.entity_id,
        args: { metric },
        metric_refs: validRefs,
        comparison_ref: null,
        hypothesis_ref: null,
        action_ref: null,
      };
      const validated = validateClaimIR(draft, payload, quality, traces);
      const out = {
        ...validated,
        recovery_origin: `from:${claim.claim_id}:drop_comparison_or_qualitative`,
      };
      return {
        claims: out.verdict === "APPROVED" ? [out] : [],
        audit: {
          source_claim_id: claim.claim_id,
          transform: "drop_comparison_or_qualitative_to_metric_value",
          produced_claim_ids: out.verdict === "APPROVED" ? [out.claim_id] : [],
          discarded: out.verdict !== "APPROVED",
          evidence_before: evidenceBefore,
          evidence_after: out.verdict === "APPROVED" ? out.evidence_level : null,
        },
      };
    }
    return {
      claims: [],
      audit: {
        source_claim_id: claim.claim_id,
        transform: "drop_comparison_or_qualitative",
        produced_claim_ids: [],
        discarded: true,
        evidence_before: evidenceBefore,
        evidence_after: null,
      },
    };
  }

  if (claim.operation === "STRATEGIC_TEST" || claim.operation === "CAUSAL_HYPOTHESIS") {
    // 8.5 — descartar intervenção; MONITOR E1 se métricas válidas
    const metrics =
      claim.operation === "STRATEGIC_TEST"
        ? []
        : ((claim.args as { related_metric_refs?: string[] }).related_metric_refs ?? []);
    const monitorMetrics = (
      metrics.length
        ? metrics
        : claim.metric_refs
            .map((id) => traces.get(id)?.metric)
            .filter((m): m is string => Boolean(m))
    ).map(normalizeCanonicalMetric);

    const unique = [...new Set(monitorMetrics.length ? monitorMetrics : ["ctr"])];
    if (validRefs.length) {
      const draft: ClaimIR = {
        claim_id: `${claim.claim_id}__monitor`,
        operation: "MONITOR",
        entity_level: claim.entity_level,
        entity_id: claim.entity_id,
        args: {
          metrics: unique,
          validation_criterion: {
            type: "PERIODIC_REVIEW",
            metrics: unique,
            comparison: "SAME_METRIC_FUTURE_PERIOD",
          },
        },
        metric_refs: validRefs,
        comparison_ref: null,
        hypothesis_ref: null,
        action_ref: null,
      };
      const validated = validateClaimIR(draft, payload, quality, traces);
      const out = {
        ...validated,
        recovery_origin: `from:${claim.claim_id}:strategic_to_monitor`,
      };
      // Nunca subir evidência: MONITOR no máx E1
      if (out.verdict === "APPROVED" && out.evidence_level !== "E1" && out.evidence_level !== "E0") {
        out.evidence_level = "E1";
      }
      return {
        claims: out.verdict === "APPROVED" ? [out] : [],
        audit: {
          source_claim_id: claim.claim_id,
          transform: "strategic_or_causal_to_monitor",
          produced_claim_ids: out.verdict === "APPROVED" ? [out.claim_id] : [],
          discarded: out.verdict !== "APPROVED",
          evidence_before: evidenceBefore,
          evidence_after: out.verdict === "APPROVED" ? "E1" : null,
        },
      };
    }
    return {
      claims: [],
      audit: {
        source_claim_id: claim.claim_id,
        transform: "drop_strategic_or_causal",
        produced_claim_ids: [],
        discarded: true,
        evidence_before: evidenceBefore,
        evidence_after: null,
      },
    };
  }

  if (claim.operation === "METRIC_VALUE" && validRefs.length) {
    const draft: ClaimIR = {
      ...claim,
      metric_refs: validRefs,
      comparison_ref: null,
    };
    const validated = validateClaimIR(draft, payload, quality, traces);
    const out = { ...validated, recovery_origin: `from:${claim.claim_id}:rebind_refs` };
    return {
      claims: out.verdict === "APPROVED" ? [out] : [],
      audit: {
        source_claim_id: claim.claim_id,
        transform: "rebind_valid_refs",
        produced_claim_ids: out.verdict === "APPROVED" ? [out.claim_id] : [],
        discarded: out.verdict !== "APPROVED",
        evidence_before: evidenceBefore,
        evidence_after: out.verdict === "APPROVED" ? out.evidence_level : null,
      },
    };
  }

  return {
    claims: [],
    audit: {
      source_claim_id: claim.claim_id,
      transform: "reject",
      produced_claim_ids: [],
      discarded: true,
      evidence_before: evidenceBefore,
      evidence_after: null,
    },
  };
}

export function recoverClaimIRList(
  claims: ValidatedClaimIR[],
  payload: NexMetaAnalysisV1,
  quality: MetaDataQualityReport,
  traces: Map<string, MetricTraceRecord>,
): { claims: ValidatedClaimIR[]; audits: RecoveryTransformAudit[] } {
  const out: ValidatedClaimIR[] = [];
  const audits: RecoveryTransformAudit[] = [];
  for (const claim of claims) {
    const result = recoverClaimIRStructural(claim, payload, quality, traces);
    out.push(...result.claims);
    audits.push(result.audit);
  }
  return { claims: out, audits };
}

/** 8.6 — resumo neutro só a partir de METRIC_VALUE / MONITOR aprovados (IDs, sem claims novos). */
export function executiveClaimIdsFromApproved(approved: ValidatedClaimIR[]): string[] {
  return approved
    .filter((c) => c.operation === "METRIC_VALUE" || c.operation === "MONITOR")
    .map((c) => c.claim_id);
}
