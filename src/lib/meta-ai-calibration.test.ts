import assert from "node:assert/strict";
import {
  findRecentMetaAiDuplicate,
  isMetaAiExecutionTerminal,
  metaAiDetailToAnalysisResult,
  META_AI_RECENT_DUPLICATE_MS,
  type MetaAiExecutionDetail,
  type MetaAiExecutionSummary,
} from "./meta-ai-calibration";

function row(
  partial: Partial<MetaAiExecutionSummary> & Pick<MetaAiExecutionSummary, "id" | "organizationId" | "createdAt">,
): MetaAiExecutionSummary {
  return {
    status: "ok",
    clientName: "Cliente",
    accountId: "act_1",
    accountName: "Conta",
    periodSince: "2026-10-19",
    periodUntil: "2026-11-01",
    protocolVersion: "1.0.0",
    dataContractVersion: "1.0.0",
    model: "gpt-4o-mini",
    promptHash: "abc",
    warningCount: 0,
    ...partial,
  };
}

const now = Date.parse("2026-11-02T14:40:00.000Z");

{
  const duplicate = findRecentMetaAiDuplicate(
    [
      row({
        id: "a",
        organizationId: "org-1",
        createdAt: new Date(now - 29_000).toISOString(),
        periodSince: "2026-10-19",
        periodUntil: "2026-11-01",
      }),
    ],
    {
      organizationId: "org-1",
      period: { mode: "custom", since: "2026-10-19", until: "2026-11-01" },
      now,
    },
  );
  assert.equal(duplicate?.id, "a");
}

{
  const duplicate = findRecentMetaAiDuplicate(
    [
      row({
        id: "a",
        organizationId: "org-1",
        createdAt: new Date(now - META_AI_RECENT_DUPLICATE_MS - 1).toISOString(),
      }),
    ],
    {
      organizationId: "org-1",
      period: { mode: "custom", since: "2026-10-19", until: "2026-11-01" },
      now,
    },
  );
  assert.equal(duplicate, null);
}

{
  const duplicate = findRecentMetaAiDuplicate(
    [
      row({
        id: "a",
        organizationId: "org-1",
        createdAt: new Date(now - 1_000).toISOString(),
        periodSince: "2026-09-01",
        periodUntil: "2026-09-30",
      }),
    ],
    {
      organizationId: "org-1",
      period: { mode: "custom", since: "2026-10-19", until: "2026-11-01" },
      now,
    },
  );
  assert.equal(duplicate, null);
}

{
  const duplicate = findRecentMetaAiDuplicate(
    [
      row({
        id: "err",
        organizationId: "org-1",
        createdAt: new Date(now - 1_000).toISOString(),
        status: "error",
        periodSince: null,
        periodUntil: null,
      }),
      row({
        id: "custom-recent",
        organizationId: "org-1",
        createdAt: new Date(now - 2_000).toISOString(),
        periodSince: "2026-10-19",
        periodUntil: "2026-11-01",
      }),
      row({
        id: "ok",
        organizationId: "org-1",
        createdAt: new Date(now - 5_000).toISOString(),
        periodSince: null,
        periodUntil: null,
      }),
    ],
    { organizationId: "org-1", period: { mode: "total" }, now },
  );
  assert.equal(duplicate?.id, "ok");
}

assert.equal(isMetaAiExecutionTerminal("running"), false);
assert.equal(isMetaAiExecutionTerminal("ok"), true);
assert.equal(isMetaAiExecutionTerminal("partial"), true);
assert.equal(isMetaAiExecutionTerminal("error"), true);

{
  const detail: MetaAiExecutionDetail = {
    id: "exec-1",
    createdAt: "2026-11-03T12:00:00.000Z",
    status: "ok",
    organizationId: "org-1",
    clientName: "Cliente",
    accountId: "act_1",
    accountName: "Conta",
    periodSince: "2026-10-21",
    periodUntil: "2026-11-03",
    periodTimezone: "America/Sao_Paulo",
    protocolVersion: "1.2.0",
    dataContractVersion: "1.0.0",
    model: "gpt-4o-mini",
    promptHash: "hash",
    warningCount: 0,
    analysisMarkdown: "# ok",
    warnings: [],
    errorMessage: "",
    inputJson: {
      metadata: { data_status: "live" },
      campaigns: [{ id: "c1" }],
      adsets: [],
      ads: [{ id: "a1" }, { id: "a2" }],
    },
    outputJson: {},
    calibrationFeedback: {},
  };
  const mapped = metaAiDetailToAnalysisResult(detail);
  assert.equal(mapped.executionId, "exec-1");
  assert.equal(mapped.campaignCount, 1);
  assert.equal(mapped.adCount, 2);
  assert.equal(mapped.dataStatus, "live");
  assert.equal(mapped.analysis, "# ok");
}

{
  const duplicate = findRecentMetaAiDuplicate(
    [
      row({
        id: "running",
        organizationId: "org-1",
        createdAt: new Date(now - 1_000).toISOString(),
        status: "running",
        periodSince: "2026-10-19",
        periodUntil: "2026-11-01",
      }),
    ],
    {
      organizationId: "org-1",
      period: { mode: "custom", since: "2026-10-19", until: "2026-11-01" },
      now,
    },
  );
  assert.equal(duplicate?.id, "running", "running conta como duplicata recente");
}

console.log("meta-ai-calibration.test.ts: ok");
