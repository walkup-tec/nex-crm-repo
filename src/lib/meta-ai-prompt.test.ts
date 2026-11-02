import assert from "node:assert/strict";
import { extractOpenAiResponseText, metaAiUserPrompt } from "./meta-ai-prompt";
import type { NexMetaAnalysisV1 } from "./meta-export";
import { META_AI_ANALYSIS_PROMPT, META_AI_PROTOCOL_VERSION, metaAiPromptHash } from "../intelligence/meta-leads/protocol";
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

assert.equal(META_AI_PROTOCOL_VERSION, "1.0.0");
assert.match(META_AI_ANALYSIS_PROMPT, /leads/i);
assert.equal(metaAiPromptHash().length, 16);
assert.match(metaAiUserPrompt(sample), /Walkup/);

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
