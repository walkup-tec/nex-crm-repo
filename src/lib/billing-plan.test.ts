import assert from "node:assert/strict";
import { chargeCents, contractDueDates, coraDelinquencyFine, coraPaymentTerms, noticeSchedule } from "./billing-plan";

assert.deepEqual(contractDueDates("2026-10-17", "2027-01-31", 10, "2026-10-17"), [
  "2026-11-10",
  "2026-12-10",
  "2027-01-10",
]);
assert.deepEqual(contractDueDates("2026-10-01", "2026-12-31", 10, "2026-10-17"), ["2026-11-10", "2026-12-10"]);

const promo = { startsOn: "2026-11-01", endsOn: "2027-01-31", afterCents: 20000 };
assert.equal(chargeCents("2026-10-10", 10000, promo), 20000);
assert.equal(chargeCents("2026-11-10", 10000, promo), 10000);
assert.equal(chargeCents("2027-02-10", 10000, promo), 20000);
assert.equal(chargeCents("2026-11-10", 10000, null), 10000);

assert.deepEqual(
  noticeSchedule("2026-11-10").map((item) => item.sendOn),
  ["2026-11-03", "2026-11-07", "2026-11-10", "2026-11-11", "2026-11-13", "2026-11-15"],
);

const rate = coraPaymentTerms("2026-11-10", "rate", 2, 1, 1500);
assert.deepEqual(rate.fine, { rate: 2 });
assert.deepEqual(rate.interest, { rate: 1 });
assert.equal("amount" in (rate.fine ?? {}), false);

assert.equal(coraDelinquencyFine(49900, 180000), 130100);
assert.equal(coraDelinquencyFine(180000, 180000), 0);
assert.equal(coraDelinquencyFine(180000, 49900), -130100);

const fixed = coraPaymentTerms("2026-11-10", "amount", 2, 1, coraDelinquencyFine(49900, 180000));
assert.deepEqual(fixed.fine, { amount: 130100 });
assert.equal(fixed.interest, undefined);
const sameAmount = coraPaymentTerms("2026-11-10", "amount", 2, 1, coraDelinquencyFine(180000, 180000));
assert.equal(sameAmount.fine, undefined);
