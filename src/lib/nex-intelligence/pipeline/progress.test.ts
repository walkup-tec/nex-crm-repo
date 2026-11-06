import assert from "node:assert/strict";
import {
  advancePipelineTo,
  completeAllPipelineSteps,
  createInitialPipelineProgress,
  inferPipelineProgress,
  markPipelineStep,
  readPipelineProgress,
  withPipelineProgress,
} from "@/lib/nex-intelligence/pipeline/progress";

const created = createInitialPipelineProgress();
assert.equal(created.steps.length, 4);
assert.ok(created.steps.every((step) => step.status === "pending"));

const advanced = advancePipelineTo(created, "ai_analysis");
assert.equal(advanced.steps[0]?.status, "completed");
assert.equal(advanced.steps[1]?.status, "completed");
assert.equal(advanced.steps[2]?.status, "running");
assert.equal(advanced.steps[3]?.status, "pending");

const failed = markPipelineStep(advanced, "ai_analysis", "error", "token inválido");
assert.equal(failed.steps[2]?.status, "error");
assert.equal(failed.steps[2]?.error, "token inválido");

const done = completeAllPipelineSteps(createInitialPipelineProgress());
const parsed = readPipelineProgress(withPipelineProgress({}, done));
assert.ok(parsed);
assert.equal(parsed?.steps.every((step) => step.status === "completed"), true);

const inferred = inferPipelineProgress({
  status: "error",
  errorMessage: "Conta não vinculada",
  accountId: "",
  model: "",
});
assert.equal(inferred.steps[0]?.status, "error");
assert.equal(inferred.steps[1]?.status, "pending");

console.log("pipeline progress ok");
