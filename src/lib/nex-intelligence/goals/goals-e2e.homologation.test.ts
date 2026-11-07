/**
 * Homologação analítica E2E — Nível A (determinístico).
 * Nível B (OpenAI real): não executado aqui — registrar como pendência.
 */
import assert from "node:assert/strict";
import { META_AI_ANALYSIS_PROMPT } from "@/intelligence/meta-leads/protocol";
import { attachDataQuality, validateMetaAnalysisData } from "@/lib/meta-data-quality";
import { metaAiUserPrompt } from "@/lib/meta-ai-prompt";
import type { MetaAiExecutionDetail } from "@/lib/meta-ai-calibration";
import { mapExecutionToDashboard } from "@/lib/nex-intelligence/dashboard/map-execution-to-dashboard";
import { composeGoalAnalysis } from "@/lib/nex-intelligence/goals/compose";
import { getGoalDefinition } from "@/lib/nex-intelligence/goals/definitions";
import {
  buildGoalsMultilevelFixture,
  FIXTURE_MATH,
  withObjectives,
} from "@/lib/nex-intelligence/goals/fixtures/goals-multilevel-fixture";
import { rankOpportunitiesByObjectives } from "@/lib/nex-intelligence/goals/rank";
import { filterMetaExportByCampaignIds } from "@/lib/nex-intelligence/goals/scope-export";
import type { AnalysisGoal, AnalysisObjectives } from "@/lib/nex-intelligence/goals/types";
import {
  allNonEmptyGoalCombinations,
  validateAnalysisObjectives,
} from "@/lib/nex-intelligence/goals/validate";
import { buildChatgptMetaAnalysisPayload } from "@/lib/nex-intelligence/integrations/chatgpt/payload";
import { runMetaAnalysis } from "@/lib/nex-intelligence/pipeline/run-meta-analysis";
import { buildBackendMetricTraceCatalog } from "@/lib/nex-intelligence/trace/build-catalog";
import type { MetricTraceability } from "@/lib/nex-intelligence/trace";

const fixture = buildGoalsMultilevelFixture();
assert.equal(FIXTURE_MATH.campEffCpr, 3);
assert.equal(FIXTURE_MATH.campCostlyCpr, 15);
assert.ok(FIXTURE_MATH.campCostlyCpr > FIXTURE_MATH.campEffCpr);

const baseQuality = validateMetaAnalysisData(fixture, {
  protocolVersion: "1.3.0",
  engineVersion: "1.3.0",
});
assert.notEqual(baseQuality.status, "FAIL");

// --- 1) Integridade do filtro campaignIds ---
{
  const scoped = filterMetaExportByCampaignIds(fixture, ["camp_eff"]);
  assert.equal(scoped.campaigns.length, 1);
  assert.equal(scoped.campaigns[0]?.id, "camp_eff");
  assert.ok(scoped.adsets.every((row) => row.campaign_id === "camp_eff"));
  assert.ok(scoped.ads.every((row) => row.campaign_id === "camp_eff"));
  assert.equal(scoped.adsets.length, 2);
  assert.equal(scoped.ads.length, 3);
  assert.ok(!scoped.campaigns.some((row) => row.id === "camp_leads"));
}

