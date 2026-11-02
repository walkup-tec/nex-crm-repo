import assert from "node:assert/strict";
import {
  findRecentMetaAiDuplicate,
  META_AI_RECENT_DUPLICATE_MS,
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

console.log("meta-ai-calibration.test.ts: ok");
