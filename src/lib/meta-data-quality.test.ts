import assert from "node:assert/strict";
import { buildChatgptMetaAnalysisPayload } from "./chatgpt-integration";
import {
  attachDataQuality,
  recommendationBlockedForMetric,
  validateMetaAnalysisData,
} from "./meta-data-quality";
import type { MetaAiExecutionDetail } from "./meta-ai-calibration";
import type { NexMetaAnalysisV1 } from "./meta-export";

function basePayload(partial: Partial<NexMetaAnalysisV1> = {}): NexMetaAnalysisV1 {
  return {
    schema_version: "1.0.0",
    metadata: {
      source: "NEX",
      exported_at: "2026-11-02T15:00:00-03:00",
      currency: "BRL",
      data_status: "live",
      organization_id: "org-1",
      client_name: "MMS",
    },
    account: { id: "act_1", name: "Conta" },
    period: { since: "2026-10-19", until: "2026-11-01", timezone: "America/Sao_Paulo" },
    attribution: { setting: "unified", note: "ok" },
    campaigns: [],
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
    ...partial,
  };
}

const emptyInsights = {
  spend: null,
  impressions: null,
  reach: null,
  frequency: null,
  clicks: null,
  link_clicks: null,
  ctr: null,
  link_ctr: null,
  cpc: null,
  link_cpc: null,
  cpm: null,
  results: null,
  cost_per_result: null,
};

// Teste A — total determinístico
{
  const report = validateMetaAnalysisData(
    basePayload({
      campaigns: [
        {
          id: "c1",
          name: "Geral",
          objective: null,
          status: "PAUSED",
          effective_status: "PAUSED",
          buying_type: null,
          daily_budget: null,
          lifetime_budget: null,
          optimization_goal: null,
          result_metric: "onsite_conversion.messaging_conversation_started_7d",
          insights: { ...emptyInsights, spend: 81.05 },
          daily_insights: [],
          attribution_setting: null,
        },
        {
          id: "c2",
          name: "Corban",
          objective: null,
          status: "PAUSED",
          effective_status: "PAUSED",
          buying_type: null,
          daily_budget: null,
          lifetime_budget: null,
          optimization_goal: null,
          result_metric: null,
          insights: { ...emptyInsights, spend: 78.17 },
          daily_insights: [],
          attribution_setting: null,
        },
        {
          id: "c3",
          name: "Nex Ads",
          objective: null,
          status: "PAUSED",
          effective_status: "PAUSED",
          buying_type: null,
          daily_budget: null,
          lifetime_budget: null,
          optimization_goal: null,
          result_metric: null,
          insights: { ...emptyInsights, spend: 27.64 },
          daily_insights: [],
          attribution_setting: null,
        },
      ],
    }),
  );
  assert.equal(report.computed_metrics.spend_total, 186.86);
  assert.equal(report.checks.find((item) => item.code === "ACCOUNT_SPEND_TOTAL")?.state, "PASS");
  assert.ok(report.verified_metrics.includes("spend"));
  assert.ok(!report.verified_metrics.includes("entity_id"));
}

// Teste B — resultados divergentes (messaging → NOT_VERIFIABLE)
{
  const report = validateMetaAnalysisData(
    basePayload({
      campaigns: [
        {
          id: "120254698455700651",
          name: "Geral",
          objective: "OUTCOME_ENGAGEMENT",
          status: "PAUSED",
          effective_status: "PAUSED",
          buying_type: null,
          daily_budget: null,
          lifetime_budget: null,
          optimization_goal: null,
          result_metric: "onsite_conversion.messaging_conversation_started_7d",
          insights: { ...emptyInsights, spend: 81.05, results: 1 },
          daily_insights: Array.from({ length: 11 }, (_, index) => ({
            date: `2026-10-${String(index + 1).padStart(2, "0")}`,
            spend: null,
            impressions: null,
            reach: null,
            clicks: null,
            link_clicks: null,
            results: 1,
          })),
          attribution_setting: null,
        },
      ],
    }),
  );
  const check = report.checks.find((item) => item.code === "CAMPAIGN_RESULTS_DAILY_VS_CONSOLIDATED");
  assert.ok(check);
  assert.equal(check?.consolidated_value, 1);
  assert.equal(check?.compared_value, 11);
  assert.equal(check?.state, "NOT_VERIFIABLE");
}

