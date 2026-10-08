import assert from "node:assert/strict";
import {
  evolutionInstanceName,
  isLowMetaBalance,
  lowBalanceAlertStamp,
  lowBalanceAlreadyDelivered,
  lowBalanceSignal,
  isGhostButtonResponse,
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
assert.equal(whatsappNumber("5197979224"), "5551997979224");
assert.equal(whatsappNumber("555197979224"), "5551997979224");
assert.equal(whatsappNumber("(51) 3333-4444"), "555133334444");
assert.equal(whatsappNumber("123"), null);
assert.equal(lowBalanceAlreadyDelivered(null), false);
assert.equal(lowBalanceAlreadyDelivered("2026-10-08T09:20:00.000Z"), false);
assert.equal(
  lowBalanceAlreadyDelivered(lowBalanceAlertStamp(Date.parse("2026-10-08T15:00:00.000Z"))),
  true,
);
assert.equal(
  evolutionInstanceName(
    [
      { name: "outra", connectionStatus: "open", number: "5511999999999" },
      { instanceName: "nex", status: "open", ownerJid: "555197979224@s.whatsapp.net" },
    ],
    "",
  ),
  "nex",
);
assert.equal(evolutionInstanceName([], "5197979224"), "5197979224");
assert.equal(
  evolutionInstanceName([{ name: "outra", connectionStatus: "open", number: "5511999999999" }], ""),
  null,
);
assert.equal(isGhostButtonResponse({ message: { viewOnceMessage: { message: {} } } }), true);
assert.equal(
  isGhostButtonResponse({
    messageType: "interactiveMessage",
    message: { nativeFlowMessage: { buttons: [{ name: "cta_url" }] } },
  }),
  false,
);
assert.match(lowBalanceWhatsappText("Walkup"), /^Olá Walkup /);
assert.match(lowBalanceWhatsappText("  "), /^Olá cliente /);

console.log("low-balance tests ok");
