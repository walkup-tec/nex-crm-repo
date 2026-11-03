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
// validateStructuredRecommendation used by Testes V–W (evidência E0–E3)
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
    engine_version: "1.1.5",
    protocol_version: "1.1.5",
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
    hypothesis: null,
    confidence: "medium",
    recommended_action: "Monitorar CTR e CPC da campanha OK sem alterar orçamento",
    action_kind: "monitor",
    validation_criterion: "CTR e CPC após 7 dias",
    trace_ids: [`trace-${id}-ctr`, `trace-${id}-cpc`],
    arbitrary_targets: [],
    uses_external_commercial_data: false,
    ...overrides,
  };
}

/** Recomendação estratégica com evidência E3 (comparação + hipótese + multi-indicador). */
function e3CreativeRec(overrides: Partial<StructuredRecommendation> = {}): StructuredRecommendation {
  const id = overrides.id ?? "rec-e3";
  return goodRec({
    id,
    action_kind: "replace_creative",
    recommended_action: "Testar novo criativo na campanha OK com controle no mesmo objetivo",
    hypothesis: "A campanha OK gera mais cliques relativos que a campanha comparável (mesmo OUTCOME_LEADS)",
    validation_criterion: "CTR e CPC da campanha OK vs controle em 7 dias com mesmo orçamento",
    indicators_used: ["ctr", "cpc", "impressions"],
    evidence: ["CTR 5% na campanha OK", "CTR 2% na campanha comparável", "Mesmo objective OUTCOME_LEADS"],
    comparison: {
      type: "campaign_vs_campaign",
      entity_ids: ["camp_ok", "camp_bad"],
      compatible: true,
      absolute_difference: 3,
      relative_difference_pct: 150,
      volumes: { impressions_a: 1000, impressions_b: 500, clicks_a: 50, clicks_b: 20 },
    },
    ...overrides,
  });
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
  assert.match(md, /Monitorar CTR e CPC da campanha OK/i, "Teste G mantém aprovada");
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
  assert.equal(broken.analyticalStatus, "FALLBACK_DETERMINISTIC", "Teste I fallback");
  assert.match(broken.publishedMarkdown, /determinístico|Conclusões da IA indisponíveis/i, "Teste I aviso");
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
    protocolVersion: "1.2.0",
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
      protocol_version: "1.2.0",
      engine_version: "1.2.0",
      analytical_status: ok.analyticalStatus,
    },
    calibrationFeedback: {},
  };
  const chatgpt = buildChatgptMetaAnalysisPayload(detail);
  assert.equal(chatgpt.execution_id, detail.id, "Teste J id");
  assert.equal(chatgpt.tool, "get_meta_analysis_execution", "Teste J tool");
  assert.equal(chatgpt.protocol_version, "1.2.0", "Teste J protocol");
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
  assert.match(result.publishedMarkdown, /Monitorar CTR e CPC/i, "Teste N recomenda aprovada");
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