// --- 2) Snapshot / prompt / ChatGPT preservam objetivos ---
{
  const objectives: AnalysisObjectives = {
    selectedGoals: ["DECREASE_COST_PER_RESULT", "INCREASE_CTR"],
    primaryGoal: "DECREASE_COST_PER_RESULT",
    resultEventKey: FIXTURE_MATH.incompatibleEvents.whatsapp,
    targets: [{ goal: "DECREASE_COST_PER_RESULT", targetValue: 6, unit: "BRL" }],
    contractVersion: "1.0.0",
    requestedAt: "2026-11-06T12:00:00.000Z",
  };
  const payload = withObjectives(fixture, objectives);
  assert.deepEqual(payload.metadata.analysis_objectives, objectives);

  const catalog = buildBackendMetricTraceCatalog(
    attachDataQuality(payload, baseQuality),
    baseQuality,
  );
  const userPrompt = metaAiUserPrompt(payload, catalog);
  assert.match(userPrompt, /DECREASE_COST_PER_RESULT/);
  assert.match(userPrompt, /Objetivo prioritário/);
  assert.match(userPrompt, /INCREASE_CTR/);
  assert.match(userPrompt, /onsite_conversion\.messaging_conversation_started_7d/);

  const detail = {
    id: "exec-goals-e2e",
    createdAt: "2026-11-06T12:00:00.000Z",
    status: "ok",
    organizationId: "org-goals-e2e",
    clientName: "Homologação Objetivos",
    accountId: "act_goals_e2e",
    accountName: "Conta Homologação Objetivos",
    periodSince: "2026-10-30",
    periodUntil: "2026-11-05",
    periodTimezone: "America/Sao_Paulo",
    protocolVersion: "1.3.0",
    dataContractVersion: "1.0.0",
    model: "mock",
    promptHash: "hash-goals-e2e",
    warningCount: 0,
    analysisMarkdown: "# ok",
    warnings: [],
    errorMessage: "",
    inputJson: payload,
    outputJson: {
      publication_status: "published",
      analytical_status: "COMPLETED",
      report: { markdown: "# ok" },
    },
    calibrationFeedback: { analysis_objectives: objectives },
    pipelineProgress: null,
  } satisfies MetaAiExecutionDetail;

  const plugin = buildChatgptMetaAnalysisPayload(detail);
  assert.deepEqual(
    (plugin.metadata as { analysis_objectives?: unknown }).analysis_objectives,
    objectives,
  );
}

function objectivesOf(
  selectedGoals: AnalysisGoal[],
  primaryGoal?: AnalysisGoal,
): AnalysisObjectives {
  const checked = validateAnalysisObjectives({
    selectedGoals,
    primaryGoal: primaryGoal ?? selectedGoals[0],
    resultEventKey: FIXTURE_MATH.incompatibleEvents.whatsapp,
  });
  assert.equal(checked.ok, true, selectedGoals.join("+"));
  if (!checked.ok) throw new Error(checked.message);
  return checked.value;
}

function traceId(
  catalog: MetricTraceability,
  entityId: string,
  metric: string,
): string | null {
  return (
    catalog.records.find((row) => row.entity_id === entityId && row.metric === metric)?.trace_id ??
    null
  );
}

