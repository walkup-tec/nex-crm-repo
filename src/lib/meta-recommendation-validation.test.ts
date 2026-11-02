import assert from "node:assert/strict";
import type { MetaDataQualityReport } from "./meta-data-quality";
import type { NexMetaAnalysisV1 } from "./meta-export";
import {
  composePublishedMarkdown,
  parseStructuredAnalysis,
  processMetaAiRecommendations,
  validateStructuredRecommendation,
  type StructuredRecommendation,
} from "./meta-recommendation-validation";
import { buildChatgptMetaAnalysisPayload } from "./chatgpt-integration";
import type { MetaAiExecutionDetail } from "./meta-ai-calibration";

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

function basePayload(): NexMetaAnalysisV1 {
  return {
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
          reach: 800,
          frequency: 1.2,
          clicks: 50,
          ctr: 5,
          cpc: 2,
          cpm: 100,
          results: 10,
          cost_per_result: 10,
        }),
        daily_insights: [],
        attribution_setting: null,
      },
      {
        id: "camp_bad",
        name: "BAD",
        objective: "OUTCOME_LEADS",
        status: "ACTIVE",
        effective_status: "ACTIVE",
        buying_type: null,
        daily_budget: null,
        lifetime_budget: null,
        optimization_goal: null,
        result_metric: "lead",
        insights: insights({
          spend: 50,
          impressions: 500,
          reach: 400,
          frequency: 1.1,
          clicks: 20,
          ctr: 4,
          cpc: 2.5,
          cpm: 100,
          results: 5,
          cost_per_result: 10,
        }),
        daily_insights: [],
        attribution_setting: null,
      },
    ],
    adsets: [
      {
        id: "adset_1",
        campaign_id: "camp_ok",
        name: "Conjunto",
        status: "ACTIVE",
        effective_status: "ACTIVE",
        optimization_goal: "OFFSITE_CONVERSIONS",
        billing_event: "IMPRESSIONS",
        daily_budget: null,
        lifetime_budget: null,
        targeting_summary: null,
        placements: null,
        attribution_setting: null,
        insights: insights({ spend: 100, impressions: 1000, clicks: 50, results: 10 }),
        daily_insights: [],
      },
    ],
    ads: [
      {
        id: "ad_1",
        adset_id: "adset_1",
        campaign_id: "camp_ok",
        name: "Anúncio",
        status: "ACTIVE",
        effective_status: "ACTIVE",
        creative: {
          id: null,
          format: null,
          headline: null,
          body: null,
          destination_type: null,
        },
        insights: insights({ spend: 100, impressions: 1000, clicks: 50, results: 10 }),
        daily_insights: [],
      },
    ],
    business_outcomes: {
      leads_received: null,
      qualified_leads: null,
      appointments: null,
      sales: null,
      revenue: null,
    },
    warnings: [],
  };
}

function qualityWithBadResults(): MetaDataQualityReport {
  return {
    status: "NOT_VERIFIABLE",
    engine_version: "1.1.2",
    protocol_version: "1.1.2",
    validated_at: "2026-11-02T15:00:00.000Z",
    checks: [
      {
        code: "CAMPAIGN_RESULTS_INCONSISTENT",
        level: "campaign",
        entity_id: "camp_bad",
        metric: "results",
        consolidated_value: 5,
        compared_value: 2,
        absolute_diff: 3,
        relative_diff: 0.6,
        severity: "NOT_VERIFIABLE",
        description: "Results inconsistentes",
        possible_causes: ["paginação"],
        state: "NOT_VERIFIABLE",
      },
      {
        code: "CAMPAIGN_SPEND_INCONSISTENT",
        level: "campaign",
        entity_id: "camp_bad",
        metric: "spend",
        consolidated_value: 50,
        compared_value: 40,
        absolute_diff: 10,
        relative_diff: 0.2,
        severity: "WARNING",
        description: "Spend inconsistente",
        possible_causes: ["paginação"],
        state: "WARNING",
      },
      {
        code: "CAMPAIGN_SPEND_OK",
        level: "campaign",
        entity_id: "camp_ok",
        metric: "spend",
        consolidated_value: 100,
        compared_value: 100,
        absolute_diff: 0,
        relative_diff: 0,
        severity: "PASS",
        description: "ok",
        possible_causes: [],
        state: "PASS",
      },
      {
        code: "CAMPAIGN_RESULTS_OK",
        level: "campaign",
        entity_id: "camp_ok",
        metric: "results",
        consolidated_value: 10,
        compared_value: 10,
        absolute_diff: 0,
        relative_diff: 0,
        severity: "PASS",
        description: "ok",
        possible_causes: [],
        state: "PASS",
      },
    ],
    affected_metrics: ["results", "spend"],
    compromised_metrics: ["spend"],
    verified_metrics: [],
    computed_metrics: {
      currency: "BRL",
      spend_total: 150,
      spend_total_cents: 15000,
      impressions_total: 1500,
      clicks_total: 70,
      results_total: 15,
      ctr: null,
      cpc: null,
      cpm: null,
      cost_per_result: null,
      basis: "campaign_insights_spend",
    },
  };
}