// Teste C — investimento hierárquico 78.17 vs 64.76
{
  const report = validateMetaAnalysisData(
    basePayload({
      campaigns: [
        {
          id: "camp-corban",
          name: "Corban",
          objective: null,
          status: null,
          effective_status: null,
          buying_type: null,
          daily_budget: null,
          lifetime_budget: null,
          optimization_goal: null,
          result_metric: null,
          insights: { ...emptyInsights, spend: 78.17 },
          daily_insights: [],
          attribution_setting: null,
        },
      ],
      adsets: [
        {
          id: "adset-corban",
          campaign_id: "camp-corban",
          name: "Conjunto",
          status: null,
          effective_status: null,
          optimization_goal: null,
          billing_event: null,
          daily_budget: null,
          lifetime_budget: null,
          targeting_summary: null,
          placements: null,
          attribution_setting: null,
          insights: { ...emptyInsights, spend: 78.17 },
          daily_insights: [],
        },
      ],
      ads: [
        {
          id: "ad-1",
          campaign_id: "camp-corban",
          adset_id: "adset-corban",
          name: "A1",
          status: null,
          effective_status: null,
          creative: { id: null, format: null, headline: null, body: null, destination_type: null },
          insights: { ...emptyInsights, spend: 40 },
          daily_insights: [],
        },
        {
          id: "ad-2",
          campaign_id: "camp-corban",
          adset_id: "adset-corban",
          name: "A2",
          status: null,
          effective_status: null,
          creative: { id: null, format: null, headline: null, body: null, destination_type: null },
          insights: { ...emptyInsights, spend: 24.76 },
          daily_insights: [],
        },
      ],
    }),
  );
  const check = report.checks.find((item) => item.code === "ADSET_SPEND_VS_ADS");
  assert.equal(check?.absolute_diff, 13.41);
  assert.equal(check?.state, "WARNING");
}

// Teste D — hierarquia ausente
{
  const report = validateMetaAnalysisData(
    basePayload({
      ads: [
        {
          id: "ad-orphan",
          campaign_id: "camp-x",
          adset_id: "120253137743650651",
          name: "Órfão",
          status: null,
          effective_status: null,
          creative: { id: null, format: null, headline: null, body: null, destination_type: null },
          insights: emptyInsights,
          daily_insights: [],
        },
      ],
    }),
  );
  assert.ok(report.checks.some((item) => item.code === "HIERARCHY_AD_ADSET" && item.state === "WARNING"));
}

// Teste E — métrica ausente
{
  const report = validateMetaAnalysisData(
    basePayload({
      campaigns: [
        {
          id: "empty",
          name: "Vazia",
          objective: null,
          status: null,
          effective_status: null,
          buying_type: null,
          daily_budget: null,
          lifetime_budget: null,
          optimization_goal: null,
          result_metric: null,
          insights: emptyInsights,
          daily_insights: [],
          attribution_setting: null,
        },
      ],
    }),
  );
  assert.ok(report.checks.some((item) => item.code === "CAMPAIGN_METRICS_ABSENT"));
  assert.equal(report.computed_metrics.spend_total, null);
  assert.equal(report.computed_metrics.cost_per_result, null);
}