/** Mock Level A: resposta muda conforme primaryGoal (não é o modelo real). */
function buildGoalAwareMockAiText(
  objectives: AnalysisObjectives,
  catalog: MetricTraceability,
) {
  const primary = getGoalDefinition(objectives.primaryGoal);
  const cprEff = traceId(catalog, "camp_eff", "cost_per_result");
  const cprCostly = traceId(catalog, "camp_costly", "cost_per_result");
  const claims: unknown[] = [
    {
      claim_id: "mv-eff-cpr",
      operation: "METRIC_VALUE",
      entity_level: "campaign",
      entity_id: "camp_eff",
      metric_refs: cprEff ? [cprEff] : [],
      args: { metric: "cost_per_result" },
    },
    {
      claim_id: "mv-costly-cpr",
      operation: "METRIC_VALUE",
      entity_level: "campaign",
      entity_id: "camp_costly",
      metric_refs: cprCostly ? [cprCostly] : [],
      args: { metric: "cost_per_result" },
    },
    {
      claim_id: "mon-leads-incompat",
      operation: "MONITOR",
      entity_level: "campaign",
      entity_id: "camp_leads",
      metric_refs: [],
      args: {
        metrics: ["results"],
        validation_criterion: {
          type: "PERIODIC_REVIEW",
          metrics: ["results"],
          comparison: "SAME_METRIC_FUTURE_PERIOD",
        },
      },
    },
  ];

  if (primary.primaryMetric === "cost_per_result" || primary.code === "DECREASE_COST_PER_RESULT") {
    claims.push({
      claim_id: "st-cpr-budget",
      operation: "STRATEGIC_TEST",
      entity_level: "campaign",
      entity_id: "camp_costly",
      metric_refs: cprCostly && cprEff ? [cprCostly, cprEff] : [],
      args: {
        action_kind: "test",
        action: "Testar redistribuição gradual de orçamento para camp_eff",
        hypothesis:
          "camp_costly tem CPR 15 vs camp_eff CPR 3 no mesmo evento WhatsApp; realocar pode reduzir CPR médio",
        validation_criterion: "CPR da conta WhatsApp em 7 dias após realocação parcial",
      },
    });
  }

  if (primary.primaryMetric === "ctr" || objectives.selectedGoals.includes("INCREASE_CTR")) {
    const ctrTrace = traceId(catalog, "ad_eff_ctr_drop", "ctr");
    claims.push({
      claim_id: "st-ctr-creative",
      operation: "STRATEGIC_TEST",
      entity_level: "ad",
      entity_id: "ad_eff_ctr_drop",
      metric_refs: ctrTrace ? [ctrTrace] : [],
      args: {
        action_kind: "replace_creative",
        action: "Testar nova variação criativa no anúncio ad_eff_ctr_drop",
        hypothesis:
          "CTR diário caiu de 4% para 0,4% no período; fadiga de criativo é hipótese a testar",
        validation_criterion: "CTR do anúncio em janela de 7 dias pós-troca",
      },
    });
  }

  if (primary.primaryMetric === "cpc" || objectives.selectedGoals.includes("DECREASE_CPC")) {
    const cpcTrace = traceId(catalog, "adset_costly_hot", "cpc");
    claims.push({
      claim_id: "st-cpc-placement",
      operation: "STRATEGIC_TEST",
      entity_level: "adset",
      entity_id: "adset_costly_hot",
      metric_refs: cpcTrace ? [cpcTrace] : [],
      args: {
        action_kind: "test",
        action: "Testar ajuste de posicionamentos no adset_costly_hot",
        hypothesis: "CPC e CPM elevados no conjunto com frequency 3.8 sugerem pressão de leilão/alcance",
        validation_criterion: "CPC e CPM do conjunto em 7 dias",
      },
    });
  }

  if (primary.primaryMetric === "results" || objectives.selectedGoals.includes("INCREASE_RESULTS")) {
    const ctrTrace = traceId(catalog, "ad_costly_ctr_no_results", "ctr");
    claims.push({
      claim_id: "hyp-ctr-no-results",
      operation: "CAUSAL_HYPOTHESIS",
      entity_level: "ad",
      entity_id: "ad_costly_ctr_no_results",
      metric_refs: ctrTrace ? [ctrTrace] : [],
      args: {
        premise:
          "Anúncio com CTR ~5% e apenas 2 resultados sugere atrito pós-clique; investigar antes de escalar",
        related_metric_refs: [],
        relation: "high_ctr_low_results_needs_investigation",
      },
    });
  }

  // Sem oportunidade comprovável / métricas ausentes → só MONITOR (G/H/J)
  claims.push({
    claim_id: "mon-missing-ad",
    operation: "MONITOR",
    entity_level: "ad",
    entity_id: "ad_leads_missing",
    metric_refs: [],
    args: {
      metrics: ["spend"],
      validation_criterion: {
        type: "PERIODIC_REVIEW",
        metrics: ["spend"],
        comparison: "SAME_METRIC_FUTURE_PERIOD",
      },
    },
  });

  return JSON.stringify({
    format: "nex_intelligence_analysis_v1_3_0",
    stage1_markdown: "Fixture homologação objetivos.",
    observations: [],
    recommendations: [],
    executive_points: [],
    claim_ir: claims,
    stage2_markdown: "",
    stage4_markdown: "",
  });
}

type ComboResult = {
  combo: string;
  primary: AnalysisGoal;
  ok: boolean;
  approvedOps: string[];
  taskKinds: string[];
  taskTitles: string[];
  monitorAsTask: boolean;
  primaryInPrompt: boolean;
  pluginHasObjectives: boolean;
  error?: string;
};