// --- Teste P: regressão d0b340f5 — schema fail em recs preserva observations ---
{
  const parsed = parseStructuredAnalysis(
    JSON.stringify({
      format: "nex_intelligence_analysis_v1_1_6",
      stage1_markdown: "Status data_quality PASS parcial.",
      observations: [
        {
          id: "obs-p",
          entity_id: "camp_ok",
          level: "campaign",
          metrics_used: ["ctr", "cpc"],
          trace_ids: ["trace-obs-p-ctr", "trace-obs-p-cpc"],
          claim_kind: "descriptive",
          text: "A campanha OK manteve CTR de 5% com CPC estável.",
        },
      ],
      recommendations: [
        {
          id: "rec-p-bad",
          entity_id: "camp_ok",
          level: "campaign",
          indicators_used: ["ctr"],
          evidence: ["x"],
          confidence: "medium",
          recommended_action: "Escalar orçamento",
          action_kind: "totally_invalid_kind",
          validation_criterion: "CPR",
        },
      ],
      executive_points: [],
      metric_traceability: { version: "1.0", records: makeCtrCpcTraces("obs-p") },
      stage2_markdown: "NÃO PUBLICAR ESTE MARKDOWN BRUTO",
      stage4_markdown: "",
    }),
  );
  assert.equal(parsed.parse_ok, true, "Teste P envelope ok");
  assert.equal(parsed.observations.length, 1, "Teste P obs recuperada");
  assert.equal(parsed.recommendations.length, 0, "Teste P recs schema fail");
  assert.ok(
    parsed.schema_errors.some((e) => e.path.includes("recommendations[0].action_kind")),
    `Teste P path error: ${parsed.schema_errors.map((e) => e.path).join(",")}`,
  );
  assert.match(parsed.parse_error ?? "", /recommendations_failed_schema/);

  const result = await processMetaAiRecommendations({
    rawText: JSON.stringify({
      format: "nex_intelligence_analysis_v1_1_6",
      stage1_markdown: "ok",
      observations: [
        {
          id: "obs-p",
          entity_id: "camp_ok",
          level: "campaign",
          metrics_used: ["ctr", "cpc"],
          trace_ids: ["trace-obs-p-ctr", "trace-obs-p-cpc"],
          claim_kind: "descriptive",
          text: "A campanha OK manteve CTR de 5% com CPC estável.",
        },
      ],
      recommendations: [
        {
          id: "rec-p-bad",
          entity_id: "camp_ok",
          level: "campaign",
          indicators_used: ["ctr"],
          evidence: ["x"],
          confidence: "medium",
          recommended_action: "Escalar",
          action_kind: "totally_invalid_kind",
          validation_criterion: "x",
        },
      ],
      executive_points: [],
      metric_traceability: { version: "1.0", records: makeCtrCpcTraces("obs-p") },
      stage2_markdown: "NÃO PUBLICAR ESTE MARKDOWN BRUTO",
      stage4_markdown: "",
    }),
    payload,
    quality,
  });
  assert.equal(result.analyticalStatus, "PARTIAL_VALIDATED", "Teste P status");
  assert.ok(result.audit.observations.some((o) => o.id === "obs-p" && o.verdict === "APPROVED"));
  assert.equal(result.approved.length, 0, "Teste P sem rec aprovada");
  assert.match(result.publishedMarkdown, /CTR de 5%/i, "Teste P publica obs");
  assert.ok(!/NÃO PUBLICAR ESTE MARKDOWN BRUTO/.test(result.publishedMarkdown), "Teste P sem bruto");
  assert.equal(result.audit.recovery.approved_observations, 1);
  assert.equal(result.audit.recovery.approved_recommendations, 0);
  assert.ok(result.audit.schema_errors.length >= 1);
}

// --- Teste Q: alias action_kind normalizado ---
{
  const parsed = parseStructuredAnalysis(
    JSON.stringify({
      stage1_markdown: "a",
      recommendations: [
        {
          ...goodRec({ id: "rec-q" }),
          action_kind: "scale",
          indicators_used: ["ctr", "cpc", "spend"],
          evidence: ["CTR ok", "CPC ok", "spend ok"],
        },
      ],
      observations: [],
      executive_points: [],
      metric_traceability: { version: "1.0", records: makeCtrCpcTraces("rec-q") },
      stage2_markdown: "",
      stage4_markdown: "",
    }),
  );
  assert.equal(parsed.recommendations[0]?.action_kind, "scale_budget", "Teste Q alias");
}

