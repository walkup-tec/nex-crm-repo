/**
 * Regressão: execução estilo b1e78d81 — objetivos RESULTS+CPR sem comparison_ref
 * não podem publicar ação E3; com comparisons determinísticas, E3 válida passa.
 */
import assert from "node:assert/strict";
import { META_AI_ANALYSIS_PROMPT } from "@/intelligence/meta-leads/protocol";
import { attachDataQuality, validateMetaAnalysisData } from "@/lib/meta-data-quality";
import { metaAiUserPrompt } from "@/lib/meta-ai-prompt";
import {
  buildGoalsMultilevelFixture,
  withObjectives,
} from "@/lib/nex-intelligence/goals/fixtures/goals-multilevel-fixture";
import {
  isTechnicalMetaResultEventKey,
  resolveTechnicalResultEventKey,
} from "@/lib/nex-intelligence/goals/result-event";
import { validateAnalysisObjectives } from "@/lib/nex-intelligence/goals/validate";
import { processClaimIRPipeline } from "@/lib/nex-intelligence/claim-ir/process";
import { runMetaAnalysis } from "@/lib/nex-intelligence/pipeline/run-meta-analysis";
import {
  buildBackendTraceabilityWithComparisons,
  buildValidatedComparisonRecords,
} from "@/lib/nex-intelligence/trace/build-comparisons";
import { indexTracesById } from "@/lib/nex-intelligence/trace";
import { validateClaimIR } from "@/lib/nex-intelligence/claim-ir/validate";

const fixture = buildGoalsMultilevelFixture();
const quality = validateMetaAnalysisData(fixture, {
  protocolVersion: "1.3.0",
  engineVersion: "1.3.0",
});
assert.notEqual(quality.status, "FAIL");

const objectives = validateAnalysisObjectives({
  selectedGoals: ["INCREASE_RESULTS", "DECREASE_COST_PER_RESULT"],
  primaryGoal: "INCREASE_RESULTS",
  resultEventKey: "onsite_conversion.messaging_conversation_started_7d",
});
assert.equal(objectives.ok, true);
if (!objectives.ok) throw new Error(objectives.message);

const payload = attachDataQuality(withObjectives(fixture, objectives.value), quality);
const allComparisons = buildValidatedComparisonRecords({
  payload,
  quality,
  objectives: objectives.value,
});
const { catalog, comparisons } = buildBackendTraceabilityWithComparisons({
  payload,
  quality,
  objectives: objectives.value,
});

// 1) Comparações válidas geram refs rastreáveis (CPR campanha e anúncio).
const cprCmpCampaign = allComparisons.refs.find(
  (row) =>
    row.kind === "ENTITY" &&
    row.metric === "cost_per_result" &&
    row.entity_level === "campaign" &&
    ((row.entity_id === "camp_eff" && row.other_entity_id === "camp_costly") ||
      (row.entity_id === "camp_costly" && row.other_entity_id === "camp_eff")),
);
assert.ok(cprCmpCampaign, "esperava comparison CPR entre camp_eff e camp_costly");
assert.ok(comparisons.some((row) => row.comparison_ref === cprCmpCampaign.comparison_ref));

const cprCmp = allComparisons.refs.find(
  (row) =>
    row.kind === "ENTITY" &&
    row.metric === "cost_per_result" &&
    row.entity_level === "ad" &&
    ((row.entity_id === "ad_eff_stable" && row.other_entity_id === "ad_costly_high_cpc") ||
      (row.entity_id === "ad_costly_high_cpc" && row.other_entity_id === "ad_eff_stable")),
);
assert.ok(cprCmp, "esperava comparison CPR entre anúncios comparáveis");
assert.ok(catalog.records.some((row) => row.trace_id === cprCmp.comparison_ref));
assert.equal(
  catalog.records.find((row) => row.trace_id === cprCmp.comparison_ref)?.calculation.comparable,
  true,
);

// 2) Comparações inválidas (eventos incompatíveis) são bloqueadas para results/CPR.
const invalidLeadPair = comparisons.find(
  (row) =>
    row.metric === "cost_per_result" &&
    (row.entity_id === "camp_leads" || row.other_entity_id === "camp_leads"),
);
assert.equal(invalidLeadPair, undefined, "camp_leads não deve comparar CPR com WhatsApp");

