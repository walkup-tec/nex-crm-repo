import assert from "node:assert/strict";
import {
  buildChatgptMetaAnalysisPayload,
  chatgptOpenApiDocument,
  consumeRateLimit,
  extractBearerToken,
  getMetaAnalysisExecutionToolDefinition,
  isExecutionUuid,
  orgAllowed,
  parseOrgAllowlist,
  scrubSensitive,
  secretsMatch,
  CHATGPT_META_ANALYSIS_TOOL,
} from "./chatgpt-integration";
import type { MetaAiExecutionDetail } from "./meta-ai-calibration";
import type { NexMetaAnalysisV1 } from "./meta-export";
import { authenticateChatgptIntegration } from "../server/chatgpt-integration.server";

assert.equal(isExecutionUuid("dd47e476-fad6-481e-b7d9-81b07264ff85"), true);
assert.equal(isExecutionUuid("not-a-uuid"), false);
assert.equal(isExecutionUuid(""), false);

assert.equal(secretsMatch("secret-a", "secret-a"), true);
assert.equal(secretsMatch("secret-a", "secret-b"), false);
assert.equal(extractBearerToken("Bearer abc123"), "abc123");
assert.equal(extractBearerToken("Basic abc"), "");

assert.deepEqual(parseOrgAllowlist(" a ,b,"), ["a", "b"]);
assert.equal(orgAllowed("org-1", []), true);
assert.equal(orgAllowed("org-1", ["org-2"]), false);
assert.equal(orgAllowed("org-1", ["org-1"]), true);

const dirty = scrubSensitive({
  spend: 10,
  access_token: "EAASECRET",
  nested: { api_key: "x", ctr: 1.2 },
});
assert.equal((dirty as { spend: number }).spend, 10);
assert.equal("access_token" in (dirty as object), false);
assert.deepEqual((dirty as { nested: { ctr: number } }).nested, { ctr: 1.2 });

const sampleInput: NexMetaAnalysisV1 = {
  schema_version: "1.0.0",
  metadata: {
    source: "NEX",
    exported_at: "2026-11-02T13:00:00-03:00",
    currency: "BRL",
    data_status: "live",
    organization_id: "org-1",
    client_name: "MMS",
  },
  account: { id: "act_1", name: "Conta" },
  period: { since: "2026-10-19", until: "2026-11-01", timezone: "America/Sao_Paulo" },
  attribution: { setting: "unified", note: "ok" },
  campaigns: [
    {
      id: "c1",
      name: "Campanha",
      objective: "OUTCOME_LEADS",
      status: "PAUSED",
      effective_status: "PAUSED",
      buying_type: "AUCTION",
      daily_budget: null,
      lifetime_budget: null,
      optimization_goal: null,
      result_metric: "lead",
      insights: {
        spend: 100,
        impressions: 1000,
        reach: 800,
        frequency: 1.2,
        clicks: 40,
        link_clicks: 30,
        ctr: 4,
        link_ctr: 3,
        cpc: 2.5,
        link_cpc: 3.3,
        cpm: 100,
        results: 8,
        cost_per_result: 12.5,
      },
      daily_insights: [],
      attribution_setting: "7d_click",
    },
  ],
  adsets: [],
  ads: [],
  business_outcomes: {
    leads_received: null,
    qualified_leads: null,
    appointments: null,
    sales: null,
    revenue: null,
  },
  warnings: ["Alcance não deve ser somado."],
};

const detail: MetaAiExecutionDetail = {
  id: "dd47e476-fad6-481e-b7d9-81b07264ff85",
  createdAt: "2026-11-02T17:00:00.000Z",
  status: "ok",
  organizationId: "org-1",
  clientName: "MMS",
  accountId: "act_1",
  accountName: "Conta",
  periodSince: "2026-10-19",
  periodUntil: "2026-11-01",
  periodTimezone: "America/Sao_Paulo",
  protocolVersion: "1.0.0",
  dataContractVersion: "1.0.0",
  model: "gpt-4o-mini",
  promptHash: "8970d6040a86e8b6",
  warningCount: 1,
  analysisMarkdown: "# Análise",
  warnings: ["Alcance não deve ser somado."],
  errorMessage: "",
  inputJson: sampleInput,
  outputJson: { analysis_markdown: "# Análise", model: "gpt-4o-mini" },
  calibrationFeedback: {},
};

const payload = buildChatgptMetaAnalysisPayload(detail);
assert.equal(payload.tool, CHATGPT_META_ANALYSIS_TOOL);
assert.equal(payload.execution_id, detail.id);
assert.equal(payload.campaigns.length, 1);
assert.equal(payload.ai_analysis.markdown, "# Análise");
assert.match(payload.analysis_prompt.system, /Meta Marketing API/i);
assert.ok(payload.analysis_prompt.user?.includes("MMS"));
assert.equal(payload.availability.input_json, true);
assert.equal(payload.availability.analysis_markdown, true);

const emptyDetail: MetaAiExecutionDetail = {
  ...detail,
  analysisMarkdown: "",
  inputJson: {},
  outputJson: {},
};
const emptyPayload = buildChatgptMetaAnalysisPayload(emptyDetail);
assert.equal(emptyPayload.availability.input_json, false);
assert.equal(emptyPayload.availability.analysis_markdown, false);
assert.equal(emptyPayload.campaigns.length, 0);
assert.equal(emptyPayload.ai_analysis.markdown, null);

const openapi = chatgptOpenApiDocument("https://nex.example");
assert.equal(openapi.paths["/api/integrations/chatgpt/analyses/{executionId}"].get.operationId, CHATGPT_META_ANALYSIS_TOOL);
assert.equal(getMetaAnalysisExecutionToolDefinition.name, CHATGPT_META_ANALYSIS_TOOL);

const first = consumeRateLimit("test-key", 2, 60_000, 1_000);
const second = consumeRateLimit("test-key", 2, 60_000, 1_001);
const third = consumeRateLimit("test-key", 2, 60_000, 1_002);
assert.equal(first.allowed, true);
assert.equal(second.allowed, true);
assert.equal(third.allowed, false);

process.env["CHATGPT_INTEGRATION_SECRET"] = "nex-chatgpt-test-secret";
const noAuth = authenticateChatgptIntegration(new Request("https://nex.test/api"));
assert.equal(noAuth?.status, 401);
const badAuth = authenticateChatgptIntegration(
  new Request("https://nex.test/api", { headers: { authorization: "Bearer wrong" } }),
);
assert.equal(badAuth?.status, 401);
const okAuth = authenticateChatgptIntegration(
  new Request("https://nex.test/api", {
    headers: { authorization: "Bearer nex-chatgpt-test-secret" },
  }),
);
assert.equal(okAuth, null);

console.log("chatgpt-integration.test.ts: ok");