// --- Teste R: envelope inválido → structural regen → COMPLETED/PARTIAL ---
{
  let structuralCalls = 0;
  let contentCalls = 0;
  const recovered = await processMetaAiRecommendations({
    rawText: "isto não é json",
    payload,
    quality,
    regenerateStructural: async () => {
      structuralCalls += 1;
      return JSON.stringify({
        format: "nex_intelligence_analysis_v1_1_6",
        stage1_markdown: "recuperado",
        observations: [
          {
            id: "obs-r",
            entity_id: "camp_ok",
            level: "campaign",
            metrics_used: ["ctr", "cpc"],
            trace_ids: ["trace-obs-r-ctr", "trace-obs-r-cpc"],
            claim_kind: "descriptive",
            text: "A campanha OK manteve CTR de 5% com CPC estável.",
          },
        ],
        recommendations: [goodRec({ id: "rec-r" })],
        executive_points: [],
        metric_traceability: {
          version: "1.0",
          records: [...makeCtrCpcTraces("obs-r"), ...makeCtrCpcTraces("rec-r")],
        },
        stage2_markdown: "",
        stage4_markdown: "",
      });
    },
    regenerate: async () => {
      contentCalls += 1;
      return "{}";
    },
  });
  assert.equal(structuralCalls, 1, "Teste R structural once");
  assert.equal(contentCalls, 0, "Teste R sem content regen");
  assert.equal(recovered.audit.recovery.regeneration_kind, "structural");
  assert.ok(recovered.audit.observations.some((o) => o.verdict === "APPROVED"));
  assert.ok(
    recovered.analyticalStatus === "COMPLETED" || recovered.analyticalStatus === "PARTIAL_VALIDATED",
    `Teste R status=${recovered.analyticalStatus}`,
  );
}

// --- Teste S: duas falhas estruturais → FALLBACK_DETERMINISTIC ---
{
  let structuralCalls = 0;
  const fallback = await processMetaAiRecommendations({
    rawText: "markdown bruto da IA com recomendações soltas",
    payload,
    quality,
    regenerateStructural: async () => {
      structuralCalls += 1;
      return "ainda inválido";
    },
  });
  assert.equal(structuralCalls, 1, "Teste S uma regen");
  assert.equal(fallback.analyticalStatus, "FALLBACK_DETERMINISTIC", "Teste S fallback");
  assert.match(fallback.publishedMarkdown, /Relatório técnico determinístico/i);
  assert.match(fallback.publishedMarkdown, /campanhas/i);
  assert.ok(!/recomendações soltas/i.test(fallback.publishedMarkdown), "Teste S sem bruto");
  assert.equal(fallback.audit.recovery.regeneration_attempted, true);
  assert.equal(fallback.audit.recovery.regeneration_valid, false);
  assert.equal(fallback.approved.length, 0);
}

// --- Teste T: falha total de schema nas recs + obs inválidas → fallback ---
{
  const totalFail = await processMetaAiRecommendations({
    rawText: JSON.stringify({
      stage1_markdown: "x",
      observations: [{ id: "bad" }],
      recommendations: [{ id: "bad-rec", action_kind: "nope" }],
      executive_points: [],
      metric_traceability: { version: "1.0", records: [] },
      stage2_markdown: "BRUTO",
      stage4_markdown: "BRUTO",
    }),
    payload,
    quality,
  });
  assert.equal(totalFail.analyticalStatus, "FALLBACK_DETERMINISTIC", "Teste T fallback");
  assert.ok(!/BRUTO/.test(totalFail.publishedMarkdown), "Teste T sem bruto");
  assert.ok(totalFail.audit.schema_errors.length >= 1, "Teste T schema errors");
}

