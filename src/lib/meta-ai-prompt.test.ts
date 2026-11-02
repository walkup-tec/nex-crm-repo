import assert from "node:assert/strict";
import type { MetaAiExecutionDetail } from "./meta-ai-calibration";
import {
  extractOpenAiResponseText,
  metaAiCalibrationReviewUserPrompt,
  metaAiUserPrompt,
} from "./meta-ai-prompt";
import type { NexMetaAnalysisV1 } from "./meta-export";
import {
  META_AI_ANALYSIS_PROMPT,
  META_AI_CALIBRATION_REVIEW_PROMPT,
  META_AI_PROTOCOL_VERSION,
  metaAiPromptHash,
} from "../intelligence/meta-leads/protocol";
import { buildZipStore } from "./simple-zip";

const sample: NexMetaAnalysisV1 = {
  schema_version: "1.0.0",
  metadata: {
    source: "NEX",
    exported_at: "2026-11-02T13:00:00-03:00",
    currency: "BRL",
    data_status: "live",
    organization_id: "org-1",
    client_name: "Walkup",
  },
  account: { id: "act_1", name: "Conta" },
  period: { since: "2026-10-01", until: "2026-10-31", timezone: "America/Sao_Paulo" },
  attribution: { setting: "unified", note: "" },
  campaigns: [],
  adsets: [],
  ads: [],
  business_outcomes: {
    leads_received: null,
    qualified_leads: null,
    appointments: null,
    sales: null,
    revenue: null,
  },
  warnings: [],
};

assert.equal(META_AI_PROTOCOL_VERSION, "1.1.6");
assert.match(META_AI_ANALYSIS_PROMPT, /Meta Marketing API/i);
assert.match(META_AI_ANALYSIS_PROMPT, /data_quality/i);
assert.equal(metaAiPromptHash().length, 16);
assert.match(metaAiUserPrompt(sample), /Walkup/);
assert.match(metaAiUserPrompt(sample), /motor 1\.1\.6/);
assert.match(META_AI_CALIBRATION_REVIEW_PROMPT, /calibração/i);
assert.match(META_AI_CALIBRATION_REVIEW_PROMPT, /1\.1\.6/);

const detail: MetaAiExecutionDetail = {
  id: "exec-1",
  createdAt: "2026-11-02T14:32:50.000Z",
  status: "ok",
  organizationId: "org-1",
  clientName: "Walkup",
  accountId: "act_1",
  accountName: "Conta",
  periodSince: "2026-10-01",
  periodUntil: "2026-10-31",
  periodTimezone: "America/Sao_Paulo",
  protocolVersion: "1.0.0",
  dataContractVersion: "1.0.0",
  model: "gpt-4o-mini",
  promptHash: "abc",
  warningCount: 0,
  analysisMarkdown: "# Análise",
  warnings: [],
  errorMessage: "",
  inputJson: sample,
  outputJson: { analysis_markdown: "# Análise" },
  calibrationFeedback: {},
};
assert.match(metaAiCalibrationReviewUserPrompt(detail), /input\.json/);
assert.match(metaAiCalibrationReviewUserPrompt(detail), /Walkup/);

assert.equal(
  extractOpenAiResponseText({
    output: [{ content: [{ type: "output_text", text: "Análise pronta." }] }],
  }),
  "Análise pronta.",
);

const zip = buildZipStore([
  { name: "input.json", content: "{\"ok\":true}" },
  { name: "analysis.md", content: "# ok" },
]);
assert.ok(zip.length > 40);
assert.equal(zip[0], 0x50);
assert.equal(zip[1], 0x4b);

console.log("meta-ai-prompt ok");