// 3) resultEventKey Conversões é rejeitado.
const badEvent = validateAnalysisObjectives({
  selectedGoals: ["INCREASE_RESULTS"],
  resultEventKey: "Conversões",
});
assert.equal(badEvent.ok, false);
assert.equal(isTechnicalMetaResultEventKey("Conversões"), false);
assert.equal(
  resolveTechnicalResultEventKey(["Conversões", "onsite_conversion.messaging_conversation_started_7d"]),
  "onsite_conversion.messaging_conversation_started_7d",
);

// 4) Prompt lista comparisons e objetivos.
const prompt = metaAiUserPrompt(payload, catalog, comparisons);
assert.match(prompt, /available_comparisons/);
assert.match(prompt, /INCREASE_RESULTS/);
assert.match(prompt, new RegExp(cprCmpCampaign.comparison_ref));
assert.match(prompt, /NÃO invente comparison_ref/);

// 5) STRATEGIC_TEST sem comparison_ref NÃO é aprovado como E3 (fica rejeitado/recuperado MONITOR).
const traces = indexTracesById(catalog);
const focusAdId = "ad_costly_high_cpc";
const cprTrace =
  catalog.records.find(
    (row) =>
      row.metric === "cost_per_result" &&
      !row.trace_id.startsWith("nx-cmp-") &&
      row.entity_id === focusAdId,
  )?.trace_id ?? null;
assert.ok(cprTrace, "esperava metric_ref CPR no anúncio costly");

const withoutCmp = validateClaimIR(
  {
    claim_id: "rec-1",
    operation: "STRATEGIC_TEST",
    entity_level: "ad",
    entity_id: focusAdId,
    metric_refs: [cprTrace],
    comparison_ref: null,
    args: {
      action_kind: "test",
      action: "Testar realocação de orçamento",
      hypothesis: "CPR alto vs anúncio eficiente",
      validation_criterion: "CPR em 7 dias",
    },
  },
  payload,
  quality,
  traces,
);
assert.equal(withoutCmp.verdict, "REJECTED");
assert.ok(
  withoutCmp.rejection_reasons.some((r) => r.includes("comparison") || r.includes("strategic")),
);

const pipelineNoCmp = processClaimIRPipeline({
  drafts: [
    {
      claim_id: "rec-1",
      operation: "STRATEGIC_TEST",
      entity_level: "ad",
      entity_id: focusAdId,
      metric_refs: [cprTrace],
      comparison_ref: null,
      args: {
        action_kind: "test",
        action: "Inventar escala sem evidência",
        hypothesis: "sem base",
        validation_criterion: "nada",
      },
    },
  ],
  payload,
  quality,
  backendTraceability: catalog,
  usedAiConclusions: true,
});
assert.ok(
  !pipelineNoCmp.approved.some((c) => c.operation === "STRATEGIC_TEST"),
  "ação sem comparison não pode sobreviver como STRATEGIC_TEST",
);
assert.ok(
  pipelineNoCmp.approved.every((c) => c.operation === "MONITOR" || c.operation === "METRIC_VALUE"),
);

// 6) STRATEGIC_TEST com comparison_ref válida é aprovada (E3).
const withCmp = validateClaimIR(
  {
    claim_id: "rec-valid",
    operation: "STRATEGIC_TEST",
    entity_level: "ad",
    entity_id: focusAdId,
    metric_refs: [cprTrace],
    comparison_ref: cprCmp.comparison_ref,
    args: {
      action_kind: "test",
      action: "Testar redistribuição gradual de orçamento para criativo eficiente",
      hypothesis: "ad_costly_high_cpc tem CPR pior que ad_eff_stable no mesmo evento WhatsApp",
      validation_criterion: "CPR do anúncio em 7 dias",
    },
  },
  payload,
  quality,
  traces,
);
assert.equal(withCmp.verdict, "APPROVED", withCmp.rejection_reasons.join(","));
assert.equal(withCmp.evidence_level, "E3");

