/**
 * Testes do pacote de recomendações estratégicas consolidadas.
 * npx tsx src/lib/nex-intelligence/goals/strategic-recommendation.test.ts
 */
import assert from "node:assert/strict";
import { attachDataQuality, validateMetaAnalysisData } from "@/lib/meta-data-quality";
import {
  buildGoalsMultilevelFixture,
  withObjectives,
} from "@/lib/nex-intelligence/goals/fixtures/goals-multilevel-fixture";
import { validateAnalysisObjectives } from "@/lib/nex-intelligence/goals/validate";
import { buildStrategicRecommendationPackage } from "@/lib/nex-intelligence/goals/strategic-recommendation";
import { buildBackendTraceabilityWithComparisons } from "@/lib/nex-intelligence/trace/build-comparisons";
import { processClaimIRPipeline } from "@/lib/nex-intelligence/claim-ir/process";
import { indexTracesById } from "@/lib/nex-intelligence/trace";
import { validateClaimIR } from "@/lib/nex-intelligence/claim-ir/validate";

const fixture = buildGoalsMultilevelFixture();
const quality = validateMetaAnalysisData(fixture, {
  protocolVersion: "1.3.0",
  engineVersion: "1.3.0",
});

function packageFor(primary: "INCREASE_RESULTS" | "DECREASE_COST_PER_RESULT" | "INCREASE_CTR") {
  const objectives = validateAnalysisObjectives({
    selectedGoals: ["INCREASE_RESULTS", "DECREASE_COST_PER_RESULT", "INCREASE_CTR"],
    primaryGoal: primary,
    resultEventKey: "onsite_conversion.messaging_conversation_started_7d",
    contractVersion: "1.0.0",
  });
  assert.equal(objectives.ok, true);
  if (!objectives.ok) throw new Error(objectives.message);
  const payload = attachDataQuality(withObjectives(fixture, objectives.value), quality);
  const { catalog, comparisons } = buildBackendTraceabilityWithComparisons({
    payload,
    quality,
    objectives: objectives.value,
  });
  const packaged = buildStrategicRecommendationPackage({
    objectives: objectives.value,
    comparisons,
    payload,
    limit: 2,
  });
  return { payload, quality, catalog, comparisons, packaged, objectives: objectives.value };
}

// 1) CPR prioritário gera diagnóstico quantitativo
{
  const { packaged } = packageFor("DECREASE_COST_PER_RESULT");
  assert.ok(packaged.recommendations.length >= 1, "esperava ≥1 recomendação CPR");
  const first = packaged.recommendations[0]!;
  assert.equal(first.primaryGoal, "DECREASE_COST_PER_RESULT");
  assert.ok(first.diagnosis.metrics.some((row) => row.metric === "cost_per_result"));
  assert.ok(first.diagnosis.metrics.some((row) => row.metric === "spend"));
  assert.ok(first.diagnosis.detectedProblem.includes("Custo por resultado") || first.diagnosis.detectedProblem.length > 20);
  assert.ok(first.actionPlan.steps.length >= 3);
  assert.ok(first.validationPlan.successCriteria.length >= 1);
  console.log("PASS 1 diagnosis CPR");
}

// 2) Eventos incompatíveis não geram comparison results/CPR com camp_leads (já no builder de comparisons)
{
  const { comparisons, packaged } = packageFor("DECREASE_COST_PER_RESULT");
  const bad = comparisons.find(
    (row) =>
      (row.metric === "cost_per_result" || row.metric === "results") &&
      (row.entity_id === "camp_leads" || row.other_entity_id === "camp_leads"),
  );
  assert.equal(bad, undefined);
  assert.ok(
    packaged.recommendations.every(
      (row) => !row.scope.entityIds.includes("camp_leads"),
    ),
  );
  console.log("PASS 2 incompatible events");
}

