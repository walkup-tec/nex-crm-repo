import assert from "node:assert/strict";
import { chargeMatchesClient, unpaidChargeBlocksClient } from "./finance-access";

const walkup = {
  clientName: "WALKUP TECNOLOGIA E SISTEMAS LTDA",
  clientDocument: "69.511.558/0001-38",
};

assert.equal(chargeMatchesClient(walkup, ""), true);
assert.equal(chargeMatchesClient(walkup, "walkup"), true);
assert.equal(chargeMatchesClient(walkup, "69.511.558/0001-38"), true);
assert.equal(chargeMatchesClient(walkup, "69511558"), true);
assert.equal(chargeMatchesClient(walkup, "MMS"), false);

assert.equal(unpaidChargeBlocksClient("pending", "2026-10-17", "2026-10-18"), true);
assert.equal(unpaidChargeBlocksClient("pending", "2026-10-18", "2026-10-18"), false);
assert.equal(unpaidChargeBlocksClient("pending", "2026-11-17", "2026-10-18"), false);
assert.equal(unpaidChargeBlocksClient("paid", "2026-10-17", "2026-10-18"), false);
assert.equal(unpaidChargeBlocksClient("overdue", "2026-11-17", "2026-10-18"), true);
