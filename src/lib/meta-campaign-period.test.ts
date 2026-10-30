import assert from "node:assert/strict";
import { campaignCreatedDay, campaignCreatedInPeriod } from "./meta-access";

assert.equal(campaignCreatedDay("2026-10-16T15:30:00-0300"), "2026-10-16");
assert.equal(campaignCreatedDay("2026-10-16T02:00:00+0000"), "2026-10-15");
assert.equal(campaignCreatedDay("2026-10-16"), "2026-10-16");
assert.equal(campaignCreatedDay(""), null);
assert.equal(campaignCreatedDay(null), null);

assert.equal(campaignCreatedInPeriod("2026-10-20", { mode: "total" }), true);
assert.equal(campaignCreatedInPeriod(null, { mode: "total" }), true);
assert.equal(
  campaignCreatedInPeriod("2026-10-20", { mode: "custom", since: "2026-10-16", until: "2026-10-29" }),
  true,
);
assert.equal(
  campaignCreatedInPeriod("2026-10-16", { mode: "custom", since: "2026-10-16", until: "2026-10-29" }),
  true,
);
assert.equal(
  campaignCreatedInPeriod("2026-10-29", { mode: "custom", since: "2026-10-16", until: "2026-10-29" }),
  true,
);
assert.equal(
  campaignCreatedInPeriod("2026-10-15", { mode: "custom", since: "2026-10-16", until: "2026-10-29" }),
  false,
);
assert.equal(
  campaignCreatedInPeriod(null, { mode: "custom", since: "2026-10-16", until: "2026-10-29" }),
  false,
);