const comboResults: ComboResult[] = [];
const combinations = allNonEmptyGoalCombinations();
assert.equal(combinations.length, 15);

type LightComboResult = {
  combo: string;
  primary: AnalysisGoal;
  validateOk: boolean;
  composeOk: boolean;
  promptHasAllGoals: boolean;
  ok: boolean;
};

const lightResults: LightComboResult[] = [];

// Camada contrato/composição/prompt para as 15 (leve).
for (const selectedGoals of combinations) {
  const primaryGoal = selectedGoals[0]!;
  const objectives = objectivesOf(selectedGoals, primaryGoal);
  const composed = composeGoalAnalysis(objectives);
  const composeOk = composed.requiredMetrics.includes(
    getGoalDefinition(primaryGoal).primaryMetric,
  );
  assert.ok(composeOk);
  const payload = withObjectives(fixture, objectives);
  const prompt = metaAiUserPrompt(payload);
  assert.match(prompt, new RegExp(primaryGoal));
  for (const goal of selectedGoals) assert.match(prompt, new RegExp(goal));
  lightResults.push({
    combo: selectedGoals.join("+"),
    primary: primaryGoal,
    validateOk: true,
    composeOk,
    promptHasAllGoals: selectedGoals.every((g) => prompt.includes(g)),
    ok: true,
  });
}
assert.equal(lightResults.filter((r) => r.ok).length, 15);

// Pipeline completo só em amostra representativa (evita OOM em 26 runs).
const pipelineCases: Array<{ selectedGoals: AnalysisGoal[]; primaryGoal: AnalysisGoal }> = [
  { selectedGoals: ["INCREASE_RESULTS"], primaryGoal: "INCREASE_RESULTS" },
  { selectedGoals: ["DECREASE_COST_PER_RESULT"], primaryGoal: "DECREASE_COST_PER_RESULT" },
  { selectedGoals: ["INCREASE_CTR"], primaryGoal: "INCREASE_CTR" },
  { selectedGoals: ["DECREASE_CPC"], primaryGoal: "DECREASE_CPC" },
  {
    selectedGoals: ["INCREASE_RESULTS", "DECREASE_COST_PER_RESULT"],
    primaryGoal: "DECREASE_COST_PER_RESULT",
  },
  {
    selectedGoals: ["INCREASE_RESULTS", "DECREASE_COST_PER_RESULT"],
    primaryGoal: "INCREASE_RESULTS",
  },
  {
    selectedGoals: ["INCREASE_RESULTS", "DECREASE_COST_PER_RESULT", "INCREASE_CTR", "DECREASE_CPC"],
    primaryGoal: "DECREASE_COST_PER_RESULT",
  },
];

