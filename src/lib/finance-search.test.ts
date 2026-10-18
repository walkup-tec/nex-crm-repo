import assert from "node:assert/strict";
import { chargeMatchesClient } from "./finance-access";

const walkup = {
  clientName: "WALKUP TECNOLOGIA E SISTEMAS LTDA",
  clientDocument: "69.511.558/0001-38",
};

assert.equal(chargeMatchesClient(walkup, ""), true);
assert.equal(chargeMatchesClient(walkup, "walkup"), true);
assert.equal(chargeMatchesClient(walkup, "69.511.558/0001-38"), true);
assert.equal(chargeMatchesClient(walkup, "69511558"), true);
assert.equal(chargeMatchesClient(walkup, "MMS"), false);