// --- Teste U: regressão 6d0d964b — CTR qualitativo sem comparação → REJECTED (sem recovery) / E1 neutro (com recovery) ---
{
  const tracesU = indexTracesById({
    version: "1.0",
    records: [
      {
        trace_id: "trace-obs-u-ctr",
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
        validation: {
          status: "PASS",
          dependencies: ["clicks", "impressions"],
          check_codes: [],
          reason: null,
        },
        used_by: ["obs-u"],
      },
    ],
  });
  const qualitative = validateStructuredClaim(
    {
      id: "obs-u",
      entity_id: "camp_ok",
      level: "campaign",
      metrics_used: ["ctr"],
      trace_ids: ["trace-obs-u-ctr"],
      claim_kind: "descriptive",
      text: "A campanha OK apresentou CTR positivo/elevado de 5%, considerado aceitável.",
    },
    payload,
    quality,
    [],
    tracesU,
    { skipE1ClaimRecovery: true },
  );
  assert.equal(qualitative.verdict, "REJECTED", "Teste U qualitative rejected");
  assert.ok(
    qualitative.rejection_reasons.some((r) => r.includes("qualitative_judgment_without_validated_comparison")),
    `Teste U reasons: ${qualitative.rejection_reasons.join(",")}`,
  );

  const recovered = validateStructuredClaim(
    {
      id: "obs-u",
      entity_id: "camp_ok",
      level: "campaign",
      metrics_used: ["ctr"],
      trace_ids: ["trace-obs-u-ctr"],
      claim_kind: "descriptive",
      text: "A campanha OK apresentou CTR positivo/elevado de 5%, considerado aceitável.",
    },
    payload,
    quality,
    [],
    tracesU,
  );
  assert.equal(recovered.verdict, "APPROVED", `Teste U recovered: ${recovered.rejection_reasons.join(",")}`);
  assert.ok(recovered.e1_claim_recovery?.applied, "Teste U recovery applied");
  assert.ok(!/positiv|elevad|aceit/i.test(recovered.text), `Teste U neutro: ${recovered.text}`);
}

// --- Teste V: fato numérico E1 preservado; monitor E1 aprovado ---
{
  const factual = validateStructuredClaim(
    {
      id: "obs-v",
      entity_id: "camp_ok",
      level: "campaign",
      metrics_used: ["ctr"],
      trace_ids: ["trace-obs-v-ctr"],
      claim_kind: "descriptive",
      text: "A campanha OK registrou CTR de 5% no período.",
    },
    payload,
    quality,
    [],
    indexTracesById({
      version: "1.0",
      records: [
        {
          trace_id: "trace-obs-v-ctr",
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
          validation: {
            status: "PASS",
            dependencies: ["clicks", "impressions"],
            check_codes: [],
            reason: null,
          },
          used_by: ["obs-v"],
        },
      ],
    }),
  );
  assert.equal(factual.verdict, "APPROVED", "Teste V factual E1");
  assert.equal(factual.evidence_level, "E1", "Teste V level E1");

  const monitorOnly = validateStructuredRecommendation(
    goodRec({
      id: "rec-v-mon",
      action_kind: "monitor",
      indicators_used: ["ctr"],
      evidence: ["CTR 5% rastreável"],
      recommended_action: "Monitorar CTR sem alterar criativo",
      trace_ids: ["trace-rec-v-mon-ctr"],
    }),
    payload,
    quality,
    indexTracesById({
      version: "1.0",
      records: makeCtrCpcTraces("rec-v-mon").filter((t) => t.metric === "ctr").map((t) => ({
        ...t,
        trace_id: "trace-rec-v-mon-ctr",
        used_by: ["rec-v-mon"],
      })),
    }),
  );
  assert.equal(monitorOnly.verdict, "APPROVED", "Teste V monitor");
  assert.equal(monitorOnly.required_evidence_level, "E1");
}

