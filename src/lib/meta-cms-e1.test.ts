import assert from "node:assert/strict";
import type { MetaDataQualityReport } from "./meta-data-quality";
import type { NexMetaAnalysisV1 } from "./meta-export";
import { indexTracesById, type MetricTraceRecord } from "./meta-metric-traceability";
import {
  processMetaAiRecommendations,
  validateStructuredRecommendation,
} from "./meta-recommendation-validation";

const emptyInsights = {
  spend: null as number | null,
  impressions: null as number | null,
  reach: null as number | null,
  frequency: null as number | null,
  clicks: null as number | null,
  link_clicks: null as number | null,
  ctr: null as number | null,
  link_ctr: null as number | null,
  cpc: null as number | null,
  link_cpc: null as number | null,
  cpm: null as number | null,
  results: null as number | null,
  cost_per_result: null as number | null,
};

function insights(partial: Partial<typeof emptyInsights>) {
  return { ...emptyInsights, ...partial };
}

const payload: NexMetaAnalysisV1 = {
  schema_version: "1.0.0",
  metadata: {
    source: "NEX",
    exported_at: "2026-11-02T13:00:00-03:00",
    currency: "BRL",
    data_status: "live",
    organization_id: "org-1",
    client_name: "Walkup",
  },
  account: { id: "act_1", name: "Conta" },
  period: { since: "2026-10-01", until: "2026-10-31", timezone: "America/Sao_Paulo" },
  attribution: { setting: "unified", note: "" },
  campaigns: [
    {
      id: "camp_ok",
      name: "OK",
      objective: "OUTCOME_LEADS",
      status: "ACTIVE",
      effective_status: "ACTIVE",
      buying_type: null,
      daily_budget: null,
      lifetime_budget: null,
      optimization_goal: null,
      result_metric: "lead",
      insights: insights({
        spend: 100,
        impressions: 1000,
        clicks: 50,
        ctr: 5,
        cpc: 2,
        results: 10,
        cost_per_result: 10,
      }),
      daily_insights: [],
      attribution_setting: null,
    },
  ],
  adsets: [],
  ads: [],
  business_outcomes: {
    leads_received: null,
    qualified_leads: null,
    appointments: null,
    sales: null,
    revenue: null,
  },
  warnings: [],
};

const quality: MetaDataQualityReport = {
  status: "PASS",
  engine_version: "1.1.8",
  protocol_version: "1.1.8",
  validated_at: "2026-11-02T15:00:00.000Z",
  checks: [],
  affected_metrics: [],
  compromised_metrics: [],
  verified_metrics: ["ctr", "cpc", "clicks", "impressions"],
  computed_metrics: {
    currency: "BRL",
    spend_total: 100,
    spend_total_cents: 10000,
    impressions_total: 1000,
    clicks_total: 50,
    results_total: 10,
    ctr: 5,
    cpc: 2,
    cpm: null,
    cost_per_result: 10,
    basis: "campaign_insights_spend",
  },
};

function ctrTrace(claimId: string): MetricTraceRecord {
  return {
    trace_id: `trace-${claimId}-ctr`,
    entity_level: "campaign",
    entity_id: "camp_ok",
    metric: "ctr",
    source: "META_MARKETING_API",
    source_level: "campaign",
    source_field: "insights.clicks",
    period: { since: "2026-10-01", until: "2026-10-31" },
    calculation: {
      type: "RATIO",
      formula: "(clicks / impressions) * 100",
      inputs: { clicks: 50, impressions: 1000 },
      result: 5,
    },
    validation: { status: "PASS", dependencies: ["clicks", "impressions"], check_codes: [], reason: null },
    used_by: [claimId],
  };
}

// --- Caso 1 (8c30b013): CTR válido + CPC sem trace + monitor → APPROVED CMS-E1 ---
{
  const id = "rec-cms-1";
  const result = validateStructuredRecommendation(
    {
      id,
      entity_id: "camp_ok",
      level: "campaign",
      indicators_used: ["ctr", "cpc"],
      evidence: ["CTR 5% no período", "CPC de R$ 2 sem rastreio"],
      hypothesis: null,
      confidence: "medium",
      recommended_action: "Monitorar CTR e CPC da campanha OK",
      action_kind: "monitor",
      validation_criterion: "CTR e CPC em 7 dias",
      trace_ids: [`trace-${id}-ctr`],
    },
    payload,
    quality,
    indexTracesById({ version: "1.0", records: [ctrTrace(id)] }),
  );
  assert.equal(result.verdict, "APPROVED", `CMS1: ${result.rejection_reasons.join(",")}`);
  assert.deepEqual(result.indicators_used, ["ctr"]);
  assert.ok(!result.indicators_used.includes("cpc"));
  assert.ok(result.cms_e1_recovery?.applied);
  assert.ok(result.cms_e1_recovery?.discarded_metrics.includes("cpc"));
  assert.match(result.recommended_action, /CTR/i);
  assert.ok(!/CPC/i.test(result.recommended_action));
  assert.equal(result.evidence_level, "E1");
}

