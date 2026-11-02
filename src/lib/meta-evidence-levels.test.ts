import assert from "node:assert/strict";
import {
  classifyAchievedEvidenceLevel,
  evidenceLevelAtLeast,
  requiredEvidenceLevelForAction,
  textHasUnfoundedQualitativeLabel,
  validateEvidenceComparison,
} from "./meta-evidence-levels";
import type { NexMetaAnalysisV1 } from "./meta-export";

const payload = {
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
      id: "c1",
      name: "A",
      objective: "OUTCOME_LEADS",
      status: "ACTIVE",
      effective_status: "ACTIVE",
      buying_type: null,
      daily_budget: null,
      lifetime_budget: null,
      optimization_goal: null,
      result_metric: "lead",
      insights: {
        spend: 1,
        impressions: 100,
        reach: null,
        frequency: null,
        clicks: 2,
        link_clicks: null,
        ctr: 2,
        link_ctr: null,
        cpc: null,
        link_cpc: null,
        cpm: null,
        results: 1,
        cost_per_result: 1,
      },
      daily_insights: [],
      attribution_setting: null,
    },
    {
      id: "c2",
      name: "B",
      objective: "OUTCOME_LEADS",
      status: "ACTIVE",
      effective_status: "ACTIVE",
      buying_type: null,
      daily_budget: null,
      lifetime_budget: null,
      optimization_goal: null,
      result_metric: "lead",
      insights: {
        spend: 1,
        impressions: 100,
        reach: null,
        frequency: null,
        clicks: 1,
        link_clicks: null,
        ctr: 1,
        link_ctr: null,
        cpc: null,
        link_cpc: null,
        cpm: null,
        results: 1,
        cost_per_result: 1,
      },
      daily_insights: [],
      attribution_setting: null,
    },
    {
      id: "c3",
      name: "C",
      objective: "OUTCOME_SALES",
      status: "ACTIVE",
      effective_status: "ACTIVE",
      buying_type: null,
      daily_budget: null,
      lifetime_budget: null,
      optimization_goal: null,
      result_metric: "purchase",
      insights: {
        spend: 1,
        impressions: 100,
        reach: null,
        frequency: null,
        clicks: 1,
        link_clicks: null,
        ctr: 1,
        link_ctr: null,
        cpc: null,
        link_cpc: null,
        cpm: null,
        results: 1,
        cost_per_result: 1,
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
} as NexMetaAnalysisV1;

assert.equal(requiredEvidenceLevelForAction("monitor"), "E1");
assert.equal(requiredEvidenceLevelForAction("replace_creative"), "E3");
assert.equal(requiredEvidenceLevelForAction("test"), "E3");
assert.equal(requiredEvidenceLevelForAction("scale_budget"), "E3");
assert.ok(evidenceLevelAtLeast("E3", "E2"));
assert.ok(!evidenceLevelAtLeast("E1", "E3"));
assert.ok(textHasUnfoundedQualitativeLabel("CTR elevado e aceitável"));
assert.ok(!textHasUnfoundedQualitativeLabel("CTR de 1,94% no período"));

const incompatible = validateEvidenceComparison(
  {
    type: "campaign_vs_campaign",
    entity_ids: ["c1", "c3"],
    compatible: true,
    absolute_difference: 1,
  },
  payload,
  "c1",
);
assert.equal(incompatible.ok, false);
assert.ok(incompatible.reasons.includes("comparison_incompatible_objectives"));

const compatible = validateEvidenceComparison(
  {
    type: "campaign_vs_campaign",
    entity_ids: ["c1", "c2"],
    compatible: true,
    absolute_difference: 1,
    relative_difference_pct: 100,
    volumes: { impressions_a: 100, impressions_b: 100 },
  },
  payload,
  "c1",
);
assert.equal(compatible.ok, true);

const e1 = classifyAchievedEvidenceLevel({
  baseOk: true,
  tracesOk: true,
  metricsCompromised: false,
  payload,
  primaryEntityId: "c1",
  forIntervention: false,
});
assert.equal(e1.level, "E1");

const e3 = classifyAchievedEvidenceLevel({
  baseOk: true,
  tracesOk: true,
  metricsCompromised: false,
  comparison: {
    type: "campaign_vs_campaign",
    entity_ids: ["c1", "c2"],
    compatible: true,
    absolute_difference: 1,
    volumes: { a: 1, b: 1 },
  },
  payload,
  primaryEntityId: "c1",
  hypothesis: "Criativo A gera mais cliques relativos",
  validationCriterion: "CTR em 7 dias",
  indicatorsUsed: ["ctr", "cpc"],
  forIntervention: true,
});
assert.equal(e3.level, "E3");

const ctrOnly = classifyAchievedEvidenceLevel({
  baseOk: true,
  tracesOk: true,
  metricsCompromised: false,
  comparison: {
    type: "campaign_vs_campaign",
    entity_ids: ["c1", "c2"],
    compatible: true,
    absolute_difference: 1,
    volumes: { a: 1, b: 1 },
  },
  payload,
  primaryEntityId: "c1",
  hypothesis: "h",
  validationCriterion: "c",
  indicatorsUsed: ["ctr"],
  forIntervention: true,
});
assert.equal(ctrOnly.level, "E2");
assert.ok(ctrOnly.reasons.some((r) => r.includes("ctr_only")));

console.log("meta-evidence-levels.test.ts: ok");
