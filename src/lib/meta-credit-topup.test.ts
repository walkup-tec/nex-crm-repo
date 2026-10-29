import assert from "node:assert/strict";
import {
  availableFromRegisteredCredit,
  creditTopupLedger,
  hasRegisteredCreditTopup,
  insightSpendToCents,
  metaCreditAlertState,
  readCreditTopup,
  todayDate,
  topupSinceDate,
} from "./meta-credit-topup";

assert.equal(availableFromRegisteredCredit(10000, 1000), 9000);
assert.equal(availableFromRegisteredCredit(10000, 15000), 0);
assert.equal(availableFromRegisteredCredit(0, 1000), null);
assert.equal(availableFromRegisteredCredit(10000, 0), 10000);

const ledger = creditTopupLedger(20000, "2026-10-07T15:00:00.000Z");
assert.equal(ledger.creditedCents, 20000);
assert.equal(ledger.manualCredit, true);
assert.deepEqual(readCreditTopup(ledger), { cents: 20000, at: "2026-10-07T15:00:00.000Z" });
assert.equal(hasRegisteredCreditTopup(ledger), true);
assert.equal(hasRegisteredCreditTopup({ manualCredit: true, entries: [] }), false);
assert.equal(readCreditTopup(null), null);

assert.equal(insightSpendToCents("10.50"), 1050);
assert.equal(insightSpendToCents("10,50"), 1050);
assert.equal(insightSpendToCents(10.5), 1050);
assert.equal(insightSpendToCents("10"), 1000);
assert.equal(insightSpendToCents(""), 0);

assert.equal(topupSinceDate("2026-10-07T15:00:00.000Z", "UTC"), "2026-10-07");
assert.equal(todayDate("UTC", Date.parse("2026-10-29T12:00:00.000Z")), "2026-10-29");

assert.deepEqual(
  metaCreditAlertState({ topup: null, availableCents: null, paymentError: false }),
  { missingTopup: true, balanceLow: false, paymentError: false, low: true },
);
assert.deepEqual(
  metaCreditAlertState({
    topup: { cents: 20000, at: "2026-10-07T15:00:00.000Z" },
    availableCents: 8551,
    paymentError: false,
  }),
  { missingTopup: false, balanceLow: false, paymentError: false, low: false },
);
assert.deepEqual(
  metaCreditAlertState({
    topup: { cents: 20000, at: "2026-10-07T15:00:00.000Z" },
    availableCents: 4000,
    paymentError: false,
  }),
  { missingTopup: false, balanceLow: true, paymentError: false, low: true },
);
assert.deepEqual(
  metaCreditAlertState({
    topup: { cents: 20000, at: "2026-10-07T15:00:00.000Z" },
    availableCents: 20000,
    paymentError: true,
  }),
  { missingTopup: false, balanceLow: false, paymentError: true, low: true },
);

console.log("meta-credit-topup tests ok");
