import assert from "node:assert/strict";
import {
  isLowMetaBalance,
  lowBalanceSignal,
  lowBalanceWhatsappText,
  shouldSendLowBalanceWhatsapp,
  whatsappNumber,
} from "./low-balance";

assert.equal(isLowMetaBalance(2000), true);
assert.equal(isLowMetaBalance(5000), true);
assert.equal(isLowMetaBalance(5001), false);
assert.equal(isLowMetaBalance(null), false);
assert.equal(lowBalanceSignal(2000), "low");
assert.equal(lowBalanceSignal(5000), "low");
assert.equal(lowBalanceSignal(20000), "clear");
assert.equal(lowBalanceSignal(null), "unknown");
assert.equal(shouldSendLowBalanceWhatsapp(true, false), true);
assert.equal(shouldSendLowBalanceWhatsapp(true, true), false);
assert.equal(shouldSendLowBalanceWhatsapp(false, false), false);
assert.equal(whatsappNumber("(51) 99999-9999"), "5551999999999");
assert.equal(whatsappNumber("5551999999999"), "5551999999999");
assert.equal(whatsappNumber("123"), null);
assert.match(lowBalanceWhatsappText("Walkup"), /^Olá Walkup /);
assert.match(lowBalanceWhatsappText("  "), /^Olá cliente /);

console.log("low-balance tests ok");
