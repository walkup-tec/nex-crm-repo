import assert from "node:assert/strict";
import { chargeCents, contractDueDates, coraDelinquencyFine, coraPaymentTerms, noticeSchedule, promotionAmount, promotionsOverlap } from "./billing-plan";

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

const windows = [
  { startsOn: "2026-10-17", endsOn: "2026-12-17", amountCents: 49900 },
  { startsOn: "2026-12-18", endsOn: "2027-06-17", amountCents: 60000 },
];
assert.equal(promotionAmount("2026-11-17", 180000, windows), 49900);
assert.equal(promotionAmount("2027-01-17", 180000, windows), 60000);
assert.equal(promotionAmount("2027-07-17", 180000, windows), 180000);
assert.equal(promotionsOverlap(windows), false);
assert.equal(
  promotionsOverlap([
    { startsOn: "2026-10-17", endsOn: "2026-12-17" },
    { startsOn: "2026-12-17", endsOn: "2027-06-17" },
  ]),
  true,
);

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
