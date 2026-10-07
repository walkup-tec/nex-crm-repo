import assert from "node:assert/strict";
import { normalizeBalanceLink } from "./balance-link";

assert.equal(
  normalizeBalanceLink("https://business.facebook.com/billing_hub/payment_settings?asset_id=123"),
  "https://business.facebook.com/billing_hub/payment_settings?asset_id=123",
);
assert.equal(
  normalizeBalanceLink("https://adsmanager.facebook.com/adsmanager/billing?act=99"),
  "https://adsmanager.facebook.com/adsmanager/billing?act=99",
);
assert.equal(normalizeBalanceLink("http://business.facebook.com/billing"), null);
assert.equal(normalizeBalanceLink("https://example.com/saldo"), null);
assert.equal(normalizeBalanceLink(""), null);

console.log("balance-link tests ok");
