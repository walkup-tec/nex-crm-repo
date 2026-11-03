/**
 * Regressão v1.2.0 — execução 6bc653f8-e717-40c1-b719-121bab3fd2a7
 * 1) Conclusão qualitativa "CTR que pode ser melhorado" sem E2 → REJECTED (obs/exec/rec)
 * 2) Spend account-wide não bloqueia CPC de entidade limpa; spend local comprometido impede PASS
 */
import assert from "node:assert/strict";
import type { MetaDataQualityReport } from "@/lib/nex-intelligence/quality/validate-export";
import type { NexMetaAnalysisV1 } from "@/lib/meta-export";
import {
  buildCompromisedMetricIndex,
  computeDeterministicTraceStatus,
  indexTracesById,
  metricIntegrityForEntity,
  type MetricTraceRecord,
} from "@/lib/nex-intelligence/trace";
import { buildBackendMetricTraceCatalog } from "@/lib/nex-intelligence/trace/build-catalog";
import {
  processMetaAiRecommendations,
  validateStructuredClaim,
  validateStructuredRecommendation,
} from "@/lib/nex-intelligence/validation";
import { textHasUnfoundedQualitativeLabel } from "@/lib/nex-intelligence/evidence/levels";

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

function payloadTwoCampaigns(): NexMetaAnalysisV1 {
  return {
    schema_version: "1.0.0",
    metadata: {
      source: "NEX",
      exported_at: "2026-11-03T08:00:00-03:00",
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
        id: "camp_clean",
        name: "Limpa",
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
          cpm: 100,
          results: 10,
          cost_per_result: 10,
        }),
        daily_insights: [],
        attribution_setting: null,
      },
      {
        id: "camp_spend_bad",
        name: "SpendBad",
        objective: "OUTCOME_LEADS",
        status: "ACTIVE",
        effective_status: "ACTIVE",
        buying_type: null,
        daily_budget: null,
        lifetime_budget: null,
        optimization_goal: null,
        result_metric: "lead",
        insights: insights({
          spend: 80,
          impressions: 800,
          clicks: 40,
          ctr: 5,
          cpc: 2,
          cpm: 100,
          results: 8,
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
}

function qualityWithGlobalAndLocalSpend(): MetaDataQualityReport {
  return {
    status: "WARNING",
    engine_version: "1.2.0",
    protocol_version: "1.2.0",
    validated_at: "2026-11-03T08:00:00.000Z",
    checks: [
      {
        code: "ACCOUNT_SPEND_TOTAL",
        level: "account",
        entity_id: "act_1",
        metric: "spend",
        consolidated_value: 180,
        compared_value: null,
        absolute_diff: null,
        relative_diff: null,
        severity: "WARNING",
        description: "Inconsistência global de spend (simulada).",
        possible_causes: ["reconciliação parcial"],
        state: "WARNING",
      },
      {
        code: "CAMPAIGN_SPEND_VS_ADSETS",
        level: "campaign",
        entity_id: "camp_spend_bad",
        metric: "spend",
        consolidated_value: 80,
        compared_value: 50,
        absolute_diff: 30,
        relative_diff: 0.375,
        severity: "WARNING",
        description: "Spend local inconsistente.",
        possible_causes: ["paginação"],
        state: "WARNING",
      },
    ],
    affected_metrics: ["spend"],
    compromised_metrics: ["spend"],
    verified_metrics: [],
    computed_metrics: {
      currency: "BRL",
      spend_total: 180,
      spend_total_cents: 18000,
      impressions_total: 1800,
      clicks_total: 90,
      results_total: 18,
      ctr: null,
      cpc: null,
      cpm: null,
      cost_per_result: null,
      basis: "campaign_insights_spend",
    },
  };
}

function ctrTrace(entityId: string, claimId: string): MetricTraceRecord {
  return {
    trace_id: `nx-tr-campaign-${entityId}-ctr`,
    entity_level: "campaign",
    entity_id: entityId,
    metric: "ctr",
    source: "META_MARKETING_API",
    source_level: "campaign",
    source_field: "insights.clicks+insights.impressions",
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
    used_by: [claimId],
  };
}

const payload = payloadTwoCampaigns();
const quality = qualityWithGlobalAndLocalSpend();

// --- Detecção de juízo de melhoria / desempenho ---
assert.equal(
  textHasUnfoundedQualitativeLabel("A campanha Limpa tem CTR que pode ser melhorado."),
  true,
  "detecta 'pode ser melhorado'",
);
for (const phrase of [
  "CTR de 1,936108 indica um desempenho razoável nas interações",
  "desempenho satisfatório no período",
  "resultado positivo de CTR",
  "bom desempenho da campanha",
  "performance razoável no CTR",
]) {
  assert.equal(
    textHasUnfoundedQualitativeLabel(phrase),
    true,
    `detecta juízo qualitativo: ${phrase}`,
  );
}

// --- R1: observação qualitativa sem E2 → recuperação E1 neutra ---
{
  const traces = indexTracesById({ version: "1.0", records: [ctrTrace("camp_clean", "obs-r1")] });
  const obs = validateStructuredClaim(
    {
      id: "obs-r1",
      entity_id: "camp_clean",
      level: "campaign",
      metrics_used: ["ctr"],
      trace_ids: ["nx-tr-campaign-camp_clean-ctr"],
      claim_kind: "descriptive",
      text: "A campanha Limpa registrou CTR de 5% que pode ser melhorado.",
    },
    payload,
    quality,
    [],
    traces,
  );
  assert.equal(obs.verdict, "APPROVED", `R1 obs recovered: ${obs.rejection_reasons.join(",")}`);
  assert.ok(obs.e1_claim_recovery?.applied, "R1 aplica recuperação E1");
  assert.ok(!/melhorad/i.test(obs.text), "R1 texto recuperado sem juízo");
  assert.match(obs.text, /CTR de 5/i);

  const blocked = validateStructuredClaim(
    {
      id: "obs-r1-block",
      entity_id: "camp_clean",
      level: "campaign",
      metrics_used: ["ctr"],
      trace_ids: ["nx-tr-campaign-camp_clean-ctr"],
      claim_kind: "descriptive",
      text: "A campanha Limpa registrou CTR de 5% que pode ser melhorado.",
    },
    payload,
    quality,
    [],
    traces,
    { skipE1ClaimRecovery: true },
  );
  assert.equal(blocked.verdict, "REJECTED", "R1 sem recovery permanece REJECTED");
  assert.ok(
    blocked.rejection_reasons.some((r) => r.includes("qualitative_judgment_without_validated_comparison")),
    `R1 block reasons: ${blocked.rejection_reasons.join(",")}`,
  );
}

// --- R1b: executive_point com o mesmo juízo → recuperação E1 ---
{
  const traces = indexTracesById({ version: "1.0", records: [ctrTrace("camp_clean", "exec-r1")] });
  const exec = validateStructuredClaim(
    {
      id: "exec-r1",
      entity_id: "camp_clean",
      level: "campaign",
      metrics_used: ["ctr"],
      trace_ids: ["nx-tr-campaign-camp_clean-ctr"],
      claim_kind: "descriptive",
      text: "CTR que pode ser melhorado na campanha Limpa.",
    },
    payload,
    quality,
    [],
    traces,
  );
  assert.equal(exec.verdict, "APPROVED", `R1b exec recovered: ${exec.rejection_reasons.join(",")}`);
  assert.ok(exec.e1_claim_recovery?.applied, "R1b aplica recuperação E1");
  assert.ok(!/melhorad|razo|satisfat|positiv|bom desempenho/i.test(exec.text));
}

// --- R1b2: exec-1 real — "desempenho razoável" sem E2 ---
{
  const traces = indexTracesById({ version: "1.0", records: [ctrTrace("camp_clean", "exec-1")] });
  const exec = validateStructuredClaim(
    {
      id: "exec-1",
      entity_id: "camp_clean",
      level: "campaign",
      metrics_used: ["ctr"],
      trace_ids: ["nx-tr-campaign-camp_clean-ctr"],
      claim_kind: "descriptive",
      text: "CTR de 5 indica um desempenho razoável nas interações",
    },
    payload,
    quality,
    [],
    traces,
  );
  assert.equal(exec.verdict, "APPROVED", `R1b2 recovered: ${exec.rejection_reasons.join(",")}`);
  assert.ok(exec.e1_claim_recovery?.applied, "R1b2 recovery applied");
  assert.ok(!/razo[aá]vel|desempenho/i.test(exec.text), `R1b2 neutro: ${exec.text}`);
  assert.match(exec.text, /CTR de 5/i);

  const rawReject = validateStructuredClaim(
    {
      id: "exec-1-raw",
      entity_id: "camp_clean",
      level: "campaign",
      metrics_used: ["ctr"],
      trace_ids: ["nx-tr-campaign-camp_clean-ctr"],
      claim_kind: "descriptive",
      text: "CTR de 5 indica um desempenho razoável nas interações",
    },
    payload,
    quality,
    [],
    traces,
    { skipE1ClaimRecovery: true },
  );
  assert.equal(rawReject.verdict, "REJECTED", "R1b2 sem recovery rejeita juízo qualitativo");
}

// --- R1c: recomendação monitor com juízo qualitativo ---
{
  const traces = indexTracesById({
    version: "1.0",
    records: [
      {
        ...ctrTrace("camp_clean", "rec-r1"),
        trace_id: "nx-tr-campaign-camp_clean-ctr",
        used_by: ["rec-r1"],
      },
    ],
  });
  const rec = validateStructuredRecommendation(
    {
      id: "rec-r1",
      entity_id: "camp_clean",
      level: "campaign",
      indicators_used: ["ctr"],
      evidence: ["CTR 5% que pode ser melhorado"],
      hypothesis: null,
      confidence: "medium",
      recommended_action: "Monitorar CTR da campanha Limpa",
      action_kind: "monitor",
      validation_criterion: "CTR permanece rastreável",
      trace_ids: ["nx-tr-campaign-camp_clean-ctr"],
    },
    payload,
    quality,
    traces,
    { skipCmsE1Recovery: true },
  );
  assert.equal(rec.verdict, "REJECTED", "R1c rec qualitative rejected");
  assert.ok(
    rec.rejection_reasons.some((r) => r.includes("unfounded_qualitative_label_without_comparison")),
    `R1c reasons: ${rec.rejection_reasons.join(",")}`,
  );
}

// --- R1d: pipeline publica fato descritivo e omite juízo qualitativo no resumo ---
{
  const catalog = buildBackendMetricTraceCatalog(payload, quality);
  const result = await processMetaAiRecommendations({
    rawText: JSON.stringify({
      format: "nex_intelligence_analysis_v1_2_0",
      stage1_markdown: "ok",
      observations: [
        {
          id: "obs-ok",
          entity_id: "camp_clean",
          level: "campaign",
          metrics_used: ["ctr"],
          trace_ids: ["nx-tr-campaign-camp_clean-ctr"],
          claim_kind: "descriptive",
          text: "A campanha Limpa registrou CTR de 5% no período.",
        },
        {
          id: "obs-bad",
          entity_id: "camp_clean",
          level: "campaign",
          metrics_used: ["ctr"],
          trace_ids: ["nx-tr-campaign-camp_clean-ctr"],
          claim_kind: "descriptive",
          text: "CTR que pode ser melhorado na campanha Limpa.",
        },
      ],
      recommendations: [],
      executive_points: [
        {
          id: "exec-bad",
          entity_id: "camp_clean",
          level: "campaign",
          metrics_used: ["ctr"],
          trace_ids: ["nx-tr-campaign-camp_clean-ctr"],
          claim_kind: "descriptive",
          text: "Prioridade: CTR que pode ser melhorado.",
        },
      ],
      metric_traceability: { version: "1.0", records: [] },
      stage2_markdown: "",
      stage4_markdown: "",
    }),
    payload,
    quality,
    backendTraceability: catalog,
  });
  assert.ok(result.audit.observations.some((o) => o.id === "obs-ok" && o.verdict === "APPROVED"));
  const obsBad = result.audit.observations.find((o) => o.id === "obs-bad");
  assert.ok(obsBad?.verdict === "APPROVED" && obsBad.e1_claim_recovery?.applied, "R1d obs-bad recuperada");
  const execBad = result.audit.executive_points.find((e) => e.id === "exec-bad");
  assert.ok(execBad?.verdict === "APPROVED" && execBad.e1_claim_recovery?.applied, "R1d exec-bad recuperada");
  assert.match(result.publishedMarkdown, /CTR de 5/i);
  assert.ok(!/pode ser melhorado|razo[aá]vel|satisfat[oó]rio|bom desempenho/i.test(result.publishedMarkdown), "R1d não publica juízo qualitativo");
}

// --- R2: propagação spend → CPC ---
{
  const integrity = buildCompromisedMetricIndex(quality);
  assert.equal(
    metricIntegrityForEntity(integrity, "camp_clean", "cpc").blocked,
    false,
    "R2 entidade limpa: CPC não bloqueado por spend account-wide",
  );
  assert.equal(
    metricIntegrityForEntity(integrity, "camp_spend_bad", "cpc").blocked,
    true,
    "R2 entidade comprometida: CPC bloqueado por spend local",
  );
  assert.equal(
    metricIntegrityForEntity(integrity, "camp_spend_bad", "cpm").blocked,
    true,
    "R2 entidade comprometida: CPM bloqueado",
  );
  assert.equal(
    metricIntegrityForEntity(integrity, "camp_clean", "ctr").blocked,
    false,
    "R2 CTR não depende de spend",
  );

  const catalog = buildBackendMetricTraceCatalog(payload, quality);
  const cleanCpc = catalog.records.find(
    (r) => r.entity_id === "camp_clean" && r.metric === "cpc" && r.validation.status === "PASS",
  );
  const badCpc = catalog.records.find((r) => r.entity_id === "camp_spend_bad" && r.metric === "cpc");
  assert.ok(cleanCpc, "R2 catálogo inclui CPC PASS da entidade limpa");
  assert.equal(badCpc, undefined, "R2 catálogo omite CPC da entidade com spend local comprometido");

  const forgedPass: MetricTraceRecord = {
    trace_id: "forged-cpc-bad",
    entity_level: "campaign",
    entity_id: "camp_spend_bad",
    metric: "cpc",
    source: "META_MARKETING_API",
    source_level: "campaign",
    source_field: "insights.spend",
    period: { since: "2026-10-01", until: "2026-10-31" },
    calculation: {
      type: "RATIO",
      formula: "spend / clicks",
      inputs: { spend: 80, clicks: 40 },
      result: 2,
    },
    validation: {
      status: "PASS",
      dependencies: ["spend", "clicks"],
      check_codes: [],
      reason: null,
    },
    used_by: [],
  };
  const det = computeDeterministicTraceStatus(forgedPass, payload, quality);
  assert.equal(det.status, "NOT_VERIFIABLE", "R2 CPC forjado não recebe PASS");
  assert.ok(det.reasons.some((r) => r.startsWith("dependency_compromised:spend")));
}

console.log("v120-qualitative-spend-regression.test.ts: ok");
