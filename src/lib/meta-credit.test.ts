import assert from "node:assert/strict";
import {
  availableBalanceCents,
  balanceFromAccount,
  balanceGrew,
  centsFromMoneyInput,
  metaBillingUrl,
  pixFromMeta,
} from "./meta-credit";

assert.equal(availableBalanceCents({ type: 20, amount: "18250" }), 18250);
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

assert.equal(centsFromMoneyInput("R$ 2.007,13"), 200713);
assert.equal(centsFromMoneyInput(""), null);
assert.equal(centsFromMoneyInput("0,00"), null);

assert.equal(balanceGrew(1000, 2500, 1500), true);
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