const pipelineValid = processClaimIRPipeline({
  drafts: [
    {
      claim_id: "obs-ctr",
      operation: "METRIC_VALUE",
      entity_level: "ad",
      entity_id: "ad_eff_ctr_drop",
      metric_refs: [
        catalog.records.find(
          (row) => row.entity_id === "ad_eff_ctr_drop" && row.metric === "ctr" && !row.trace_id.startsWith("nx-cmp-"),
        )?.trace_id,
      ].filter(Boolean),
      args: { metric: "ctr" },
    },
    {
      claim_id: "rec-valid",
      operation: "STRATEGIC_TEST",
      entity_level: "ad",
      entity_id: focusAdId,
      metric_refs: [cprTrace],
      comparison_ref: cprCmp.comparison_ref,
      args: {
        action_kind: "test",
        action: "Testar redistribuição gradual de orçamento para criativo eficiente",
        hypothesis: "ad_costly_high_cpc tem CPR pior que ad_eff_stable no mesmo evento WhatsApp",
        validation_criterion: "CPR do anúncio em 7 dias",
      },
    },
  ],
  payload,
  quality,
  backendTraceability: catalog,
  usedAiConclusions: true,
});
assert.ok(pipelineValid.approved.some((c) => c.claim_id === "rec-valid" && c.operation === "STRATEGIC_TEST"));
assert.ok(
  /redistribui|ad_costly_high_cpc|STRATEGIC_TEST|teste estratégico/i.test(
    pipelineValid.recommendations_markdown,
  ),
  `markdown inesperado: ${pipelineValid.recommendations_markdown.slice(0, 200)}`,
);

// 7) Objetivos influenciam o conjunto de comparisons (prioridade RESULTS ainda gera CPR/results).
const resultsCmp = comparisons.filter((row) => row.metric === "results" || row.metric === "cost_per_result");
assert.ok(resultsCmp.length > 0);

// 8) Pipeline completo: regeneração/IA sem comparison não publica ação inválida.
const run = await runMetaAnalysis({
  payload,
  quality,
  promptHash: "goals-cmp-regression",
  analysisSystemPrompt: META_AI_ANALYSIS_PROMPT,
  structuralSystemPrompt: "structural",
  regenerationSystemPrompt: "regen",
  backendTraceability: catalog,
  requestOpenAi: async ({ user }) => {
    assert.match(user, /available_comparisons/);
    return {
      model: "mock",
      text: JSON.stringify({
        format: "nex_intelligence_analysis_v1_3_0",
        observations: [],
        recommendations: [],
        executive_points: [],
        claim_ir: [
          {
            claim_id: "rec-1",
            operation: "STRATEGIC_TEST",
            entity_level: "ad",
            entity_id: focusAdId,
            metric_refs: [cprTrace],
            comparison_ref: null,
            args: {
              action_kind: "test",
              action: "Escalar sem evidência",
              hypothesis: "chute",
              validation_criterion: "nada",
            },
          },
          {
            claim_id: "rec-2",
            operation: "STRATEGIC_TEST",
            entity_level: "ad",
            entity_id: focusAdId,
            metric_refs: [cprTrace],
            comparison_ref: cprCmp.comparison_ref,
            args: {
              action_kind: "test",
              action: "Testar realocação para criativo eficiente",
              hypothesis: "CPR pior no mesmo evento",
              validation_criterion: "CPR 7d",
            },
          },
        ],
      }),
    };
  },
});

assert.ok(!run.processed.claimIr?.approved.some((c) => c.claim_id === "rec-1" && c.operation === "STRATEGIC_TEST"));
assert.ok(run.processed.claimIr?.approved.some((c) => c.claim_id === "rec-2" && c.operation === "STRATEGIC_TEST"));
assert.ok(!String(run.processed.publishedMarkdown || "").includes("Escalar sem evidência"));

const alone = buildValidatedComparisonRecords({
  payload: fixture,
  quality,
  objectives: null,
});
assert.ok(alone.refs.length > 0);

console.log(
  JSON.stringify(
    {
      comparisons_total: comparisons.length,
      cpr_comparison_ref: cprCmp.comparison_ref,
      approved_ops: run.processed.claimIr?.approved.map((c) => `${c.operation}:${c.claim_id}`),
      rejected_like_rec1: true,
      valid_rec2: true,
    },
    null,
    2,
  ),
);
console.log("PASS goals-comparison-regression");