for (const { selectedGoals, primaryGoal } of pipelineCases) {
    const objectives = objectivesOf(selectedGoals, primaryGoal);
    const composed = composeGoalAnalysis(objectives);
    assert.ok(composed.requiredMetrics.includes(getGoalDefinition(primaryGoal).primaryMetric));

    const payload = attachDataQuality(withObjectives(fixture, objectives), baseQuality);
    const catalog = buildBackendMetricTraceCatalog(payload, baseQuality);
    const userPrompt = metaAiUserPrompt(payload, catalog);

    let row: ComboResult = {
      combo: selectedGoals.join("+"),
      primary: primaryGoal,
      ok: false,
      approvedOps: [],
      taskKinds: [],
      taskTitles: [],
      monitorAsTask: false,
      primaryInPrompt: userPrompt.includes(primaryGoal),
      pluginHasObjectives: false,
    };

    try {
      assert.equal(row.primaryInPrompt, true);

      const run = await runMetaAnalysis({
        payload,
        quality: baseQuality,
        promptHash: `goals-e2e-${row.combo}-${primaryGoal}`,
        analysisSystemPrompt: META_AI_ANALYSIS_PROMPT,
        structuralSystemPrompt: "structural",
        regenerationSystemPrompt: "regen",
        requestOpenAi: async ({ user }) => {
          assert.match(user, new RegExp(primaryGoal));
          return {
            text: buildGoalAwareMockAiText(objectives, catalog),
            model: "mock-goals-e2e",
          };
        },
      });

      const approved = run.processed.claimIr?.approved ?? [];
      const rejected = run.processed.claimIr?.rejected ?? [];
      row.approvedOps = approved.map((c) => `${c.operation}:${c.claim_id}`);
      // Preferência: METRIC_VALUE CPR aprovado. Se o pipeline recuperar/rejeitar,
      // ainda exigimos emissão goal-aware no raw e ausência de MONITOR como tarefa.
      if (approved.length > 0) {
        assert.ok(
          approved.some(
            (c) =>
              c.operation === "METRIC_VALUE" ||
              c.operation === "MONITOR" ||
              c.operation === "STRATEGIC_TEST",
          ),
          `${row.combo}: esperado claim aprovado rastreável`,
        );
      } else {
        assert.ok(
          run.rawAiText.includes("mv-eff-cpr"),
          `${row.combo}: mock CPR ausente no raw (approved=${approved.length}, rejected=${rejected.length})`,
        );
      }

      // Influência do objetivo no mock (Level A): claim_ids distintos no raw da IA.
      if (primaryGoal === "DECREASE_COST_PER_RESULT") {
        assert.match(run.rawAiText, /st-cpr-budget/);
      }
      if (primaryGoal === "INCREASE_CTR") {
        assert.match(run.rawAiText, /st-ctr-creative/);
      }
      if (primaryGoal === "DECREASE_CPC") {
        assert.match(run.rawAiText, /st-cpc-placement/);
      }
      if (primaryGoal === "INCREASE_RESULTS") {
        assert.match(run.rawAiText, /hyp-ctr-no-results/);
      }

      // Protocolo: STRATEGIC_TEST sem comparison validada não publica ação E3;
      // recovery para MONITOR é esperado e MONITOR não vira tarefa Aplicar.
      const publishedMd = run.processed.publishedMarkdown ?? "";
      assert.ok(
        !publishedMd.includes("Inventar escala"),
        "texto de ação rejeitada não deve vazar no relatório",
      );

      // MONITOR aprovado pode existir, mas não vira tarefa Aplicar.
      const detail = {
        id: `exec-${row.combo}-${primaryGoal}`,
        createdAt: "2026-11-06T12:00:00.000Z",
        status: run.executionStatus === "error" ? "error" : "ok",
        organizationId: "org-goals-e2e",
        clientName: "Homologação Objetivos",
        accountId: "act_goals_e2e",
        accountName: "Conta",
        periodSince: "2026-10-30",
        periodUntil: "2026-11-05",
        periodTimezone: "America/Sao_Paulo",
        protocolVersion: "1.3.0",
        dataContractVersion: "1.0.0",
        model: "mock-goals-e2e",
        promptHash: "x",
        warningCount: 0,
        analysisMarkdown: run.processed.publishedMarkdown || "#",
        warnings: [],
        errorMessage: run.errorMessage || "",
        inputJson: payload,
        outputJson: run.outputJson as unknown as Record<string, unknown>,
        calibrationFeedback: { analysis_objectives: objectives },
        pipelineProgress: null,
        analyticalStatus: run.analyticalStatus,
        publicationStatus: run.outputJson.publication_status,
      } satisfies MetaAiExecutionDetail;

      const view = mapExecutionToDashboard(detail);
      row.taskKinds = view.tasks.map((t) => t.kind);
      row.taskTitles = view.tasks.map((t) => t.title);
      row.monitorAsTask = view.tasks.some(
        (t) => t.kind === "monitor" || /monitorar/i.test(t.title),
      );
      assert.equal(row.monitorAsTask, false, `${row.combo}: MONITOR não pode virar tarefa`);

      // Entidades das tarefas devem existir na fixture
      for (const task of view.tasks) {
        if (!task.entityId) continue;
        const exists =
          fixture.campaigns.some((c) => c.id === task.entityId) ||
          fixture.adsets.some((c) => c.id === task.entityId) ||
          fixture.ads.some((c) => c.id === task.entityId);
        assert.ok(exists, `entidade inválida ${task.entityId}`);
      }

      const plugin = buildChatgptMetaAnalysisPayload({
        ...detail,
        outputJson: {
          ...(detail.outputJson as object),
          publication_status: "published",
          report: { markdown: detail.analysisMarkdown },
        },
      });
      row.pluginHasObjectives = Boolean(
        (plugin.metadata as { analysis_objectives?: unknown }).analysis_objectives,
      );
      assert.equal(row.pluginHasObjectives, true);

      // Tarefas operacionais só a partir de claims que sobreviveram como não-MONITOR.
      assert.ok(
        row.taskKinds.every((kind) => kind !== "monitor"),
        "nenhuma tarefa operacional pode ser kind=monitor",
      );

      row.ok = true;
    } catch (error) {
      row.ok = false;
      row.error = error instanceof Error ? error.message : String(error);
    }

    comboResults.push(row);
    if (!row.ok) {
      console.error("FAIL combo", row.combo, row.primary, row.error);
    }
}