// Teste F — recomendações bloqueadas para métrica comprometida
{
  const report = validateMetaAnalysisData(
    basePayload({
      campaigns: [
        {
          id: "c-div",
          name: "Divergente",
          objective: null,
          status: null,
          effective_status: null,
          buying_type: null,
          daily_budget: null,
          lifetime_budget: null,
          optimization_goal: null,
          result_metric: "lead",
          insights: { ...emptyInsights, spend: 50, results: 1 },
          daily_insights: [
            {
              date: "2026-10-01",
              spend: null,
              impressions: null,
              reach: null,
              clicks: null,
              link_clicks: null,
              results: 5,
            },
            {
              date: "2026-10-02",
              spend: null,
              impressions: null,
              reach: null,
              clicks: null,
              link_clicks: null,
              results: 6,
            },
          ],
          attribution_setting: null,
        },
      ],
    }),
  );
  assert.equal(recommendationBlockedForMetric(report, "results"), true);
}

// Teste G — business_outcomes externos não alteram validação
{
  const withSales = basePayload({
    business_outcomes: {
      leads_received: null,
      qualified_leads: null,
      appointments: null,
      sales: null,
      revenue: null,
    },
    campaigns: [
      {
        id: "c1",
        name: "C1",
        objective: null,
        status: null,
        effective_status: null,
        buying_type: null,
        daily_budget: null,
        lifetime_budget: null,
        optimization_goal: null,
        result_metric: null,
        insights: { ...emptyInsights, spend: 10, impressions: 1000, clicks: 20 },
        daily_insights: [],
        attribution_setting: null,
      },
    ],
  });
  const tainted = {
    ...withSales,
    business_outcomes: {
      ...withSales.business_outcomes,
      sales: 999,
      revenue: 50000,
    },
  } as unknown as NexMetaAnalysisV1;
  const clean = validateMetaAnalysisData(withSales);
  const dirty = validateMetaAnalysisData(tainted);
  assert.equal(clean.computed_metrics.spend_total, dirty.computed_metrics.spend_total);
  assert.equal(clean.status, dirty.status);
}

// Teste H — regressão estrutural do payload ChatGPT (campos obrigatórios)
{
  const payload = attachDataQuality(
    basePayload({
      campaigns: [
        {
          id: "c1",
          name: "C1",
          objective: null,
          status: null,
          effective_status: null,
          buying_type: null,
          daily_budget: null,
          lifetime_budget: null,
          optimization_goal: null,
          result_metric: null,
          insights: { ...emptyInsights, spend: 10 },
          daily_insights: [],
          attribution_setting: null,
        },
      ],
    }),
    validateMetaAnalysisData(
      basePayload({
        campaigns: [
          {
            id: "c1",
            name: "C1",
            objective: null,
            status: null,
            effective_status: null,
            buying_type: null,
            daily_budget: null,
            lifetime_budget: null,
            optimization_goal: null,
            result_metric: null,
            insights: { ...emptyInsights, spend: 10 },
            daily_insights: [],
            attribution_setting: null,
          },
        ],
      }),
    ),
  );
  const detail: MetaAiExecutionDetail = {
    id: "e994f60b-6355-4301-9fc5-47756b1e6022",
    createdAt: "2026-11-02T18:00:00.000Z",
    status: "ok",
    organizationId: "org-1",
    clientName: "MMS",
    accountId: "act_1",
    accountName: "Conta",
    periodSince: "2026-10-19",
    periodUntil: "2026-11-01",
    periodTimezone: "America/Sao_Paulo",
    protocolVersion: "1.1.1",
    dataContractVersion: "1.0.0",
    model: "gpt-4o-mini",
    promptHash: "hash",
    warningCount: 0,
    analysisMarkdown: "# Análise",
    warnings: [],
    errorMessage: "",
    inputJson: payload,
    outputJson: { analysis_markdown: "# Análise" },
    calibrationFeedback: {},
  };
  const chatgpt = buildChatgptMetaAnalysisPayload(detail);
  assert.equal(chatgpt.execution_id, detail.id);
  assert.ok(Array.isArray(chatgpt.campaigns));
  assert.ok(chatgpt.account.id);
  assert.equal(chatgpt.availability.input_json, true);
  assert.ok(!JSON.stringify(chatgpt).includes("sk-"));
  assert.ok(!JSON.stringify(chatgpt).includes("EAA"));
}

console.log("meta-data-quality.test.ts: ok");
