/**
 * Aceite estrutural v1.2.0:
 * 4 campanhas × CTR verificável devem publicar 4 observações mesmo com traces IA errados/ausentes.
 */
import assert from "node:assert/strict";
import { attachDataQuality, validateMetaAnalysisData } from "@/lib/meta-data-quality";
import type { NexMetaAnalysisV1 } from "@/lib/meta-export";
import { processMetaAiRecommendations } from "@/lib/nex-intelligence/validation/orchestrate";
import { buildBackendMetricTraceCatalog } from "@/lib/nex-intelligence/trace/build-catalog";
import { runMetaAnalysis } from "@/lib/nex-intelligence/pipeline/run-meta-analysis";
import { META_AI_ANALYSIS_PROMPT } from "@/intelligence/meta-leads/protocol";

function campaign(id: string, name: string, clicks: number, impressions: number) {
  const ctr = Number(((clicks / impressions) * 100).toFixed(6));
  return {
    id,
    name,
    objective: "OUTCOME_TRAFFIC",
    status: "ACTIVE",
    effective_status: "ACTIVE",
    buying_type: "AUCTION",
    daily_budget: 100,
    lifetime_budget: null,
    optimization_goal: "LINK_CLICKS",
    result_metric: "link_click",
    insights: {
      spend: 50,
      impressions,
      reach: Math.floor(impressions * 0.8),
      frequency: 1.2,
      clicks,
      link_clicks: clicks,
      ctr,
      link_ctr: ctr,
      cpc: Number((50 / clicks).toFixed(6)),
      link_cpc: Number((50 / clicks).toFixed(6)),
      cpm: Number(((50 / impressions) * 1000).toFixed(6)),
      results: clicks,
      cost_per_result: Number((50 / clicks).toFixed(6)),
    },
    daily_insights: [],
    attribution_setting: null,
  };
}

