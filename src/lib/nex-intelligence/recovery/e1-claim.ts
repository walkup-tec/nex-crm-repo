import type { MetaDataQualityReport } from "@/lib/nex-intelligence/quality/validate-export";
import type { NexMetaAnalysisV1 } from "@/lib/meta-export";
import {
  normalizeCanonicalMetric,
  type MetricTraceRecord,
} from "@/lib/nex-intelligence/trace";
import {
  textHasUnfoundedQualitativeLabel,
  type EvidenceLevel,
} from "@/lib/nex-intelligence/evidence/levels";
import {
  classifyMetricsTraceValidity,
  type CmsE1RecoveryAudit,
} from "@/lib/nex-intelligence/recovery/cms-e1";

const MONITORABLE = new Set([
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

function formatMetricLabel(metric: string): string {
  const m = normalizeCanonicalMetric(metric);
  if (m === "ctr" || m === "link_ctr") return "CTR";
  if (m === "cpc" || m === "link_cpc") return "CPC";
  if (m === "cpm") return "CPM";
  if (m === "cost_per_result") return "CPR";
  if (m === "impressions") return "impressões";
  if (m === "clicks") return "cliques";
  if (m === "reach") return "alcance";
  if (m === "frequency") return "frequência";
  return m.toUpperCase();
}

function formatClaimNumber(value: number): string {
  if (!Number.isFinite(value)) return "";
  const raw = Number.isInteger(value) ? String(value) : String(value);
  return raw.replace(".", ",");
}

/** Monta afirmação numérica neutra a partir de traces PASS (sem juízo qualitativo). */
export function rewriteNeutralClaimText(input: {
  metrics: string[];
  traceIds: string[];
  traces: Map<string, MetricTraceRecord>;
}): string | null {
  const parts: string[] = [];
  for (const rawMetric of input.metrics) {
    const metric = normalizeCanonicalMetric(rawMetric);
    if (!MONITORABLE.has(metric)) continue;
    const matching = input.traceIds
      .map((id) => input.traces.get(id))
      .filter((row): row is MetricTraceRecord => Boolean(row))
      .filter((row) => normalizeCanonicalMetric(row.metric) === metric);
    const withValue = matching.find((row) => typeof row.calculation.result === "number");
    if (!withValue || typeof withValue.calculation.result !== "number") continue;
    const formatted = formatClaimNumber(withValue.calculation.result);
    if (!formatted) continue;
    parts.push(`${formatMetricLabel(metric)} de ${formatted}`);
  }
  if (!parts.length) return null;
  if (parts.length === 1) {
    return `No período analisado, registrou-se ${parts[0]}.`;
  }
  return `No período analisado, registrou-se ${parts.join("; ")}.`;
}

/**
 * Recuperação E1 para observações / resumo executivo:
 * se o texto traz juízo qualitativo sem E2, substitui por fato numérico neutro
 * baseado só em traces PASS, para revalidação determinística.
 */
export function tryE1ClaimNeutralRecovery(input: {
  id: string;
  entity_id: string | null;
  level: "account" | "campaign" | "adset" | "ad";
  metrics_used: string[];
  trace_ids: string[];
  text: string;
  traces: Map<string, MetricTraceRecord>;
  payload: NexMetaAnalysisV1;
  quality: MetaDataQualityReport;
}): {
  recovered: null | {
    text: string;
    metrics_used: string[];
    trace_ids: string[];
    claim_kind: "descriptive";
  };
  audit: CmsE1RecoveryAudit;
  evidence_level: EvidenceLevel;
} {
  const emptyAudit: CmsE1RecoveryAudit = {
    applied: false,
    discarded_metrics: [],
    kept_metrics: [],
    discarded_trace_ids: [],
    reason: "e1_claim_not_applicable",
    reasons_detail: [],
  };

  if (!textHasUnfoundedQualitativeLabel(input.text)) {
    return { recovered: null, audit: emptyAudit, evidence_level: "E0" };
  }

  if (!input.entity_id || input.level === "account") {
    return {
      recovered: null,
      audit: { ...emptyAudit, reason: "e1_claim_account_scope_unsupported" },
      evidence_level: "E0",
    };
  }

  const classified = classifyMetricsTraceValidity({
    metrics: input.metrics_used.length ? input.metrics_used : ["ctr"],
    traceIds: input.trace_ids,
    traces: input.traces,
    payload: input.payload,
    quality: input.quality,
    entityId: input.entity_id,
    entityLevel: input.level,
    claimId: input.id,
  });

  const kept = classified.filter((row) => row.ok && MONITORABLE.has(row.metric));
  const discarded = classified.filter((row) => !row.ok || !MONITORABLE.has(row.metric));

  if (!kept.length) {
    return {
      recovered: null,
      audit: {
        applied: false,
        discarded_metrics: discarded.map((d) => d.metric),
        kept_metrics: [],
        discarded_trace_ids: [],
        reason: "e1_claim_no_valid_metrics",
        reasons_detail: discarded.map((d) => `${d.metric}:${d.reason ?? "invalid"}`),
      },
      evidence_level: "E0",
    };
  }

  const keptMetrics = kept.map((k) => k.metric);
  const keptTraceIds = [...new Set(kept.flatMap((k) => k.trace_ids))];
  const discardedTraceIds = input.trace_ids.filter((id) => !keptTraceIds.includes(id));
  const neutral = rewriteNeutralClaimText({
    metrics: keptMetrics,
    traceIds: keptTraceIds,
    traces: input.traces,
  });

  if (!neutral || textHasUnfoundedQualitativeLabel(neutral)) {
    return {
      recovered: null,
      audit: {
        applied: false,
        discarded_metrics: discarded.map((d) => d.metric),
        kept_metrics: keptMetrics,
        discarded_trace_ids: discardedTraceIds,
        reason: "e1_claim_neutral_rewrite_failed",
        reasons_detail: discarded.map((d) => `${d.metric}:${d.reason ?? "invalid"}`),
      },
      evidence_level: "E0",
    };
  }

  return {
    recovered: {
      text: neutral,
      metrics_used: keptMetrics,
      trace_ids: keptTraceIds,
      claim_kind: "descriptive",
    },
    audit: {
      applied: true,
      discarded_metrics: discarded.map((d) => d.metric),
      kept_metrics: keptMetrics,
      discarded_trace_ids: discardedTraceIds,
      reason: "e1_claim_qualitative_neutralized",
      reasons_detail: discarded.map((d) => `${d.metric}:${d.reason ?? "metric_without_valid_trace"}`),
    },
    evidence_level: "E1",
  };
}
