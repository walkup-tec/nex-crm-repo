import assert from "node:assert/strict";
import type { MetaDataQualityReport } from "./meta-data-quality";
import type { NexMetaAnalysisV1 } from "./meta-export";
import {
  META_AI_RECOMMENDATION_ENGINE,
  parseStructuredAnalysis,
  processMetaAiRecommendations,
  sanitizeNarrativeText,
  validateStructuredClaim,
  validateStructuredRecommendation,
  type StructuredRecommendation,
} from "./meta-recommendation-validation";
import { buildChatgptMetaAnalysisPayload } from "./chatgpt-integration";
import type { MetaAiExecutionDetail } from "./meta-ai-calibration";
import { indexTracesById, type MetricTraceRecord } from "./meta-metric-traceability";

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
    engine_version: "1.1.3",
    protocol_version: "1.1.3",
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
  const id = overrides.id ?? "rec-ok";
  return {
    id,
    entity_id: "camp_ok",
    level: "campaign",
    indicators_used: ["ctr", "cpc"],
    evidence: ["CTR 5% no período", "CPC estável em R$ 2"],
    hypothesis: "Criativo mantém atenção relativa",
    confidence: "medium",
    recommended_action: "Rodar teste A/B de copy mantendo orçamento",
    action_kind: "test",
    validation_criterion: "CTR e CPC após 7 dias",
    trace_ids: [`trace-${id}-ctr`, `trace-${id}-cpc`],
    arbitrary_targets: [],
    uses_external_commercial_data: false,
    ...overrides,
  };
}

function makeCtrCpcTraces(claimId: string, entityId = "camp_ok"): MetricTraceRecord[] {
  return [
    {
      trace_id: `trace-${claimId}-ctr`,
      entity_level: "campaign",
      entity_id: entityId,
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
    },
    {
      trace_id: `trace-${claimId}-cpc`,
      entity_level: "campaign",
      entity_id: entityId,
      metric: "cpc",
      source: "META_MARKETING_API",
      source_level: "campaign",
      source_field: "insights.spend",
      period: { since: "2026-10-01", until: "2026-10-31" },
      calculation: {
        type: "RATIO",
        formula: "spend / clicks",
        inputs: { spend: 100, clicks: 50 },
        result: 2,
      },
      validation: { status: "PASS", dependencies: ["spend", "clicks"], check_codes: [], reason: null },
      used_by: [claimId],
    },
  ];
}

function tracesFor(...claimIds: string[]) {
  return indexTracesById({
    version: "1.0",
    records: claimIds.flatMap((id) => makeCtrCpcTraces(id)),
  });
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
  const approved = validateStructuredRecommendation(
    goodRec({ id: "rec-b" }),
    payload,
    quality,
    tracesFor("rec-b"),
  );
  assert.equal(approved.verdict, "APPROVED", "Teste B");
}