const payloadBase: NexMetaAnalysisV1 = {
  schema_version: "1.0.0",
  metadata: {
    source: "NEX",
    exported_at: "2026-11-02T12:00:00.000Z",
    currency: "BRL",
    data_status: "live",
    organization_id: "org-accept",
    client_name: "Aceite CTR",
  },
  account: { id: "act-1", name: "Conta Aceite" },
  period: { since: "2026-10-19", until: "2026-11-01", timezone: "America/Sao_Paulo" },
  attribution: { setting: null, note: "" },
  campaigns: [
    campaign("cmp-1", "Campanha Alpha", 100, 10000),
    campaign("cmp-2", "Campanha Beta", 80, 8000),
    campaign("cmp-3", "Campanha Gamma", 60, 6000),
    campaign("cmp-4", "Campanha Delta", 40, 4000),
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

const quality = validateMetaAnalysisData(payloadBase, {
  protocolVersion: "1.2.0",
  engineVersion: "1.2.0",
});
const payload = attachDataQuality(payloadBase, quality);
const catalog = buildBackendMetricTraceCatalog(payload, quality);

assert.equal(catalog.records.filter((r) => r.metric === "ctr" && r.entity_level === "campaign").length, 4);

const aiWithWrongTraces = JSON.stringify({
  format: "nex_intelligence_analysis_v1_2_0",
  stage1_markdown: "Dados Meta ok.",
  observations: [
    {
      id: "obs-1",
      entity_id: "cmp-1",
      level: "campaign",
      metrics_used: ["ctr"],
      trace_ids: ["trace-WRONG-1"],
      claim_kind: "descriptive",
      text: "Campanha Alpha registrou CTR de 1% no período.",
    },
    {
      id: "obs-2",
      entity_id: "cmp-2",
      level: "campaign",
      metrics_used: ["ctr"],
      trace_ids: [],
      claim_kind: "descriptive",
      text: "Campanha Beta registrou CTR de 1% no período.",
    },
    {
      id: "obs-3",
      entity_id: "cmp-3",
      level: "campaign",
      metrics_used: ["ctr"],
      trace_ids: ["nx-tr-campaign-cmp-1-ctr"],
      claim_kind: "descriptive",
      text: "Campanha Gamma registrou CTR de 1% no período.",
    },
    {
      id: "obs-4",
      entity_id: "cmp-4",
      level: "campaign",
      metrics_used: ["ctr"],
      trace_ids: ["missing-trace"],
      claim_kind: "descriptive",
      text: "Campanha Delta registrou CTR de 1% no período.",
    },
  ],
  recommendations: [],
  executive_points: [],
  metric_traceability: {
    version: "1.0",
    records: [
      {
        trace_id: "trace-WRONG-1",
        entity_level: "campaign",
        entity_id: "cmp-2",
        metric: "ctr",
        source: "META_MARKETING_API",
        source_level: "campaign",
        source_field: "insights.clicks",
        period: { since: "2026-10-19", until: "2026-11-01" },
        calculation: {
          type: "RATIO",
          formula: "(clicks / impressions) * 100",
          inputs: { clicks: 999, impressions: 1 },
          result: 99900,
        },
        validation: { status: "PASS", dependencies: ["clicks", "impressions"], check_codes: [], reason: null },
        used_by: ["obs-1"],
      },
    ],
  },
  stage2_markdown: "",
  stage4_markdown: "",
});

{
  const result = await processMetaAiRecommendations({
    rawText: aiWithWrongTraces,
    payload,
    quality,
    backendTraceability: catalog,
  });
  const approvedObs = result.audit.observations.filter((row) => row.verdict === "APPROVED");
  assert.equal(approvedObs.length, 4, "quatro observações CTR devem ser APPROVED após rebind");
  for (const row of approvedObs) {
    assert.equal(row.evidence_level, "E1");
    assert.ok(row.trace_ids.some((id) => id.includes(row.entity_id ?? "")));
  }
  assert.match(result.publishedMarkdown, /Campanha Alpha/);
  assert.match(result.publishedMarkdown, /Campanha Beta/);
  assert.match(result.publishedMarkdown, /Campanha Gamma/);
  assert.match(result.publishedMarkdown, /Campanha Delta/);
  assert.ok((result.audit.recovery.backend_trace_catalog_size ?? 0) >= 4);
  assert.ok((result.audit.recovery.trace_rebinds ?? []).some((row) => row.applied));
}

{
  let openAiCalls = 0;
  const run = await runMetaAnalysis({
    payload,
    quality,
    promptHash: "accept-hash",
    analysisSystemPrompt: META_AI_ANALYSIS_PROMPT,
    structuralSystemPrompt: "structural",
    regenerationSystemPrompt: "regen",
    backendTraceability: catalog,
    requestOpenAi: async ({ user }) => {
      openAiCalls += 1;
      assert.match(user, /available_traces/);
      assert.match(user, /nx-tr-campaign-cmp-1-ctr/);
      return { text: aiWithWrongTraces, model: "test-model" };
    },
  });
  assert.equal(openAiCalls, 1);
  assert.equal(
    run.processed.audit.observations.filter((row) => row.verdict === "APPROVED").length,
    4,
  );
  assert.equal(run.pipelineContext.aiCallsUsed, 1);
}

// T4 — valor numérico inventado no texto não é reescrito; REJECTED.
{
  const forgedValue = JSON.stringify({
    format: "nex_intelligence_analysis_v1_2_0",
    stage1_markdown: "ok",
    observations: [
      {
        id: "obs-bad-value",
        entity_id: "cmp-4",
        level: "campaign",
        metrics_used: ["ctr"],
        trace_ids: ["nx-tr-campaign-cmp-4-ctr"],
        claim_kind: "descriptive",
        text: "Campanha Delta registrou CTR de 9,90% no período.",
      },
    ],
    recommendations: [],
    executive_points: [],
    metric_traceability: { version: "1.0", records: [] },
    stage2_markdown: "",
    stage4_markdown: "",
  });
  const bad = await processMetaAiRecommendations({
    rawText: forgedValue,
    payload,
    quality,
    backendTraceability: catalog,
  });
  const row = bad.audit.observations.find((o) => o.id === "obs-bad-value");
  assert.equal(row?.verdict, "REJECTED");
  assert.ok(row?.rejection_reasons.some((r) => r.startsWith("claim_value_mismatch")));
}

console.log("four-campaign-ctr-acceptance.test.ts: ok");
