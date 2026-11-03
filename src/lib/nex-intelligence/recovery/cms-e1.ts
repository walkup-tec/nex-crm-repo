import type { MetaDataQualityReport } from "@/lib/nex-intelligence/quality/validate-export";
import type { NexMetaAnalysisV1 } from "@/lib/meta-export";
import {
  computeDeterministicTraceStatus,
  normalizeCanonicalMetric,
  validateMetricTraceRecord,
  type MetricTraceRecord,
} from "@/lib/nex-intelligence/trace";
import {
  textHasStrategicInterventionInMonitor,
  textHasUnfoundedQualitativeLabel,
  type EvidenceLevel,
} from "@/lib/nex-intelligence/evidence/levels";

export type CmsE1RecoveryAudit = {
  applied: boolean;
  discarded_metrics: string[];
  kept_metrics: string[];
  discarded_trace_ids: string[];
  reason: string;
  reasons_detail: string[];
};

export type MetricTraceValidity = {
  metric: string;
  ok: boolean;
  reason: string | null;
  trace_ids: string[];
};

const MONITORABLE = new Set(["ctr", "link_ctr", "cpc", "link_cpc", "cpm", "impressions", "clicks", "reach", "frequency"]);

/** Avalia se cada métrica tem ao menos um trace PASS determinístico na entidade correta. */
export function classifyMetricsTraceValidity(input: {
  metrics: string[];
  traceIds: string[];
  traces: Map<string, MetricTraceRecord>;
  payload: NexMetaAnalysisV1;
  quality: MetaDataQualityReport;
  entityId: string;
  entityLevel: "campaign" | "adset" | "ad";
  claimId: string;
}): MetricTraceValidity[] {
  return input.metrics.map((rawMetric) => {
    const metric = normalizeCanonicalMetric(rawMetric);
    const matchingIds = input.traceIds.filter((id) => {
      const record = input.traces.get(id);
      if (!record) return false;
      return normalizeCanonicalMetric(record.metric) === metric;
    });

    if (matchingIds.length === 0) {
      return { metric, ok: false, reason: "metric_without_valid_trace", trace_ids: [] };
    }

    const validIds: string[] = [];
    let lastReason: string | null = null;
    for (const id of matchingIds) {
      const record = input.traces.get(id)!;
      if (record.source !== "META_MARKETING_API") {
        lastReason = "trace_source_not_meta";
        continue;
      }
      if (record.entity_id !== input.entityId || record.entity_level !== input.entityLevel) {
        lastReason = "trace_entity_mismatch";
        continue;
      }
      if (record.used_by.length && !record.used_by.includes(input.claimId)) {
        lastReason = "trace_not_linked_to_claim";
        continue;
      }
      const issues = validateMetricTraceRecord(record, input.payload, input.quality);
      if (issues.length) {
        lastReason = issues[0]?.reason ?? "trace_record_invalid";
        continue;
      }
      const deterministic = computeDeterministicTraceStatus(record, input.payload, input.quality);
      if (deterministic.status !== "PASS") {
        lastReason = `trace_validation_${deterministic.status.toLowerCase()}`;
        continue;
      }
      const period = input.payload.period;
      if (
        (record.period.since ?? null) !== (period.since ?? null) ||
        (record.period.until ?? null) !== (period.until ?? null)
      ) {
        lastReason = "trace_period_mismatch";
        continue;
      }
      validIds.push(id);
    }

    if (!validIds.length) {
      return { metric, ok: false, reason: lastReason ?? "metric_without_valid_trace", trace_ids: [] };
    }
    return { metric, ok: true, reason: null, trace_ids: validIds };
  });
}

function formatMetricLabel(metric: string): string {
  const m = normalizeCanonicalMetric(metric);
  if (m === "ctr" || m === "link_ctr") return "CTR";
  if (m === "cpc" || m === "link_cpc") return "CPC";
  if (m === "cpm") return "CPM";
  if (m === "cost_per_result") return "CPR";
  return m.toUpperCase();
}

function buildBackendEvidence(
  kept: MetricTraceValidity[],
  traces: Map<string, MetricTraceRecord>,
): string[] {
  return kept.flatMap((metric) => {
    const traceId = metric.trace_ids[0];
    const trace = traceId ? traces.get(traceId) : null;
    if (!trace || typeof trace.calculation.result !== "number") return [];
    const suffix = trace.calculation.unit === "percent" ? "%" : "";
    return [
      `${formatMetricLabel(metric.metric)} = ${trace.calculation.result}${suffix} ` +
        `(Meta Marketing API; trace ${trace.trace_id})`,
    ];
  });
}

export function rewriteNeutralMonitorAction(metrics: string[]): string {
  const labels = metrics.map(formatMetricLabel);
  if (labels.length === 1) return `Monitorar a evolução do ${labels[0]} da campanha`;
  return `Monitorar a evolução de ${labels.join(" e ")} da campanha`;
}

export function rewriteNeutralMonitorCriterion(metrics: string[]): string {
  const labels = metrics.map(formatMetricLabel);
  if (labels.length === 1) {
    return `Comparar o ${labels[0]} em períodos futuros compatíveis`;
  }
  return `Comparar ${labels.join(" e ")} em períodos futuros compatíveis`;
}

/**
 * CMS-E1: se monitor tiver ≥1 métrica com trace PASS e outras inválidas,
 * devolve versão reduzida apenas com evidências válidas (sem inventar dados).
 */