// --- Teste C ---
{
  const other = validateStructuredRecommendation(
    goodRec({
      id: "rec-c",
      entity_id: "camp_ok",
      indicators_used: ["ctr", "cpc"],
      evidence: ["CTR 5%", "CPC estável"],
      recommended_action: "Monitorar distribuição de investimento",
      action_kind: "monitor",
      trace_ids: ["trace-rec-c-ctr", "trace-rec-c-cpc"],
    }),
    payload,
    quality,
    tracesFor("rec-c"),
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
  const processed = await processMetaAiRecommendations({
    rawText: JSON.stringify({
      format: "nex_intelligence_analysis_v1_1_4",
      stage1_markdown: "Integridade parcial.",
      observations: [],
      recommendations: [goodRec({ id: "rec-g-ok" }), rejected],
      executive_points: [],
      metric_traceability: { version: "1.0", records: makeCtrCpcTraces("rec-g-ok") },
      stage2_markdown: "Análise descritiva sem métricas numéricas.",
      stage4_markdown: "Priorize: Aumentar orçamento da campanha ruim e também teste de copy.",
    }),
    payload,
    quality,
  });
  const md = processed.publishedMarkdown;
  assert.match(md, /Recomendações aprovadas/i, "Teste G seção");
  assert.ok(!/Aumentar orçamento da campanha ruim/.test(md), "Teste G sem ação rejeitada");
  assert.match(md, /Rodar teste A\/B de copy/i, "Teste G mantém aprovada");
}

// --- Teste H ---
{
  let regenerateCalls = 0;
  const structured = {
    format: "nex_intelligence_analysis_v1_1_4",
    stage1_markdown: "dq",
    stage2_markdown: "an",
    observations: [],
    executive_points: [],
    metric_traceability: { version: "1.0", records: [] },
    recommendations: [
      goodRec({
        id: "rec-h",
        entity_id: "camp_bad",
        action_kind: "scale_budget",
        indicators_used: ["results", "spend"],
        evidence: ["a", "b"],
        recommended_action: "Escalar campanha comprometida",
        trace_ids: [],
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
  assert.match(broken.publishedMarkdown, /não foram publicadas|estruturada inválida/i, "Teste I aviso");
  assert.ok(!/recomendações soltas/i.test(broken.publishedMarkdown), "Teste I sem markdown bruto");
}

// --- Teste J ---
{
  const ok = await processMetaAiRecommendations({
    rawText: JSON.stringify({
      format: "nex_intelligence_analysis_v1_1_4",
      stage1_markdown: "ok",
      stage2_markdown: "Sem métricas neste fallback.",
      observations: [],
      executive_points: [],
      recommendations: [goodRec({ id: "rec-j" })],
      metric_traceability: { version: "1.0", records: makeCtrCpcTraces("rec-j") },
      stage4_markdown: "resumo j",
    }),
    payload,
    quality,
  });
  assert.equal(ok.audit.engine_version, META_AI_RECOMMENDATION_ENGINE);
  const detail: MetaAiExecutionDetail = {
    id: "3ff5318c-affb-40d8-a486-139decc5d554",
    createdAt: "2026-11-02T16:00:00.000Z",
    status: "partial",
    organizationId: "org-1",
    clientName: "Walkup",
    accountId: "act_1",
    accountName: "Conta",
    periodSince: "2026-10-01",
    periodUntil: "2026-10-31",
    periodTimezone: "America/Sao_Paulo",
    protocolVersion: "1.1.4",
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
      protocol_version: "1.1.4",
      engine_version: "1.1.4",
    },
    calibrationFeedback: {},
  };
  const chatgpt = buildChatgptMetaAnalysisPayload(detail);
  assert.equal(chatgpt.execution_id, detail.id, "Teste J id");
  assert.equal(chatgpt.tool, "get_meta_analysis_execution", "Teste J tool");
  assert.equal(chatgpt.protocol_version, "1.1.4", "Teste J protocol");
  assert.equal(chatgpt.data_contract_version, "1.0.0", "Teste J contract");
  assert.ok(chatgpt.ai_analysis.markdown?.includes("Etapa 3"), "Teste J markdown");
  assert.ok(chatgpt.availability.output_json, "Teste J output");
  assert.ok(chatgpt.ai_analysis.output?.recommendation_validation, "Teste J audit");
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

// --- Teste K: reprodução 78632113 — juízo de conversão com results comprometido ---
{
  const judgment = validateStructuredClaim(
    {
      id: "obs-k",
      entity_id: "camp_bad",
      level: "campaign",
      metrics_used: ["results", "cost_per_result"],
      claim_kind: "performance_judgment",
      text: "A campanha camp_bad apresenta conversão insatisfatória e desempenho insuficiente.",
    },
    payload,
    quality,
  );
  assert.equal(judgment.verdict, "REJECTED", "Teste K");
}

// --- Teste L: recomendação indireta em narrativa ---
{
  const indirect = validateStructuredClaim(
    {
      id: "obs-l",
      entity_id: "camp_bad",
      level: "campaign",
      metrics_used: ["spend"],
      claim_kind: "indirect_recommendation",
      text: "Recomendamos aumentar o orçamento desta campanha.",
    },
    payload,
    quality,
    [],
  );
  assert.equal(indirect.verdict, "REJECTED", "Teste L");
}

// --- Teste M: observação descritiva verificada preservada; campanha ok não bloqueada ---
{
  const okObs = validateStructuredClaim(
    {
      id: "obs-m",
      entity_id: "camp_ok",
      level: "campaign",
      metrics_used: ["ctr", "cpc"],
      trace_ids: ["trace-obs-m-ctr", "trace-obs-m-cpc"],
      claim_kind: "descriptive",
      text: "A campanha camp_ok manteve CTR de 5% com CPC estável.",
    },
    payload,
    quality,
    [],
    tracesFor("obs-m"),
  );
  assert.equal(okObs.verdict, "APPROVED", "Teste M");
}

// --- Teste N: pipeline completo estilo execução 78632113 ---
{
  const result = await processMetaAiRecommendations({
    rawText: JSON.stringify({
      format: "nex_intelligence_analysis_v1_1_4",
      stage1_markdown: "data_quality.status = NOT_VERIFIABLE para results/spend em camp_bad.",
      observations: [
        {
          id: "obs-n1",
          entity_id: "camp_bad",
          level: "campaign",
          metrics_used: ["results", "cost_per_result"],
          claim_kind: "performance_judgment",
          text: "camp_bad tem conversão insatisfatória e retorno inadequado.",
        },
        {
          id: "obs-n2",
          entity_id: "camp_ok",
          level: "campaign",
          metrics_used: ["ctr", "cpc"],
          trace_ids: ["trace-obs-n2-ctr", "trace-obs-n2-cpc"],
          claim_kind: "descriptive",
          text: "camp_ok apresenta CTR estável e CPC consistente.",
        },
        {
          id: "obs-n3",
          entity_id: "camp_bad",
          level: "campaign",
          metrics_used: ["spend"],
          claim_kind: "indirect_recommendation",
          text: "Sugerimos aumentar o orçamento de camp_bad.",
        },
      ],
      recommendations: [
        goodRec({
          id: "rec-n-bad",
          entity_id: "camp_bad",
          action_kind: "scale_budget",
          indicators_used: ["results", "spend"],
          evidence: ["CPR aparente", "volume aparente"],
          recommended_action: "Aumentar orçamento de camp_bad",
          trace_ids: [],
        }),
        goodRec({ id: "rec-n-ok" }),
      ],
      executive_points: [
        {
          id: "exec-n1",
          entity_id: "camp_bad",
          level: "campaign",
          metrics_used: ["results"],
          claim_kind: "performance_judgment",
          text: "Prioridade: corrigir ineficiência de camp_bad.",
        },
        {
          id: "exec-n2",
          entity_id: "camp_ok",
          level: "campaign",
          metrics_used: ["ctr"],
          trace_ids: ["trace-exec-n2-ctr"],
          claim_kind: "descriptive",
          text: "camp_ok mantém indicadores de engajamento verificáveis com CTR 5%.",
        },
      ],
      metric_traceability: {
        version: "1.0",
        records: [
          ...makeCtrCpcTraces("obs-n2"),
          ...makeCtrCpcTraces("rec-n-ok"),
          {
            ...makeCtrCpcTraces("exec-n2")[0],
            trace_id: "trace-exec-n2-ctr",
            used_by: ["exec-n2"],
          },
        ],
      },
      stage2_markdown: "",
      stage4_markdown: "",
    }),
    payload,
    quality,
  });

  assert.ok(!/conversão insatisfatória/i.test(result.publishedMarkdown), "Teste N sem juízo ruim");
  assert.ok(!/retorno inadequado/i.test(result.publishedMarkdown), "Teste N sem retorno inadequado");
  assert.ok(!/aumentar o orçamento de camp_bad/i.test(result.publishedMarkdown), "Teste N sem escala indireta");
  assert.ok(!/Aumentar orçamento de camp_bad/.test(result.publishedMarkdown), "Teste N sem rec rejeitada");
  assert.ok(!/ineficiência de camp_bad/i.test(result.publishedMarkdown), "Teste N sem juízo no resumo");
  assert.match(result.publishedMarkdown, /CTR estável e CPC consistente/i, "Teste N preserva descritivo ok");
  assert.match(result.publishedMarkdown, /engajamento verificáveis/i, "Teste N preserva exec ok");
  assert.match(result.publishedMarkdown, /Rodar teste A\/B de copy/i, "Teste N recomenda aprovada");
  assert.ok(result.audit.observations.some((o) => o.id === "obs-n1" && o.verdict === "REJECTED"));
  assert.ok(result.audit.observations.some((o) => o.id === "obs-n2" && o.verdict === "APPROVED"));
}

// --- Teste O: sanitização de markdown fallback (sem observations) ---
{
  const sanitized = sanitizeNarrativeText(
    [
      "A campanha BAD apresenta desempenho insuficiente e conversão insatisfatória.",
      "A campanha OK manteve entrega ativa no período.",
      "Recomendamos aumentar o orçamento imediatamente.",
    ].join("\n\n"),
    payload,
    quality,
    [],
  );
  assert.ok(!/desempenho insuficiente/i.test(sanitized.text), "Teste O drop juízo");
  assert.ok(!/aumentar o orçamento/i.test(sanitized.text), "Teste O drop indireta");
  assert.match(sanitized.text, /entrega ativa/i, "Teste O keep descritivo sem métrica numérica");
  assert.ok(sanitized.dropped >= 2, "Teste O dropped count");
}

console.log("meta-recommendation-validation.test.ts: ok (A-O)");
