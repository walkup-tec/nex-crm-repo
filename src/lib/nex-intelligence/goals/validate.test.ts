import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  allNonEmptyGoalCombinations,
  validateAnalysisObjectives,
} from "@/lib/nex-intelligence/goals/validate";
import { composeGoalAnalysis } from "@/lib/nex-intelligence/goals/compose";
import { ANALYSIS_GOALS } from "@/lib/nex-intelligence/goals/types";

describe("validateAnalysisObjectives", () => {
  it("aceita cada objetivo isolado", () => {
    for (const goal of ANALYSIS_GOALS) {
      const result = validateAnalysisObjectives({
        selectedGoals: [goal],
      });
      assert.equal(result.ok, true);
      if (result.ok) {
        assert.equal(result.value.primaryGoal, goal);
        assert.deepEqual(result.value.selectedGoals, [goal]);
      }
    }
  });

  it("aceita as 15 combinações não vazias com primary válido", () => {
    const combos = allNonEmptyGoalCombinations();
    assert.equal(combos.length, 15);
    for (const selectedGoals of combos) {
      const primaryGoal = selectedGoals[selectedGoals.length - 1]!;
      const result = validateAnalysisObjectives({ selectedGoals, primaryGoal });
      assert.equal(result.ok, true, selectedGoals.join("+"));
      if (result.ok) {
        const composed = composeGoalAnalysis(result.value);
        assert.ok(composed.requiredMetrics.length >= 1);
        assert.equal(composed.primary.code, primaryGoal);
        assert.equal(
          composed.goalPairs.length,
          (selectedGoals.length * (selectedGoals.length - 1)) / 2,
        );
      }
    }
  });

  it("rejeita duplicados, prioridade inválida e unidade incompatível", () => {
    assert.equal(
      validateAnalysisObjectives({
        selectedGoals: ["INCREASE_CTR", "INCREASE_CTR"],
        primaryGoal: "INCREASE_CTR",
      }).ok,
      false,
    );
    assert.equal(
      validateAnalysisObjectives({
        selectedGoals: ["INCREASE_CTR", "DECREASE_CPC"],
        primaryGoal: "INCREASE_RESULTS",
      }).ok,
      false,
    );
    assert.equal(
      validateAnalysisObjectives({
        selectedGoals: ["INCREASE_CTR"],
        targets: [{ goal: "INCREASE_CTR", targetValue: 4, unit: "BRL" }],
      }).ok,
      false,
    );
  });

  it("aceita metas compatíveis", () => {
    const result = validateAnalysisObjectives({
      selectedGoals: ["DECREASE_COST_PER_RESULT", "INCREASE_RESULTS"],
      primaryGoal: "DECREASE_COST_PER_RESULT",
      targets: [
        { goal: "DECREASE_COST_PER_RESULT", targetValue: 6, unit: "BRL" },
        { goal: "INCREASE_RESULTS", targetValue: 50, unit: "COUNT" },
      ],
      resultEventKey: "onsite_conversion.messaging_conversation_started_7d",
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.value.targets?.length, 2);
      assert.equal(
        result.value.resultEventKey,
        "onsite_conversion.messaging_conversation_started_7d",
      );
    }
  });

  it("rejeita resultEventKey de rótulo Conversões", () => {
    const result = validateAnalysisObjectives({
      selectedGoals: ["INCREASE_RESULTS"],
      resultEventKey: "Conversões",
    });
    assert.equal(result.ok, false);
  });
});
