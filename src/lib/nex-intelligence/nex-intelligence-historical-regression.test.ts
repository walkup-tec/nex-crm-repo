import assert from "node:assert/strict";
import { parseStructuredAnalysis } from "@/lib/nex-intelligence/ai-output/parse";

const legacy = parseStructuredAnalysis(
  JSON.stringify({
    format: "nex_intelligence_analysis_v1_1_8",
    stage1_markdown: "ok",
    observations: [],
    recommendations: [],
    executive_points: [],
    metric_traceability: { version: "1.0", records: [] },
  }),
);

assert.equal(legacy.parse_ok, true);
assert.equal(legacy.format, "nex_intelligence_analysis_v1_1_8");

const current = parseStructuredAnalysis(
  JSON.stringify({
    format: "nex_intelligence_analysis_v1_2_0",
    stage1_markdown: "ok",
    observations: [],
    recommendations: [],
    executive_points: [],
    metric_traceability: { version: "1.0", records: [] },
  }),
);

assert.equal(current.parse_ok, true);
assert.equal(current.format, "nex_intelligence_analysis_v1_2_0");

console.log("nex-intelligence-historical-regression.test.ts: ok");
