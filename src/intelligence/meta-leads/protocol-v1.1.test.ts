import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  META_AI_ANALYSIS_PROMPT,
  META_AI_CALIBRATION_REVIEW_PROMPT,
  META_AI_DATA_CONTRACT_VERSION,
  META_AI_ENGINE_VERSION,
  META_AI_PROTOCOL_VERSION,
  META_AI_SCOPE,
  metaAiPromptHash,
} from "./protocol";

const here = dirname(fileURLToPath(import.meta.url));

assert.equal(META_AI_PROTOCOL_VERSION, "1.1.1");
assert.equal(META_AI_ENGINE_VERSION, "1.1.1");
assert.equal(META_AI_DATA_CONTRACT_VERSION, "1.0.0");
assert.equal(META_AI_SCOPE, "meta_ads_performance_v1_1");
assert.equal(metaAiPromptHash().length, 16);

assert.match(META_AI_ANALYSIS_PROMPT, /Etapa 1 — Validação/i);
assert.match(META_AI_ANALYSIS_PROMPT, /data_quality/i);
assert.match(META_AI_ANALYSIS_PROMPT, /computed_metrics/i);
assert.match(META_AI_ANALYSIS_PROMPT, /métrica comprometida/i);
assert.match(META_AI_ANALYSIS_PROMPT, /Meta Marketing API/i);
assert.match(META_AI_CALIBRATION_REVIEW_PROMPT, /1\.1\.1/);

const casesDoc = JSON.parse(
  readFileSync(join(here, "ANALYSIS_TEST_CASES.json"), "utf8"),
) as { protocol_version: string; data_contract_version: string };
assert.equal(casesDoc.protocol_version, "1.1.1");
assert.equal(casesDoc.data_contract_version, "1.0.0");

const changelog = readFileSync(join(here, "ANALYSIS_CHANGELOG.md"), "utf8");
assert.match(changelog, /## 1\.1\.1/);
assert.match(changelog, /## 1\.1\.0/);

console.log("protocol-v1.1.test.ts: ok");