function goodRec(overrides: Partial<StructuredRecommendation> = {}): StructuredRecommendation {
  return {
    id: "rec-ok",
    entity_id: "camp_ok",
    level: "campaign",
    indicators_used: ["ctr", "cpc"],
    evidence: ["CTR 5% no período", "CPC estável em R$ 2"],
    hypothesis: "Criativo mantém atenção relativa",
    confidence: "medium",
    recommended_action: "Rodar teste A/B de copy mantendo orçamento",
    action_kind: "test",
    validation_criterion: "CTR e CPC após 7 dias",
    arbitrary_targets: [],
    uses_external_commercial_data: false,
    ...overrides,
  };
}

const payload = basePayload();
const quality = qualityWithBadResults();

// --- Teste A ---
{
  const scaleBad = validateStructuredRecommendation(
    goodRec({
      id: "rec-a",
      entity_id: "camp_bad",
      indicators_used: ["results", "cost_per_result", "spend"],
      evidence: ["CPR aparente 10", "Volume de resultados 5"],
      recommended_action: "Aumentar orçamento em 20%",
      action_kind: "scale_budget",
    }),
    payload,
    quality,
  );
  assert.equal(scaleBad.verdict, "REJECTED", "Teste A");
  assert.ok(scaleBad.rejection_reasons.some((r) => /compromised|scale_blocked/.test(r)), "Teste A reasons");
}

// --- Teste B ---
{
  const approved = validateStructuredRecommendation(goodRec({ id: "rec-b" }), payload, quality);
  assert.equal(approved.verdict, "APPROVED", "Teste B");
}

// --- Teste C ---
{
  const other = validateStructuredRecommendation(
    goodRec({
      id: "rec-c",
      entity_id: "camp_ok",
      indicators_used: ["spend", "ctr"],
      evidence: ["Spend reconciliado", "CTR 5%"],
      recommended_action: "Monitorar distribuição de investimento",
      action_kind: "monitor",
    }),
    payload,
    quality,
  );
  assert.equal(other.verdict, "APPROVED", "Teste C — campanha ok não bloqueada");
}

// --- Teste D ---
{
  const arbitrary = validateStructuredRecommendation(
    goodRec({
      id: "rec-d",
      recommended_action: "Reduzir custo por resultado para abaixo de R$ 8",
      action_kind: "other",
      indicators_used: ["ctr", "cpc"],
      evidence: ["CTR alto", "CPC estável"],
      arbitrary_targets: [{ metric: "cost_per_result", value: 8, foundation: null }],
    }),
    payload,
    quality,
  );
  assert.ok(arbitrary.verdict === "REJECTED" || arbitrary.verdict === "NEEDS_REVIEW", "Teste D");
}

// --- Teste E ---
{
  const missing = validateStructuredRecommendation(
    goodRec({ id: "rec-e", entity_id: "camp_inexistente" }),
    payload,
    quality,
  );
  assert.equal(missing.verdict, "REJECTED", "Teste E");
  assert.ok(missing.rejection_reasons.some((r) => r.startsWith("entity_not_found")), "Teste E reason");
}

// --- Teste F ---
{
  const commercial = validateStructuredRecommendation(
    goodRec({
      id: "rec-f",
      recommended_action: "Pausar campanha porque o CRM mostra poucas vendas",
      evidence: ["CTR 5%", "CPC 2"],
      indicators_used: ["ctr", "cpc"],
      action_kind: "pause",
      uses_external_commercial_data: true,
    }),
    payload,
    quality,
  );
  assert.equal(commercial.verdict, "REJECTED", "Teste F");
  assert.ok(commercial.rejection_reasons.includes("external_commercial_data"), "Teste F reason");
}

// --- Teste G ---
{
  const approved = validateStructuredRecommendation(goodRec({ id: "rec-g-ok" }), payload, quality);
  const rejected = validateStructuredRecommendation(
    goodRec({
      id: "rec-g-bad",
      entity_id: "camp_bad",
      action_kind: "scale_budget",
      indicators_used: ["results", "spend"],
      evidence: ["CPR", "volume"],
      recommended_action: "Aumentar orçamento da campanha ruim",
    }),
    payload,
    quality,
  );
  assert.equal(rejected.verdict, "REJECTED");
  const md = composePublishedMarkdown({
    stage1: "Integridade parcial.",
    stage2: "Análise descritiva.",
    stage4: "Priorize: Aumentar orçamento da campanha ruim e também teste de copy.",
    approved: [approved],
    rejected: [rejected],
    needsReview: [],
    quality,
  });
  assert.match(md, /Recomendações aprovadas/i, "Teste G seção");
  assert.match(md, /ação omitida — rejeitada/i, "Teste G omitida no resumo");
  assert.ok(!/Priorize: Aumentar orçamento da campanha ruim/.test(md), "Teste G sem ação rejeitada crua");
  assert.match(md, /Rodar teste A\/B de copy/i, "Teste G mantém aprovada");
}

