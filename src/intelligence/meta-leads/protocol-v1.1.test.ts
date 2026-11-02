import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  META_AI_ANALYSIS_PROMPT,
  META_AI_CALIBRATION_REVIEW_PROMPT,
  META_AI_DATA_CONTRACT_VERSION,
  META_AI_PROTOCOL_VERSION,
  META_AI_SCOPE,
  META_AI_TEST_CASES,
  metaAiPromptHash,
} from "./protocol";

const here = dirname(fileURLToPath(import.meta.url));

assert.equal(META_AI_PROTOCOL_VERSION, "1.1.0");
assert.equal(META_AI_DATA_CONTRACT_VERSION, "1.0.0");
assert.equal(META_AI_SCOPE, "meta_ads_performance_v1_1");
assert.equal(metaAiPromptHash().length, 16);
assert.notEqual(metaAiPromptHash(), metaAiPromptHash("legacy"));

const prompt = META_AI_ANALYSIS_PROMPT;
assert.match(prompt, /Meta Marketing API/i);
assert.match(prompt, /Fonte exclusiva/i);
assert.match(prompt, /business_outcomes/i);
assert.match(prompt, /NÃO deve gerar alertas/i);
assert.match(prompt, /conversas iniciadas/i);
assert.match(prompt, /único indicador isolado/i);
assert.match(prompt, /consistência entre campanhas, conjuntos, anúncios/i);
assert.match(prompt, /extração, atribuição e agregação/i);
assert.match(prompt, /Não dependa de dados comerciais externos/i);
assert.match(prompt, /ignorados sem comentário/i);

const review = META_AI_CALIBRATION_REVIEW_PROMPT;
assert.match(review, /1\.1\.0/);
assert.match(review, /sem alertas por ausência de vendas\/CRM/i);

const casesDoc = JSON.parse(
  readFileSync(join(here, "ANALYSIS_TEST_CASES.json"), "utf8"),
) as {
  protocol_version: string;
  data_contract_version: string;
  cases: Array<{ id: string }>;
};
assert.equal(casesDoc.protocol_version, "1.1.0");
assert.equal(casesDoc.data_contract_version, "1.0.0");
assert.ok(casesDoc.cases.some((item) => item.id === "meta-null-business-outcomes"));

for (const item of META_AI_TEST_CASES) {
  assert.ok(casesDoc.cases.some((row) => row.id === item.id), `caso ausente: ${item.id}`);
}

const protocolMd = readFileSync(join(here, "ANALYSIS_PROTOCOL.md"), "utf8");
const promptMd = readFileSync(join(here, "ANALYSIS_PROMPT.md"), "utf8");
const changelog = readFileSync(join(here, "ANALYSIS_CHANGELOG.md"), "utf8");
assert.match(protocolMd, /v1\.1\.0/);
assert.match(protocolMd, /não.*gera alertas/i);
assert.match(promptMd, /v1\.1\.0/);
assert.ok(promptMd.includes(META_AI_ANALYSIS_PROMPT.slice(0, 80)));
assert.match(changelog, /## 1\.1\.0/);
assert.match(changelog, /## 1\.0\.0/);

console.log("protocol-v1.1.test.ts: ok");
