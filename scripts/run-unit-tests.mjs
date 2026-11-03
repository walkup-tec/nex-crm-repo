import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const META_TEST_FILES = [
  "src/intelligence/meta-leads/protocol-v1.1.test.ts",
  "src/lib/chatgpt-integration.test.ts",
  "src/lib/meta-ai-calibration.test.ts",
  "src/lib/meta-ai-prompt.test.ts",
  "src/lib/meta-analysis.test.ts",
  "src/lib/meta-cms-e1.test.ts",
  "src/lib/meta-data-quality.test.ts",
  "src/lib/meta-evidence-levels.test.ts",
  "src/lib/meta-export.test.ts",
  "src/lib/meta-metric-traceability.test.ts",
  "src/lib/meta-metrics.test.ts",
  "src/lib/meta-recommendation-validation.test.ts",
  "src/lib/nex-deploy.test.ts",
  "src/lib/nex-intelligence/nex-intelligence-historical-regression.test.ts",
  "src/lib/nex-intelligence/pipeline/run-meta-analysis.pipeline.test.ts",
  "src/lib/nex-intelligence/pipeline/four-campaign-ctr-acceptance.test.ts",
  "src/lib/nex-intelligence/pipeline/v120-qualitative-spend-regression.test.ts",
  "src/lib/nex-intelligence/pipeline/v130-invariants.test.ts",
  "src/lib/nex-intelligence/pipeline/v130-b05a266d-regression.test.ts",
  "src/lib/nex-intelligence/pipeline/v130-publication-adversarial.test.ts",
  "src/lib/nex-intelligence/pipeline/v130-monitor-e1-recovery.test.ts",
  "src/server/openai.server.test.ts",
];

const root = join(fileURLToPath(import.meta.url), "..", "..");
const files = META_TEST_FILES.map((rel) => join(root, rel));

let failed = 0;
for (const file of files) {
  const rel = file.slice(root.length + 1);
  const run = spawnSync("npx", ["tsx", file], {
    cwd: root,
    stdio: "inherit",
    shell: true,
  });
  if (run.status !== 0) {
    console.error(`FAIL ${rel}`);
    failed += 1;
  }
}

if (failed) {
  console.error(`\n${failed} test file(s) failed (${files.length} total).`);
  process.exit(1);
}

console.log(`\nAll ${files.length} test files passed.`);
