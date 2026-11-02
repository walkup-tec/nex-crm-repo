import assert from "node:assert/strict";
import { processMetaAiRecommendations } from "@/lib/nex-intelligence/validation/orchestrate";
import type { MetaDataQualityReport } from "@/lib/nex-intelligence/quality/validate-export";
import type { NexMetaAnalysisV1 } from "@/lib/meta-export";

const quality: MetaDataQualityReport = {
  status: "PASS",
  engine_version: "1.2.0",
  protocol_version: "1.2.0",
  validated_at: "2026-11-02T00:00:00.000Z",
  checks: [],
  affected_metrics: [],
  compromised_metrics: [],
  verified_metrics: ["ctr", "cpc"],
  computed_metrics: {
    spend_cents: 10000,
    impressions: 1000,
    clicks: 50,
    results: 10,
    ctr: 5,
    cpc: 2,
    cpm: 100,
    cost_per_result: 10,
  },
};

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
      insights: {
        spend: 100,
        impressions: 1000,
        reach: 800,
        frequency: 1.2,
        clicks: 50,
        link_clicks: null,
        ctr: 5,
        link_ctr: null,
        cpc: 2,
        link_cpc: null,
        cpm: 100,
        results: 10,
        cost_per_result: 10,
      },
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

const traceBlock = {
  version: "1.0",
  records: [
    {
      trace_id: "trace-cms-ctr",
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
      used_by: ["rec-cms"],
    },
  ],
};

const rawMonitor = JSON.stringify({
  format: "nex_intelligence_analysis_v1_1_8",
  stage1_markdown: "Integridade ok.",
  observations: [],
  recommendations: [
    {
      id: "rec-cms",
      entity_id: "camp_ok",
      level: "campaign",
      indicators_used: ["ctr", "cpc"],
      evidence: ["CTR 5%", "CPC alto sem trace"],
      hypothesis: null,
      confidence: "medium",
      recommended_action: "Monitorar CTR e CPC",
      action_kind: "monitor",
      validation_criterion: "Manter leitura semanal",
      trace_ids: ["trace-cms-ctr"],
    },
  ],
  executive_points: [],
  metric_traceability: traceBlock,
  stage2_markdown: "",
  stage4_markdown: "",
});

let regenCalls = 0;
const result = await processMetaAiRecommendations({
  rawText: rawMonitor,
  payload,
  quality,
  regenerate: async () => {
    regenCalls += 1;
    return JSON.stringify({ recommendations: [] });
  },
  regenerateStructural: async () => {
    regenCalls += 1;
    return rawMonitor;
  },
});

assert.equal(regenCalls, 0, "CMS recovery must run before any OpenAI#2 regen");
assert.ok(
  result.audit.recovery.cms_e1_decisions?.some((row) => row.applied),
  "CMS-E1 decision recorded",
);
assert.ok(result.approved.some((row) => row.id === "rec-cms"), "Monitor recovered via CMS");

console.log("run-meta-analysis.pipeline.test.ts: ok");
