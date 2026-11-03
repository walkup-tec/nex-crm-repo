/**
 * Regressão v1.3.0 — execução b05a266d-aa49-4401-8a22-f938af330f2c
 *
 * Sintomas publicados indevidamente:
 * - MONITOR com "reavaliar o investimento" (intervenção estratégica em E1)
 * - Evidências "perde eficiência" / "CPC acima do ideal" sem E2
 * - Resumo "CTR abaixo da expectativa" sem E2
 *
 * Esperado: juízos/estratégia rejeitados; CMS-E1 pode recuperar MONITOR neutro só com métricas E1.
 */
import assert from "node:assert/strict";
import type { MetaDataQualityReport } from "@/lib/nex-intelligence/quality/validate-export";
import type { NexMetaAnalysisV1 } from "@/lib/meta-export";
import { buildBackendMetricTraceCatalog } from "@/lib/nex-intelligence/trace/build-catalog";
import { indexTracesById } from "@/lib/nex-intelligence/trace";
import {
  processMetaAiRecommendations,
  validateStructuredClaim,
  validateStructuredRecommendation,
} from "@/lib/nex-intelligence/validation";
import {
  textHasStrategicInterventionInMonitor,
  textHasUnfoundedQualitativeLabel,
} from "@/lib/nex-intelligence/evidence/levels";

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

const ENTITY = "120254698455700651";