// --- Teste H ---
{
  let regenerateCalls = 0;
  const structured = {
    format: "nex_intelligence_analysis_v1_1_2",
    stage1_markdown: "dq",
    stage2_markdown: "an",
    recommendations: [
      goodRec({
        id: "rec-h",
        entity_id: "camp_bad",
        action_kind: "scale_budget",
        indicators_used: ["results", "spend"],
        evidence: ["a", "b"],
        recommended_action: "Escalar campanha comprometida",
      }),
    ],
    stage4_markdown: "resumo",
  };
  const result = await processMetaAiRecommendations({
    rawText: JSON.stringify(structured),
    payload,
    quality,
    regenerate: async () => {
      regenerateCalls += 1;
      return JSON.stringify({
        recommendations: [
          goodRec({
            id: "rec-h",
            entity_id: "camp_bad",
            action_kind: "scale_budget",
            indicators_used: ["cost_per_result", "spend"],
            evidence: ["cpr", "spend"],
            recommended_action: "Escalar novamente",
          }),
        ],
      });
    },
  });
  assert.equal(regenerateCalls, 1, "Teste H regenerou");
  assert.equal(result.approved.length, 0, "Teste H sem approve");
  assert.ok(result.rejected.some((r) => r.id === "rec-h"), "Teste H ainda rejeitada");
  assert.equal(result.audit.regeneration_attempted, true, "Teste H audit");
}

// --- Teste I ---
{
  const broken = await processMetaAiRecommendations({
    rawText: "Isto não é JSON estruturado, só markdown com recomendações soltas.",
    payload,
    quality,
  });
  assert.equal(broken.audit.parse_ok, false, "Teste I parse");
  assert.equal(broken.approved.length, 0, "Teste I sem approve");
  assert.match(broken.publishedMarkdown, /não foram publicadas/i, "Teste I aviso");
}

// --- Teste J ---
{
  const ok = await processMetaAiRecommendations({
    rawText: JSON.stringify({
      format: "nex_intelligence_analysis_v1_1_2",
      stage1_markdown: "ok",
      stage2_markdown: "ok",
      recommendations: [goodRec({ id: "rec-j" })],
      stage4_markdown: "resumo j",
    }),
    payload,
    quality,
  });
  const detail: MetaAiExecutionDetail = {
    id: "68f7c45d-73db-4857-b42f-06d2a94b8a40",
    createdAt: "2026-11-02T16:00:00.000Z",
    status: "partial",
    organizationId: "org-1",
    clientName: "Walkup",
    accountId: "act_1",
    accountName: "Conta",
    periodSince: "2026-10-01",
    periodUntil: "2026-10-31",
    periodTimezone: "America/Sao_Paulo",
    protocolVersion: "1.1.2",
    dataContractVersion: "1.0.0",
    model: "gpt-4o-mini",
    promptHash: "abc123",
    warningCount: 0,
    analysisMarkdown: ok.publishedMarkdown,
    warnings: [],
    errorMessage: "",
    inputJson: { ...payload, data_quality: quality, computed_metrics: quality.computed_metrics },
    outputJson: {
      analysis_markdown: ok.publishedMarkdown,
      recommendation_validation: ok.audit,
      protocol_version: "1.1.2",
      engine_version: "1.1.2",
    },
    calibrationFeedback: {},
  };
  const chatgpt = buildChatgptMetaAnalysisPayload(detail);
  assert.equal(chatgpt.execution_id, detail.id, "Teste J id");
  assert.equal(chatgpt.tool, "get_meta_analysis_execution", "Teste J tool");
  assert.equal(chatgpt.protocol_version, "1.1.2", "Teste J protocol");
  assert.equal(chatgpt.data_contract_version, "1.0.0", "Teste J contract");
  assert.ok(chatgpt.ai_analysis.markdown?.includes("Etapa 3"), "Teste J markdown");
  assert.ok(chatgpt.availability.output_json, "Teste J output");
  assert.ok(!JSON.stringify(chatgpt).includes("sk-"), "Teste J no secret");
}

{
  const parsed = parseStructuredAnalysis(
    "```json\n" +
      JSON.stringify({
        stage1_markdown: "a",
        stage2_markdown: "b",
        recommendations: [goodRec({ id: "fence" })],
        stage4_markdown: "c",
      }) +
      "\n```",
  );
  assert.equal(parsed.parse_ok, true);
  assert.equal(parsed.recommendations[0]?.id, "fence");
}

console.log("meta-recommendation-validation.test.ts: ok (A-J)");
