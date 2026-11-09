import assert from "node:assert/strict";
import {
  adsPlatformLabel,
  adsServiceDescription,
  hasClientProduct,
  overdueAccessCopy,
  overduePixCopy,
} from "./client-access";
import { adsFromProductNames } from "./chatbot-client";
import { chargeActionFlags } from "./finance-access";

assert.equal(hasClientProduct({ adsMeta: false, adsGoogle: false, productHosting: true }), true);
assert.equal(hasClientProduct({ adsMeta: false, adsGoogle: false, productHosting: false }), false);
assert.equal(hasClientProduct({ adsMeta: true, adsGoogle: false, productHosting: false }), true);

assert.equal(adsPlatformLabel({ adsMeta: false, adsGoogle: false, productHosting: true }), "Hospedagem");
assert.equal(
  adsPlatformLabel({ adsMeta: true, adsGoogle: false, productHosting: true }),
  "Meta Ads · Hospedagem",
);

assert.equal(
  adsServiceDescription({ adsMeta: false, adsGoogle: false, productHosting: true }),
  "Mensalidade referente ao serviço de hospedagem.",
);
assert.equal(
  overdueAccessCopy({ adsMeta: false, adsGoogle: false, productHosting: true }),
  "Continue com nossos serviços de hospedagem. Regularize sua pendência para restabelecer o acesso.",
);
assert.equal(
  overduePixCopy({ provider: "manual", nominal: null }),
  "Esta parcela é de cobrança manual. O Master confirma o pagamento no financeiro.",
);

assert.deepEqual(adsFromProductNames(["Hospedagem"]), {
  adsMeta: false,
  adsGoogle: false,
  productHosting: true,
});
assert.deepEqual(adsFromProductNames(["Meta Ads", "Hospedagem"]), {
  adsMeta: true,
  adsGoogle: false,
  productHosting: true,
});

const manualOpen = chargeActionFlags({
  status: "pending",
  dueDate: "2026-12-01",
  today: "2026-11-09",
  billingProvider: "manual",
  externalChargeId: "manual:org:2026-12-01",
});
assert.equal(manualOpen.canMarkPaid, true);
assert.equal(manualOpen.canCancel, true);
assert.equal(manualOpen.canChangeDue, true);
assert.equal(manualOpen.canNegotiate, false);

const coraOpen = chargeActionFlags({
  status: "pending",
  dueDate: "2026-12-01",
  today: "2026-11-09",
  billingProvider: "cora",
  externalChargeId: "inv_123",
});
assert.equal(coraOpen.canMarkPaid, false);
assert.equal(coraOpen.canCancel, true);
assert.equal(coraOpen.canNegotiate, false);

const manualPaid = chargeActionFlags({
  status: "paid",
  dueDate: "2026-12-01",
  today: "2026-11-09",
  billingProvider: "manual",
  externalChargeId: "manual:org:2026-12-01",
});
assert.equal(manualPaid.canMarkPaid, false);
assert.equal(manualPaid.canCancel, false);

console.log("client hosting manual tests ok");