export function tryCmsE1PartialRecovery(input: {
  id: string;
  entity_id: string;
  level: "campaign" | "adset" | "ad";
  action_kind: string;
  indicators_used: string[];
  evidence: string[];
  trace_ids: string[];
  recommended_action: string;
  validation_criterion: string;
  hypothesis?: string | null;
  confidence: "low" | "medium" | "high";
  traces: Map<string, MetricTraceRecord>;
  payload: NexMetaAnalysisV1;
  quality: MetaDataQualityReport;
}): {
  recovered: null | {
    indicators_used: string[];
    evidence: string[];
    trace_ids: string[];
    recommended_action: string;
    validation_criterion: string;
    hypothesis: null;
  };
  audit: CmsE1RecoveryAudit;
  evidence_level: EvidenceLevel;
} {
  const emptyAudit: CmsE1RecoveryAudit = {
    applied: false,
    discarded_metrics: [],
    kept_metrics: [],
    discarded_trace_ids: [],
    reason: "cms_e1_not_applicable",
    reasons_detail: [],
  };

  if (input.action_kind !== "monitor") {
    return { recovered: null, audit: emptyAudit, evidence_level: "E0" };
  }

  const classified = classifyMetricsTraceValidity({
    metrics: input.indicators_used,
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
        reason: "cms_e1_no_valid_relevant_metrics",
        reasons_detail: discarded.map((d) => `${d.metric}:${d.reason ?? "invalid"}`),
      },
      evidence_level: "E0",
    };
  }

  const keptMetrics = kept.map((k) => k.metric);
  const keptTraceIds = [...new Set(kept.flatMap((k) => k.trace_ids))];
  const discardedMetrics = discarded.map((d) => d.metric);
  const discardedTraceIds = input.trace_ids.filter((id) => !keptTraceIds.includes(id));

  const originalBlob = `${input.recommended_action} ${input.validation_criterion} ${input.hypothesis ?? ""} ${(input.evidence ?? []).join(" ")}`;
  const needsNeutralRewrite =
    textHasUnfoundedQualitativeLabel(originalBlob) ||
    textHasStrategicInterventionInMonitor(originalBlob) ||
    discardedMetrics.length > 0;

  if (!needsNeutralRewrite && !discarded.length) {
    return {
      recovered: {
        indicators_used: keptMetrics,
        evidence: buildBackendEvidence(kept, input.traces),
        trace_ids: keptTraceIds,
        recommended_action: rewriteNeutralMonitorAction(keptMetrics),
        validation_criterion: rewriteNeutralMonitorCriterion(keptMetrics),
        hypothesis: null,
      },
      audit: {
        applied: true,
        discarded_metrics: [],
        kept_metrics: keptMetrics,
        discarded_trace_ids: [],
        reason: "cms_e1_already_sufficient",
        reasons_detail: [],
      },
      evidence_level: "E1",
    };
  }

  const action = rewriteNeutralMonitorAction(keptMetrics);
  const criterion = rewriteNeutralMonitorCriterion(keptMetrics);
  const evidence = buildBackendEvidence(kept, input.traces);

  // Se após limpeza sobrar label qualitativo, a recuperação falha (não inventamos texto novo além do template neutro).
  if (textHasUnfoundedQualitativeLabel(action) || textHasUnfoundedQualitativeLabel(criterion)) {
    return {
      recovered: null,
      audit: {
        applied: false,
        discarded_metrics: discardedMetrics,
        kept_metrics: keptMetrics,
        discarded_trace_ids: discardedTraceIds,
        reason: "cms_e1_qualitative_remains",
        reasons_detail: discarded.map((d) => `${d.metric}:${d.reason ?? "invalid"}`),
      },
      evidence_level: "E0",
    };
  }

  if (!criterion.trim()) {
    return {
      recovered: null,
      audit: {
        applied: false,
        discarded_metrics: discardedMetrics,
        kept_metrics: keptMetrics,
        discarded_trace_ids: discardedTraceIds,
        reason: "cms_e1_validation_criterion_unmeasurable",
        reasons_detail: [],
      },
      evidence_level: "E0",
    };
  }

  return {
    recovered: {
      indicators_used: keptMetrics,
      evidence,
      trace_ids: keptTraceIds,
      recommended_action: action,
      validation_criterion: criterion,
      hypothesis: null,
    },
    audit: {
      applied: true,
      discarded_metrics: discardedMetrics,
      kept_metrics: keptMetrics,
      discarded_trace_ids: discardedTraceIds,
      reason: discarded.map((d) => d.reason ?? "metric_without_valid_trace").join("; "),
      reasons_detail: discarded.map((d) => `${d.metric}:${d.reason ?? "metric_without_valid_trace"}`),
    },
    evidence_level: "E1",
  };
}

/** Sincroniza used_by dos traces: remove claimId dos descartados; garante nos mantidos. */
export function syncTraceUsedByForClaim(
  records: MetricTraceRecord[],
  claimId: string,
  keptTraceIds: string[],
  discardedTraceIds: string[],
): MetricTraceRecord[] {
  const kept = new Set(keptTraceIds);
  const discarded = new Set(discardedTraceIds);
  return records.map((row) => {
    if (kept.has(row.trace_id)) {
      const used = new Set(row.used_by);
      used.add(claimId);
      return { ...row, used_by: [...used] };
    }
    if (discarded.has(row.trace_id)) {
      return { ...row, used_by: row.used_by.filter((id) => id !== claimId) };
    }
    return row;
  });
}