// --- Caso 2: CTR e CPC sem trace → REJECTED ---
{
  const result = validateStructuredRecommendation(
    {
      id: "rec-cms-2",
      entity_id: "camp_ok",
      level: "campaign",
      indicators_used: ["ctr", "cpc"],
      evidence: ["CTR", "CPC"],
      confidence: "low",
      recommended_action: "Monitorar indicadores",
      action_kind: "monitor",
      validation_criterion: "CTR",
      trace_ids: [],
    },
    payload,
    quality,
    indexTracesById({ version: "1.0", records: [] }),
  );
  assert.equal(result.verdict, "REJECTED", "CMS2");
}

// --- Caso 3: CTR válido + scale sem E3 → REJECTED (sem CMS) ---
{
  const id = "rec-cms-3";
  const result = validateStructuredRecommendation(
    {
      id,
      entity_id: "camp_ok",
      level: "campaign",
      indicators_used: ["ctr"],
      evidence: ["CTR 5%"],
      confidence: "medium",
      recommended_action: "Aumentar orçamento",
      action_kind: "scale_budget",
      validation_criterion: "CPR",
      trace_ids: [`trace-${id}-ctr`],
    },
    payload,
    quality,
    indexTracesById({ version: "1.0", records: [ctrTrace(id)] }),
  );
  assert.equal(result.verdict, "REJECTED", "CMS3 scale");
  assert.equal(result.cms_e1_recovery?.applied ?? false, false);
}

// --- Caso 4: CTR válido + replace_creative → REJECTED ---
{
  const id = "rec-cms-4";
  const result = validateStructuredRecommendation(
    {
      id,
      entity_id: "camp_ok",
      level: "campaign",
      indicators_used: ["ctr"],
      evidence: ["CTR 5%"],
      confidence: "medium",
      recommended_action: "Trocar criativo",
      action_kind: "replace_creative",
      validation_criterion: "CTR",
      trace_ids: [`trace-${id}-ctr`],
    },
    payload,
    quality,
    indexTracesById({ version: "1.0", records: [ctrTrace(id)] }),
  );
  assert.equal(result.verdict, "REJECTED", "CMS4 creative");
}

// --- Caso 5: monitor com label excelente + CTR válido → neutraliza/APPROVED ---
{
  const id = "rec-cms-5";
  const result = validateStructuredRecommendation(
    {
      id,
      entity_id: "camp_ok",
      level: "campaign",
      indicators_used: ["ctr"],
      evidence: ["CTR excelente de 5%"],
      confidence: "high",
      recommended_action: "Monitorar o CTR excelente da campanha OK",
      action_kind: "monitor",
      validation_criterion: "Manter desempenho excelente",
      trace_ids: [`trace-${id}-ctr`],
    },
    payload,
    quality,
    indexTracesById({ version: "1.0", records: [ctrTrace(id)] }),
  );
  assert.equal(result.verdict, "APPROVED", `CMS5: ${result.rejection_reasons.join(",")}`);
  assert.ok(!/excelente/i.test(result.recommended_action));
  assert.ok(result.cms_e1_recovery?.applied);
}

// --- Caso 6: entidade incorreta no trace → REJECTED ---
{
  const id = "rec-cms-6";
  const badTrace = { ...ctrTrace(id), entity_id: "camp_other", used_by: [id] };
  const result = validateStructuredRecommendation(
    {
      id,
      entity_id: "camp_ok",
      level: "campaign",
      indicators_used: ["ctr", "cpc"],
      evidence: ["CTR", "CPC"],
      confidence: "medium",
      recommended_action: "Monitorar CTR",
      action_kind: "monitor",
      validation_criterion: "CTR",
      trace_ids: [badTrace.trace_id],
    },
    payload,
    quality,
    indexTracesById({ version: "1.0", records: [badTrace] }),
  );
  assert.equal(result.verdict, "REJECTED", "CMS6 wrong entity");
}

// --- Caso 7: CMS suficiente ⇒ sem regenerate ---
{
  let regenCalls = 0;
  const id = "rec-cms-7";
  const processed = await processMetaAiRecommendations({
    rawText: JSON.stringify({
      format: "nex_intelligence_analysis_v1_1_8",
      stage1_markdown: "ok",
      observations: [],
      recommendations: [
        {
          id,
          entity_id: "camp_ok",
          level: "campaign",
          indicators_used: ["ctr", "cpc"],
          evidence: ["CTR 5%", "CPC sem trace"],
          confidence: "medium",
          recommended_action: "Monitorar CTR e CPC",
          action_kind: "monitor",
          validation_criterion: "CTR e CPC",
          trace_ids: [`trace-${id}-ctr`],
        },
      ],
      executive_points: [],
      metric_traceability: { version: "1.0", records: [ctrTrace(id)] },
      stage2_markdown: "",
      stage4_markdown: "",
    }),
    payload,
    quality,
    regenerate: async () => {
      regenCalls += 1;
      return "{}";
    },
  });
  assert.equal(regenCalls, 0, "CMS7 sem regen");
  assert.equal(processed.approved.length, 1, "CMS7 approved");
  assert.ok(processed.approved[0]?.cms_e1_recovery?.applied);
  assert.deepEqual(processed.approved[0]?.indicators_used, ["ctr"]);
}

console.log("meta-cms-e1.test.ts: ok (8c30b013 scenarios)");