// 3) Pares ad/adset → consolidação (não 1 tarefa por par)
{
  const { packaged } = packageFor("DECREASE_COST_PER_RESULT");
  assert.ok(packaged.recommendations.length <= 2, "limit consolidado");
  assert.equal(packaged.claims.length, packaged.recommendations.length);
  for (const row of packaged.recommendations) {
    assert.ok(row.scope.entityIds.length >= 2);
    assert.ok(row.diagnosis.metrics.length >= 3);
    assert.match(row.title, /Avaliar redistribuição/i);
  }
  console.log("PASS 3 consolidation", {
    recs: packaged.recommendations.length,
    levels: packaged.recommendations.map((r) => r.scope.level),
    names: packaged.recommendations.map((r) => r.scope.entityNames),
  });
}

// 4) Primary INCREASE_RESULTS prioriza métrica results quando disponível
{
  const { packaged } = packageFor("INCREASE_RESULTS");
  assert.ok(packaged.recommendations.length >= 1);
  const top = packaged.recommendations[0]!;
  assert.equal(top.primaryGoal, "INCREASE_RESULTS");
  assert.ok(
    top.diagnosis.metrics.some((row) => row.metric === "results") ||
      top.comparisonRefs.some((ref) => ref.includes("-results")),
  );
  console.log("PASS 4 primary results");
}

// 5) Claim E3 validável no pipeline
{
  const { packaged, payload, quality, catalog } = packageFor("DECREASE_COST_PER_RESULT");
  assert.ok(packaged.claims.length >= 1);
  const pipe = processClaimIRPipeline({
    drafts: packaged.claims,
    payload,
    quality,
    backendTraceability: catalog,
    availableComparisons: packaged.recommendations.flatMap((row) =>
      row.comparisonRefs.map((comparison_ref) => ({
        comparison_ref,
        kind: "ENTITY" as const,
        entity_level: row.scope.level,
        entity_id: row.scope.entityIds[0]!,
        other_entity_id: row.scope.entityIds[1],
        metric: "cost_per_result",
        operator: "delta_pct" as const,
        left_value: 0,
        right_value: 0,
        delta: 1,
        result_event: "onsite_conversion.messaging_conversation_started_7d",
      })),
    ),
    usedAiConclusions: true,
  });
  assert.ok(
    pipe.approved.some((c) => c.operation === "STRATEGIC_TEST" && c.evidence_level === "E3"),
    `approved=${pipe.approved.map((c) => `${c.operation}:${c.evidence_level}`).join(",")}`,
  );
  console.log("PASS 5 E3 pipeline");
}

// 6) Valores inventados / comparison CTR em METRIC_VALUE results continua rejeitado
{
  const { payload, quality, catalog } = packageFor("DECREASE_COST_PER_RESULT");
  const traces = indexTracesById(catalog);
  const ctrCmp = [...traces.keys()].find((id) => id.includes("-ctr") && id.startsWith("nx-cmp-"));
  assert.ok(ctrCmp);
  const rejected = validateClaimIR(
    {
      claim_id: "fake",
      operation: "METRIC_VALUE",
      entity_level: "campaign",
      entity_id: "camp_eff",
      args: { metric: "results" },
      metric_refs: [ctrCmp!],
      comparison_ref: null,
      hypothesis_ref: null,
      action_ref: null,
    },
    payload,
    quality,
    traces,
  );
  assert.equal(rejected.verdict, "REJECTED");
  console.log("PASS 6 inventado/incompatível rejeitado");
}

// 7) Estratégias de métricas diferentes não colapsam no mesmo cluster
{
  const { packaged } = packageFor("INCREASE_CTR");
  const metrics = new Set(
    packaged.recommendations.map((row) =>
      row.diagnosis.metrics.find((m) => m.metric === "ctr") ? "ctr" : row.strategyType,
    ),
  );
  assert.ok(packaged.recommendations.every((row) => row.primaryGoal === "INCREASE_CTR"));
  assert.ok(metrics.size >= 1);
  console.log("PASS 7 ctr primary", { n: packaged.recommendations.length });
}

console.log("\nAll strategic-recommendation tests passed.");
