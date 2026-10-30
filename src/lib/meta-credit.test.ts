import assert from "node:assert/strict";
import {
  accountFigures,
  availableBalanceCents,
  balanceFromAccount,
  remainingSpendCents,
  spendCapBalance,
  balanceGrew,
  centsFromMoneyInput,
  metaBillingUrl,
  pixFromMeta,
} from "./meta-credit";

assert.equal(availableBalanceCents({ type: 20, amount: "18250" }), 18250);
assert.equal(availableBalanceCents({ type: 20, amount: "14227" }), 14227);
assert.equal(availableBalanceCents({ type: 20, display_amount: "R$ 142,27" }), 14227);
assert.equal(availableBalanceCents({ type: 20, amount: "0", display_amount: "R$ 142,27" }), 14227);
assert.equal(availableBalanceCents({ type: 20, amount: "0" }), null);

const walkup = accountFigures({
  totalPrepay: "14227",
  unbilled: "3741",
  balance: "3402",
  threshold: "4900",
});
assert.equal(walkup.availableCents, 14227);
assert.equal(walkup.chargeCents, 3741);
assert.equal(walkup.thresholdCents, 4900);
assert.equal(accountFigures({ prepayAccount: { amount: "142,27", currency: "BRL" } }).availableCents, 14227);
assert.equal(accountFigures({ balance: "3402" }).chargeCents, 3402);
assert.equal(accountFigures({ balance: "3402" }).availableCents, null);
assert.equal(
  availableBalanceCents({ type: 20, amount: "10000", coupons: [{ amount: "500" }] }),
  10500,
);
assert.equal(availableBalanceCents({ type: 1, amount: "999" }), null);
assert.equal(availableBalanceCents(null), null);

const due = balanceFromAccount({ balance: "3500" });
assert.equal(due.kind, "due");
assert.equal(due.cents, 3500);

const available = balanceFromAccount({ balance: "3500", funding: { type: "20", amount: "900" } });
assert.equal(available.kind, "available");
assert.equal(available.cents, 900);
assert.equal(remainingSpendCents("20000", "5773"), 14227);
assert.equal(remainingSpendCents("14227", "0"), 14227);
assert.equal(remainingSpendCents("1000", "1000"), 0);
assert.equal(remainingSpendCents("0", "5773"), null);
assert.equal(remainingSpendCents(null, "0"), null);

assert.equal(centsFromMoneyInput("R$ 2.007,13"), 200713);
assert.equal(centsFromMoneyInput(""), null);
assert.equal(centsFromMoneyInput("0,00"), null);

assert.equal(balanceGrew(1000, 2500, 1500), true);
// spend_cap - amount_spent is the available balance whenever there is a limit,
// without requiring is_prepay_account. This is the fix for CP Walkup showing
// 200 instead of 142,27.
assert.deepEqual(spendCapBalance({ spendCap: "20000", amountSpent: "5773" }), {
  cents: 14227,
  kind: "available",
});
assert.equal(spendCapBalance({ spendCap: "0", amountSpent: "5773" }), null);
// An open balance of 0 with a positive cap uses the remaining limit (CP Walkup).
assert.deepEqual(spendCapBalance({ balance: "0", spendCap: "20000", amountSpent: "5773" }), {
  cents: 14227,
  kind: "available",
});
// A real outstanding (due) balance on a postpaid account is NOT replaced by the limit.
assert.equal(spendCapBalance({ balance: "3500", spendCap: "20000", amountSpent: "5773" }), null);
// ...unless it is a prepaid account, where the remaining limit still wins.
assert.deepEqual(
  spendCapBalance({ balance: "3500", spendCap: "20000", amountSpent: "5773", isPrepay: true }),
  { cents: 14227, kind: "available" },
);

assert.equal(balanceGrew(1000, 2499, 1500), false);
assert.equal(balanceGrew(null, 2500, 1500), false);

const payload =
  "00020126580014BR.GOV.BCB.PIX0136nex-meta-credit-test5204000053039865802BR5913META6304ABCD";
const pix = pixFromMeta({
  funding_source_details: { type: 19, display_string: "Pix", pix_code: payload },
  qr_image:
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
});
assert.equal(pix?.payload, payload);
assert.ok(pix?.image.startsWith("iVBORw0KGgo"));
assert.equal(pixFromMeta({ display_string: "Pix", balance: "1000" }), null);
assert.equal(pixFromMeta({ note: "000201 curto" }), null);

assert.equal(
  metaBillingUrl("act_123", "99"),
  "https://business.facebook.com/billing_hub/payment_settings?asset_id=123&placement=ads_manager&business_id=99",
);
assert.equal(metaBillingUrl("conta", null), null);

console.log("meta-credit tests ok");