// --- Teste W: criativo/test só com CTR → REJECTED; E3 completo → APPROVED ---
{
  const ctrOnlyCreative = validateStructuredRecommendation(
    {
      id: "rec-w-bad",
      entity_id: "camp_ok",
      level: "campaign",
      indicators_used: ["ctr"],
      evidence: ["CTR 5%"],
      hypothesis: null,
      confidence: "medium",
      recommended_action: "Otimizar criativos da campanha OK",
      action_kind: "replace_creative",
      validation_criterion: "CTR sobe",
      trace_ids: ["trace-rec-w-bad-ctr"],
    },
    payload,
    quality,
    indexTracesById({
      version: "1.0",
      records: makeCtrCpcTraces("rec-w-bad")
        .filter((t) => t.metric === "ctr")
        .map((t) => ({ ...t, trace_id: "trace-rec-w-bad-ctr", used_by: ["rec-w-bad"] })),
    }),
  );
  assert.equal(ctrOnlyCreative.verdict, "REJECTED", "Teste W CTR-only creative rejected");
  assert.ok(
    ctrOnlyCreative.rejection_reasons.some(
      (r) =>
        r.includes("ctr_only_insufficient") ||
        r.includes("evidence_level_insufficient") ||
        r.includes("evidence_e3"),
    ),
    `Teste W reasons: ${ctrOnlyCreative.rejection_reasons.join(",")}`,
  );

  const e3Traces = indexTracesById({
    version: "1.0",
    records: [
      ...makeCtrCpcTraces("rec-w-ok"),
      {
        trace_id: "trace-rec-w-ok-impressions",
        entity_level: "campaign",
        entity_id: "camp_ok",
        metric: "impressions",
        source: "META_MARKETING_API",
        source_level: "campaign",
        source_field: "insights.impressions",
        period: { since: "2026-10-01", until: "2026-10-31" },
        calculation: {
          type: "DIRECT",
          formula: "insights.impressions",
          inputs: { impressions: 1000 },
          result: 1000,
        },
        validation: { status: "PASS", dependencies: [], check_codes: [], reason: null },
        used_by: ["rec-w-ok"],
      },
    ],
  });
  const e3approved = validateStructuredRecommendation(
    e3CreativeRec({
      id: "rec-w-ok",
      trace_ids: ["trace-rec-w-ok-ctr", "trace-rec-w-ok-cpc", "trace-rec-w-ok-impressions"],
    }),
    payload,
    quality,
    e3Traces,
  );
  assert.equal(e3approved.verdict, "APPROVED", `Teste W E3: ${e3approved.rejection_reasons.join(",")}`);
  assert.equal(e3approved.evidence_level, "E3");
  assert.equal(e3approved.required_evidence_level, "E3");
}

// --- Teste X: resumo executivo não eleva fato a diagnóstico estratégico ---
{
  const exec = await processMetaAiRecommendations({
    rawText: JSON.stringify({
      format: "nex_intelligence_analysis_v1_1_8",
      stage1_markdown: "ok",
      observations: [
        {
          id: "obs-x",
          entity_id: "camp_ok",
          level: "campaign",
          metrics_used: ["ctr"],
          trace_ids: ["trace-obs-x-ctr"],
          claim_kind: "descriptive",
          text: "A campanha OK registrou CTR de 5%.",
        },
      ],
      recommendations: [],
      executive_points: [
        {
          id: "exec-x",
          entity_id: "camp_ok",
          level: "campaign",
          metrics_used: ["ctr"],
          trace_ids: ["trace-obs-x-ctr"],
          claim_kind: "descriptive",
          text: "CTR elevado indica desempenho positivo e justifica otimizar criativos.",
        },
      ],
      metric_traceability: {
        version: "1.0",
        records: [
          {
            trace_id: "trace-obs-x-ctr",
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
            validation: {
              status: "PASS",
              dependencies: ["clicks", "impressions"],
              check_codes: [],
              reason: null,
            },
            used_by: ["obs-x", "exec-x"],
          },
        ],
      },
      stage2_markdown: "",
      stage4_markdown: "",
    }),
    payload,
    quality,
  });
  assert.ok(exec.audit.observations.some((o) => o.id === "obs-x" && o.verdict === "APPROVED"), "Teste X obs");
  const execX = exec.audit.executive_points.find((e) => e.id === "exec-x");
  assert.ok(
    execX?.verdict === "APPROVED" && execX.e1_claim_recovery?.applied,
    `Teste X exec recuperado E1: ${execX?.verdict} ${execX?.rejection_reasons?.join(",") ?? ""}`,
  );
  assert.ok(!/desempenho positivo|elevado|otimizar criativos/i.test(exec.publishedMarkdown), "Teste X sem elevação");
  assert.match(exec.publishedMarkdown, /CTR de 5/i, "Teste X preserva fato");
}

console.log("meta-recommendation-validation.test.ts: ok (A-X)");