function payloadB05a(): NexMetaAnalysisV1 {
  return {
    schema_version: "1.0.0",
    metadata: {
      source: "NEX",
      exported_at: "2026-11-03T12:00:00-03:00",
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
        id: ENTITY,
        name: "Geral - Nex Ads [Eng. WhatsApp]",
        objective: "OUTCOME_ENGAGEMENT",
        status: "ACTIVE",
        effective_status: "ACTIVE",
        buying_type: null,
        daily_budget: null,
        lifetime_budget: null,
        optimization_goal: null,
        result_metric: "onsite_conversion.messaging_conversation_started_7d",
        insights: insights({
          spend: 200,
          impressions: 10000,
          clicks: 194,
          ctr: 1.94,
          cpc: 1.03,
          cpm: 20,
          results: 10,
        }),
        daily_insights: [],
        attribution_setting: null,
      },
      {
        id: "camp_site",
        name: "Nex Ads [Conv. Site]",
        objective: "OUTCOME_TRAFFIC",
        status: "ACTIVE",
        effective_status: "ACTIVE",
        buying_type: null,
        daily_budget: null,
        lifetime_budget: null,
        optimization_goal: null,
        result_metric: "link_click",
        insights: insights({
          spend: 100,
          impressions: 5000,
          clicks: 486,
          ctr: 9.72,
          cpc: 0.2,
          cpm: 20,
          results: 50,
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
    warnings: ["Alcance não deve ser somado entre entidades. Médias e percentuais não devem ser reaggregados sem a definição da Meta."],
  };
}

const quality: MetaDataQualityReport = {
  status: "NOT_VERIFIABLE",
  engine_version: "1.3.0",
  protocol_version: "1.3.0",
  validated_at: "2026-11-03T12:00:00Z",
  checks: [
    {
      code: "ACCOUNT_SPEND_RECONCILE",
      level: "account",
      entity_id: null,
      metric: "spend",
      consolidated_value: null,
      compared_value: null,
      absolute_diff: null,
      relative_diff: null,
      severity: "NOT_VERIFIABLE",
      description: "spend account not reconcilable",
      possible_causes: [],
      state: "NOT_VERIFIABLE",
    },
    {
      code: "ACCOUNT_RESULTS_RECONCILE",
      level: "account",
      entity_id: null,
      metric: "results",
      consolidated_value: null,
      compared_value: null,
      absolute_diff: null,
      relative_diff: null,
      severity: "NOT_VERIFIABLE",
      description: "results account not reconcilable",
      possible_causes: [],
      state: "NOT_VERIFIABLE",
    },
  ],
  affected_metrics: ["results", "spend"],
  compromised_metrics: ["results", "spend"],
  verified_metrics: ["ctr", "clicks", "impressions"],
  computed_metrics: {} as MetaDataQualityReport["computed_metrics"],
};

assert.equal(
  textHasUnfoundedQualitativeLabel("CTR atual perde eficiência em comparação a campanhas de maior sucesso"),
  true,
);
assert.equal(textHasUnfoundedQualitativeLabel("CPC acima do ideal considerando resultados"), true);
assert.equal(textHasUnfoundedQualitativeLabel("CTR abaixo da expectativa"), true);
assert.equal(
  textHasStrategicInterventionInMonitor("Monitorar de perto o desempenho e reavaliar o investimento"),
  true,
);

const payload = payloadB05a();
const catalog = buildBackendMetricTraceCatalog(payload, quality);
const traces = indexTracesById(catalog);
const ctrTrace = catalog.records.find((r) => r.entity_id === ENTITY && r.metric === "ctr");
assert.ok(ctrTrace, "CTR trace must exist");

const badMonitor = validateStructuredRecommendation(
  {
    id: "rec-b05a",
    entity_id: ENTITY,
    level: "campaign",
    indicators_used: ["ctr", "cpc"],
    evidence: [
      "CTR atual perde eficiência em comparação a campanhas de maior sucesso",
      "CPC acima do ideal considerando resultados",
    ],
    hypothesis: null,
    confidence: "medium",
    recommended_action: "Monitorar de perto o desempenho e reavaliar o investimento",
    action_kind: "monitor",
    validation_criterion: "Analisar a evolução do CTR e CPC ao longo das próximas datas",
    trace_ids: [ctrTrace!.trace_id],
  },
  payload,
  quality,
  traces,
);

// Após CMS-E1: ou REJECTED, ou APPROVED neutro sem intervenção/juízo
assert.ok(
  badMonitor.verdict === "REJECTED" ||
    (badMonitor.verdict === "APPROVED" &&
      badMonitor.cms_e1_recovery?.applied === true &&
      !textHasStrategicInterventionInMonitor(badMonitor.recommended_action) &&
      !textHasUnfoundedQualitativeLabel(
        `${badMonitor.recommended_action} ${badMonitor.evidence.join(" ")}`,
      )),
  `monitor gate failed: ${badMonitor.verdict} ${badMonitor.rejection_reasons.join(",")}`,
);

const badExec = validateStructuredClaim(
  {
    id: "exec-b05a",
    entity_id: ENTITY,
    level: "campaign",
    metrics_used: ["ctr"],
    trace_ids: [ctrTrace!.trace_id],
    claim_kind: "descriptive",
    text: "Campanha 'Geral - Nex Ads [Eng. WhatsApp]' com CTR abaixo da expectativa.",
  },
  payload,
  quality,
  [],
  traces,
);
assert.equal(badExec.verdict, "REJECTED", badExec.rejection_reasons.join(","));
assert.ok(
  badExec.rejection_reasons.some((r) => r.includes("qualitative") || r.includes("performance")),
);

const aiJson = JSON.stringify({
  format: "nex_intelligence_analysis_v1_3_0",
  stage1_markdown: "",
  observations: [
    {
      id: "obs-1",
      entity_id: ENTITY,
      level: "campaign",
      metrics_used: ["ctr"],
      trace_ids: [ctrTrace!.trace_id],
      claim_kind: "descriptive",
      text: "A campanha 'Geral - Nex Ads [Eng. WhatsApp]' apresentou um CTR de 1.94%.",
    },
  ],
  recommendations: [
    {
      id: "rec-b05a",
      entity_id: ENTITY,
      level: "campaign",
      indicators_used: ["ctr", "cpc"],
      evidence: [
        "CTR atual perde eficiência em comparação a campanhas de maior sucesso",
        "CPC acima do ideal considerando resultados",
      ],
      hypothesis: null,
      confidence: "medium",
      recommended_action: "Monitorar de perto o desempenho e reavaliar o investimento",
      action_kind: "monitor",
      validation_criterion: "Analisar a evolução do CTR e CPC ao longo das próximas datas",
      trace_ids: [ctrTrace!.trace_id],
    },
  ],
  executive_points: [
    {
      id: "exec-b05a",
      entity_id: ENTITY,
      level: "campaign",
      metrics_used: ["ctr"],
      trace_ids: [ctrTrace!.trace_id],
      claim_kind: "descriptive",
      text: "Campanha 'Geral - Nex Ads [Eng. WhatsApp]' com CTR abaixo da expectativa.",
    },
  ],
  stage2_markdown: "",
  stage4_markdown: "",
  metric_traceability: { version: "1.0", records: [] },
});

const processed = await processMetaAiRecommendations({
  rawText: aiJson,
  payload,
  quality,
  backendTraceability: catalog,
});

assert.ok(
  !processed.publishedMarkdown.includes("reavaliar o investimento"),
  "strategic monitor text must not be published",
);
assert.ok(
  !processed.publishedMarkdown.includes("abaixo da expectativa"),
  "qualitative executive must not be published",
);
assert.ok(
  !processed.publishedMarkdown.includes("perde eficiência"),
  "qualitative evidence must not be published",
);
assert.ok(
  processed.audit.executive_points.every((p) => p.verdict !== "APPROVED") ||
    !processed.publishedMarkdown.includes("expectativa"),
);

console.log("v130-b05a266d-regression.test.ts: ok");