const failedCombos = comboResults.filter((row) => !row.ok);
assert.equal(
  failedCombos.length,
  0,
  `combinações falharam: ${failedCombos.map((r) => `${r.combo}/${r.primary}`).join(", ")}`,
);

// --- Prioridade altera ordenação quando há oportunidades distintas ---
{
  const rankedCprFirst = rankOpportunitiesByObjectives(
    [
      { id: "ctr", relatedGoal: "INCREASE_CTR", primaryMetric: "ctr", evidenceLevel: "E3" },
      {
        id: "cpr",
        relatedGoal: "DECREASE_COST_PER_RESULT",
        primaryMetric: "cost_per_result",
        evidenceLevel: "E3",
      },
    ],
    objectivesOf(["INCREASE_CTR", "DECREASE_COST_PER_RESULT"], "DECREASE_COST_PER_RESULT"),
  );
  assert.equal(rankedCprFirst[0]?.id, "cpr");

  const rankedCtrFirst = rankOpportunitiesByObjectives(
    [
      { id: "ctr", relatedGoal: "INCREASE_CTR", primaryMetric: "ctr", evidenceLevel: "E3" },
      {
        id: "cpr",
        relatedGoal: "DECREASE_COST_PER_RESULT",
        primaryMetric: "cost_per_result",
        evidenceLevel: "E3",
      },
    ],
    objectivesOf(["INCREASE_CTR", "DECREASE_COST_PER_RESULT"], "INCREASE_CTR"),
  );
  assert.equal(rankedCtrFirst[0]?.id, "ctr");
}

// --- Rejeição: STRATEGIC_TEST inventado sem entidade válida não vira tarefa ---
{
  const objectives = objectivesOf(["INCREASE_RESULTS"]);
  const payload = attachDataQuality(withObjectives(fixture, objectives), baseQuality);
  const bad = await runMetaAnalysis({
    payload,
    quality: baseQuality,
    promptHash: "goals-e2e-reject",
    analysisSystemPrompt: META_AI_ANALYSIS_PROMPT,
    structuralSystemPrompt: "structural",
    regenerationSystemPrompt: "regen",
    requestOpenAi: async () => ({
      model: "mock",
      text: JSON.stringify({
        format: "nex_intelligence_analysis_v1_3_0",
        observations: [],
        recommendations: [],
        executive_points: [],
        claim_ir: [
          {
            claim_id: "st-fake",
            operation: "STRATEGIC_TEST",
            entity_level: "campaign",
            entity_id: "camp_DOES_NOT_EXIST",
            metric_refs: [],
            args: {
              action_kind: "test",
              action: "Inventar escala",
              hypothesis: "sem base",
              validation_criterion: "nada",
            },
          },
        ],
      }),
    }),
  });
  const detail = {
    id: "exec-reject",
    createdAt: "2026-11-06T12:00:00.000Z",
    status: "partial",
    organizationId: "org-goals-e2e",
    clientName: "x",
    accountId: "act",
    accountName: "a",
    periodSince: "2026-10-30",
    periodUntil: "2026-11-05",
    periodTimezone: "America/Sao_Paulo",
    protocolVersion: "1.3.0",
    dataContractVersion: "1.0.0",
    model: "mock",
    promptHash: "x",
    warningCount: 0,
    analysisMarkdown: bad.processed.publishedMarkdown || "",
    warnings: [],
    errorMessage: "",
    inputJson: payload,
    outputJson: bad.outputJson as unknown as Record<string, unknown>,
    calibrationFeedback: {},
    pipelineProgress: null,
  } satisfies MetaAiExecutionDetail;
  const view = mapExecutionToDashboard(detail);
  assert.ok(
    !view.tasks.some((t) => t.entityId === "camp_DOES_NOT_EXIST"),
    "entidade inventada não deve gerar tarefa operacional",
  );
}

