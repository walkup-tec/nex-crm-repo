import assert from "node:assert/strict";
import type { MetaDataQualityReport } from "./meta-data-quality";
import type { NexMetaAnalysisV1 } from "./meta-export";
import {
  buildCompromisedMetricIndex,
  buildWeightedCtrAggregationTrace,
  indexTracesById,
  metricIntegrityForEntity,
  normalizeCanonicalMetric,
  validateMetricTraceRecord,
} from "./meta-metric-traceability";
import {
  processMetaAiRecommendations,
  validateStructuredClaim,
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

/** Payload inspirado na execução 3ff5318c — spend/results inconsistentes, clicks/impressions ok. */
function payloadRef(): NexMetaAnalysisV1 {
  return {
    schema_version: "1.0.0",
    metadata: {
      source: "NEX",
      exported_at: "2026-11-02T16:00:00-03:00",
      currency: "BRL",
      data_status: "partial",
      organization_id: "org-1",
      client_name: "Walkup",
    },
    account: { id: "act_1", name: "Conta" },
    period: { since: "2026-10-19", until: "2026-11-01", timezone: "America/Sao_Paulo" },
    attribution: { setting: "unified", note: "" },
    campaigns: [
      {
        id: "120254698455700651",
        name: "Campanha A",
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
          impressions: 1033,
          clicks: 20,
          ctr: 1.936108,
          cpc: 5,
          results: 5,
          cost_per_result: 20,
        }),
        daily_insights: [],
        attribution_setting: null,
      },
      {
        id: "camp_b",
        name: "Campanha B",
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
          clicks: 25,
          ctr: 5,
          cpc: 2,
          results: 3,
          cost_per_result: 16.67,
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
}

function qualitySpendResultsBad(): MetaDataQualityReport {
  return {
    status: "NOT_VERIFIABLE",
    engine_version: "1.1.5",
    protocol_version: "1.1.5",
    validated_at: "2026-11-02T16:30:00.000Z",
    checks: [
      {
        code: "CAMPAIGN_SPEND_VS_ADSETS",
        level: "campaign",
        entity_id: "120254698455700651",
        metric: "spend",
        consolidated_value: 100,
        compared_value: 80,
        absolute_diff: 20,
        relative_diff: 0.2,
        severity: "WARNING",
        description: "Spend inconsistente",
        possible_causes: ["paginação"],
        state: "WARNING",
      },
      {
        code: "CAMPAIGN_RESULTS_INCONSISTENT",
        level: "campaign",
        entity_id: "120254698455700651",
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
    ],
    affected_metrics: ["spend", "results"],
    compromised_metrics: ["spend"],
    verified_metrics: [],
    computed_metrics: {
      currency: "BRL",
      spend_total: 150,
      spend_total_cents: 15000,
      impressions_total: 1533,
      clicks_total: 45,
      results_total: 8,
      ctr: null,
      cpc: null,
      cpm: null,
      cost_per_result: null,
      basis: "campaign_insights_spend",
    },
  };
}

assert.equal(normalizeCanonicalMetric("custo_por_resultado"), "cost_per_result");

{
  const integrity = buildCompromisedMetricIndex(qualitySpendResultsBad());
  const entity = "120254698455700651";
  assert.equal(metricIntegrityForEntity(integrity, entity, "spend").blocked, true, "spend blocked");
  assert.equal(metricIntegrityForEntity(integrity, entity, "results").blocked, true, "results blocked");
  assert.equal(metricIntegrityForEntity(integrity, entity, "ctr").blocked, false, "CTR NOT blocked by spend/results");
  assert.equal(metricIntegrityForEntity(integrity, entity, "cpc").blocked, true, "CPC blocked by spend dep");
  assert.equal(metricIntegrityForEntity(integrity, entity, "clicks").blocked, false, "clicks ok");
  assert.equal(metricIntegrityForEntity(integrity, entity, "impressions").blocked, false, "impressions ok");
}

const payload = payloadRef();
const quality = qualitySpendResultsBad();

function ctrRatioTrace(claimId: string) {
  return {
    trace_id: "trace-001",
    entity_level: "campaign" as const,
    entity_id: "120254698455700651",
    metric: "ctr",
    source: "META_MARKETING_API" as const,
    source_level: "campaign" as const,
    source_field: "insights.clicks",
    period: { since: "2026-10-19", until: "2026-11-01" },
    calculation: {
      type: "RATIO" as const,
      formula: "(clicks / impressions) * 100",
      inputs: { clicks: 20, impressions: 1033 },
      result: 1.936108,
      unit: "percent",
      precision: 6,
      rounding: "half_up_6dp",
    },
    validation: {
      status: "PASS" as const,
      dependencies: ["clicks", "impressions"],
      check_codes: [],
      reason: null,
    },
    used_by: [claimId],
  };
}

// Problema 1: observação CTR não rejeitada por inconsistência spend/results
{
  const traces = indexTracesById({ version: "1.0", records: [ctrRatioTrace("obs-ctr")] });
  const claim = validateStructuredClaim(
    {
      id: "obs-ctr",
      entity_id: "120254698455700651",
      level: "campaign",
      metrics_used: ["ctr"],
      trace_ids: ["trace-001"],
      claim_kind: "descriptive",
      text: "CTR da campanha 120254698455700651 = 1,94% ((20/1033)*100).",
    },
    payload,
    quality,
    [],
    traces,
  );
  assert.equal(claim.verdict, "APPROVED", "Problema1 CTR aprovado");
  assert.ok(!claim.rejection_reasons.some((r) => r.includes("spend") || r.includes("results")), "Problema1 sem spend/results");
}

// CPC na mesma campanha: rejeitado porque spend está comprometido
{
  const cpcTrace = {
    ...ctrRatioTrace("obs-cpc"),
    trace_id: "trace-cpc",
    metric: "cpc",
    source_field: "insights.spend",
    calculation: {
      type: "RATIO" as const,
      formula: "spend / clicks",
      inputs: { spend: 100, clicks: 20 },
      result: 5,
    },
    validation: {
      status: "PASS" as const,
      dependencies: ["spend", "clicks"],
      check_codes: [],
      reason: null,
    },
    used_by: ["obs-cpc"],
  };
  const traces = indexTracesById({ version: "1.0", records: [cpcTrace] });
  const claim = validateStructuredClaim(
    {
      id: "obs-cpc",
      entity_id: "120254698455700651",
      level: "campaign",
      metrics_used: ["cpc"],
      trace_ids: ["trace-cpc"],
      claim_kind: "descriptive",
      text: "CPC = R$ 5,00",
    },
    payload,
    quality,
    [],
    traces,
  );
  assert.equal(claim.verdict, "REJECTED", "CPC rejeitado com spend comprometido");
  assert.ok(claim.rejection_reasons.some((r) => r.includes("spend")), "CPC reason spend");
}

// Problema 2: CTR médio 3,32% sem agregação validada → REJECTED
{
  const claim = validateStructuredClaim(
    {
      id: "exec-avg",
      entity_id: null,
      level: "account",
      metrics_used: ["ctr"],
      trace_ids: [],
      claim_kind: "descriptive",
      text: "O CTR médio da conta é 3,32%.",
    },
    payload,
    quality,
    [],
    new Map(),
  );
  assert.equal(claim.verdict, "REJECTED", "Problema2 média simples rejeitada");
  assert.ok(
    claim.rejection_reasons.some((r) => r.includes("simple_average") || r.includes("missing_metric_traceability")),
    "Problema2 reasons",
  );
}

// CTR agregado ponderado válido → APPROVED
{
  const agg = buildWeightedCtrAggregationTrace({
    traceId: "trace-agg-1",
    claimId: "exec-weighted",
    payload,
    quality,
    campaignIds: ["120254698455700651", "camp_b"],
  });
  assert.ok(agg, "agg built");
  const issues = validateMetricTraceRecord(agg!, payload, quality);
  assert.equal(issues.length, 0, `agg issues: ${issues.map((i) => i.reason).join(",")}`);
  const traces = indexTracesById({ version: "1.0", records: [agg!] });
  const claim = validateStructuredClaim(
    {
      id: "exec-weighted",
      entity_id: "act_1",
      level: "account",
      metrics_used: ["ctr"],
      trace_ids: ["trace-agg-1"],
      claim_kind: "descriptive",
      text: `CTR agregado ponderado = ${agg!.calculation.result}%.`,
    },
    payload,
    quality,
    [],
    traces,
  );
  assert.equal(claim.verdict, "APPROVED", "CTR ponderado aprovado");
}

// Pipeline: execução 3ff5318c — CTR ok no relatório; média simples omitida
{
  const result = await processMetaAiRecommendations({
    rawText: JSON.stringify({
      format: "nex_intelligence_analysis_v1_1_4",
      stage1_markdown: "data_quality parcial em spend/results.",
      observations: [
        {
          id: "obs-001",
          entity_id: "120254698455700651",
          level: "campaign",
          metrics_used: ["ctr"],
          trace_ids: ["trace-001"],
          claim_kind: "descriptive",
          text: "CTR da campanha 120254698455700651 = 1,94%.",
        },
      ],
      recommendations: [],
      executive_points: [
        {
          id: "exec-bad",
          entity_id: null,
          level: "account",
          metrics_used: ["ctr"],
          trace_ids: [],
          claim_kind: "descriptive",
          text: "CTR médio de 3,32% na conta.",
        },
      ],
      metric_traceability: {
        version: "1.0",
        records: [ctrRatioTrace("obs-001")],
      },
      stage2_markdown: "",
      stage4_markdown: "",
    }),
    payload,
    quality,
  });
  assert.match(result.publishedMarkdown, /1,94%/i, "pipeline preserva CTR rastreado");
  assert.ok(!/3,32%/.test(result.publishedMarkdown), "pipeline omite CTR médio sem rastro");
  assert.ok(result.audit.observations.some((o) => o.id === "obs-001" && o.verdict === "APPROVED"));
  assert.ok(result.audit.executive_points.some((o) => o.id === "exec-bad" && o.verdict === "REJECTED"));
  // v1.2.0: metric_traceability publicada é o catálogo backend (não o inventário da IA).
  assert.ok(result.audit.metric_traceability.records.length >= 1);
  assert.ok(
    result.audit.metric_traceability.records.some(
      (row) => row.entity_id === "120254698455700651" && row.metric === "ctr",
    ),
  );
  assert.equal(result.audit.engine_version, "1.2.0");
}

// --- Regressão a589e9be: texto WhatsApp + trace Conv. Site → REJECTED ---
{
  const whatsappId = "camp_whatsapp";
  const siteId = "camp_site";
  const dual: NexMetaAnalysisV1 = {
    ...payload,
    campaigns: [
      {
        id: whatsappId,
        name: "Nex Ads [Eng. WhatsApp]",
        objective: "OUTCOME_ENGAGEMENT",
        status: "ACTIVE",
        effective_status: "ACTIVE",
        buying_type: null,
        daily_budget: null,
        lifetime_budget: null,
        optimization_goal: null,
        result_metric: "messaging",
        insights: insights({ spend: 80, impressions: 2000, clicks: 40, ctr: 2, cpc: 2, results: 8 }),
        daily_insights: [],
        attribution_setting: null,
      },
      {
        id: siteId,
        name: "Nex Ads [Conv. Site]",
        objective: "OUTCOME_SALES",
        status: "ACTIVE",
        effective_status: "ACTIVE",
        buying_type: null,
        daily_budget: null,
        lifetime_budget: null,
        optimization_goal: null,
        result_metric: "purchase",
        insights: insights({ spend: 120, impressions: 1033, clicks: 20, ctr: 1.936108, cpc: 6, results: 4 }),
        daily_insights: [],
        attribution_setting: null,
      },
    ],
  };
  const qualityOk: MetaDataQualityReport = {
    ...quality,
    status: "PASS",
    checks: [],
    affected_metrics: [],
    compromised_metrics: [],
    verified_metrics: ["ctr", "clicks", "impressions"],
  };

  const wrongTrace = {
    trace_id: "trace-wrong",
    entity_level: "campaign" as const,
    entity_id: siteId,
    metric: "ctr",
    source: "META_MARKETING_API" as const,
    source_level: "campaign" as const,
    source_field: "insights.clicks",
    period: { since: "2026-10-19", until: "2026-11-01" },
    calculation: {
      type: "RATIO" as const,
      formula: "(clicks / impressions) * 100",
      inputs: { clicks: 20, impressions: 1033 },
      result: 1.936108,
    },
    validation: {
      status: "PASS" as const,
      dependencies: ["clicks", "impressions"],
      check_codes: [],
      reason: null,
    },
    used_by: ["obs-wa"],
  };

  const mismatched = validateStructuredClaim(
    {
      id: "obs-wa",
      entity_id: whatsappId,
      level: "campaign",
      metrics_used: ["ctr"],
      trace_ids: ["trace-wrong"],
      claim_kind: "descriptive",
      text: "A campanha Nex Ads [Eng. WhatsApp] manteve CTR de 2%.",
    },
    dual,
    qualityOk,
    [],
    indexTracesById({ version: "1.0", records: [wrongTrace] }),
  );
  assert.equal(mismatched.verdict, "REJECTED", "a589e9be mismatch rejected");
  assert.ok(
    mismatched.rejection_reasons.some(
      (r) => r.includes("trace_entity_id_mismatch") || r.includes("trace_text_entity_mismatch") || r.includes("claim_text_entity"),
    ),
    `a589e9be reasons: ${mismatched.rejection_reasons.join(",")}`,
  );

  const rightTrace = {
    ...wrongTrace,
    trace_id: "trace-right",
    entity_id: whatsappId,
    calculation: {
      type: "RATIO" as const,
      formula: "(clicks / impressions) * 100",
      inputs: { clicks: 40, impressions: 2000 },
      result: 2,
    },
    used_by: ["obs-wa-ok"],
  };
  const aligned = validateStructuredClaim(
    {
      id: "obs-wa-ok",
      entity_id: whatsappId,
      level: "campaign",
      metrics_used: ["ctr"],
      trace_ids: ["trace-right"],
      claim_kind: "descriptive",
      text: "A campanha Nex Ads [Eng. WhatsApp] manteve CTR de 2%.",
    },
    dual,
    qualityOk,
    [],
    indexTracesById({ version: "1.0", records: [rightTrace] }),
  );
  assert.equal(aligned.verdict, "APPROVED", "a589e9be aligned approved");

  // PASS da IA com inputs que não batem com Meta → rejeitado
  const fakePass = {
    ...rightTrace,
    trace_id: "trace-fake",
    calculation: {
      type: "RATIO" as const,
      formula: "(clicks / impressions) * 100",
      inputs: { clicks: 999, impressions: 2000 },
      result: 49.95,
    },
    validation: {
      status: "PASS" as const,
      dependencies: ["clicks", "impressions"],
      check_codes: [],
      reason: null,
    },
    used_by: ["obs-fake"],
  };
  const fakeIssues = validateMetricTraceRecord(fakePass, dual, qualityOk);
  assert.ok(
    fakeIssues.some((i) => i.reason.includes("meta_input_mismatch") || i.reason.includes("ai_pass_overridden")),
    "AI PASS overridden by Meta recompute",
  );
}

console.log("meta-metric-traceability.test.ts: ok (3ff5318c + a589e9be)");