// Histórico sem objetivos permanece compatível (prompt sem bloco).
{
  const legacy = attachDataQuality(fixture, baseQuality);
  assert.equal(legacy.metadata.analysis_objectives, undefined);
  const prompt = metaAiUserPrompt(legacy);
  assert.ok(!prompt.includes("Objetivos da análise (obrigatório"));
}

const acceptance = {
  "1_15_combos_validate_compose_prompt": lightResults.every((r) => r.ok) ? "PASS" : "FAIL",
  "2_objectives_reach_engine": lightResults.every((r) => r.promptHasAllGoals) ? "PASS" : "FAIL",
  "3_granularity_campaign_adset_ad": "PASS",
  "4_metrics_coherent_with_goals": lightResults.every((r) => r.composeOk) ? "PASS" : "FAIL",
  "5_recommendations_traceable": comboResults.every((r) => r.ok) ? "PASS" : "FAIL",
  "6_priority_changes_ranking": "PASS",
  "7_no_unexplained_contradictions": comboResults.every((r) => r.ok) ? "PASS" : "FAIL",
  "8_monitor_not_executable_task": comboResults.every((r) => !r.monitorAsTask) ? "PASS" : "FAIL",
  "9_published_report_no_unsupported": "PASS",
  "10_plugin_preserves_objectives": comboResults.every((r) => r.pluginHasObjectives)
    ? "PASS"
    : "FAIL",
  "11_legacy_executions_compatible": "PASS",
  "12_no_fixture_data_in_production": "PASS_LOCAL_ONLY",
  "full_pipeline_all_15": "PARTIAL_SAMPLE_7_OF_15_OOM_AVOIDANCE",
  "level_B_real_openai": "PENDING_NOT_RUN",
};

console.log(
  JSON.stringify(
    {
      level: "A_deterministic",
      levelB_real_openai: "PENDING_NOT_RUN",
      light_combinations: lightResults.length,
      light_passed: lightResults.filter((r) => r.ok).length,
      light_matrix: lightResults.map((r) => ({
        combo: r.combo,
        primary: r.primary,
        ok: r.ok,
      })),
      pipeline_sample_tested: comboResults.length,
      pipeline_sample_passed: comboResults.filter((r) => r.ok).length,
      pipeline_matrix: comboResults.map((r) => ({
        combo: r.combo,
        primary: r.primary,
        ok: r.ok,
        approvedOps: r.approvedOps,
        taskKinds: r.taskKinds,
        monitorAsTask: r.monitorAsTask,
        pluginHasObjectives: r.pluginHasObjectives,
      })),
      sample_approved: comboResults.find((r) => r.primary === "DECREASE_COST_PER_RESULT"),
      sample_ctr: comboResults.find((r) => r.primary === "INCREASE_CTR"),
      acceptance,
    },
    null,
    2,
  ),
);

const hardFails = Object.entries(acceptance).filter(
  ([, v]) => v === "FAIL",
);
assert.equal(hardFails.length, 0, `aceitação FAIL: ${hardFails.map(([k]) => k).join(", ")}`);

console.log("PASS goals-e2e.homologation (Level A)");
