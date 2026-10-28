import assert from "node:assert/strict";
import { sanitizeAccountProbe, sanitizeFundingNode, sanitizeProbeMessage } from "./meta-balance-probe";

const raw = {
  id: "act_886574174420761",
  name: "CP Walkup",
  account_id: "886574174420761",
  currency: "BRL",
  balance: "75",
  is_prepay_account: true,
  funding_source_details: {
    id: "pay_9988",
    type: 20,
    amount: "14227",
    currency: "BRL",
    display_amount: "R$ 142,27",
    display_string: "Visa •••• 4242",
    coupons: [{ id: "cupom", amount: "500", display_string: "não registrar" }],
  },
};

const clean = sanitizeAccountProbe(raw);
assert.equal(clean.balance, "75");
assert.equal(clean.currency, "BRL");
assert.equal("id" in clean, false);
assert.equal("name" in clean, false);
assert.deepEqual((clean.funding_source_details as { keys: string[] }).keys, [
  "amount",
  "coupons",
  "currency",
  "display_amount",
  "display_string",
  "id",
  "type",
]);
const funding = clean.funding_source_details as { amount: string; display_string?: string; id?: string; coupons: Array<Record<string, unknown>> };
assert.equal(funding.amount, "14227");
assert.equal(funding.display_string, undefined);
assert.equal(funding.id, undefined);
assert.equal(funding.coupons[0]?.amount, "500");
assert.equal(funding.coupons[0]?.id, undefined);
assert.equal(funding.coupons[0]?.display_string, undefined);
assert.equal(JSON.stringify(clean).includes("4242"), false);
assert.equal(JSON.stringify(clean).includes("pay_9988"), false);

const absent = sanitizeAccountProbe({ currency: "BRL" });
assert.equal("balance" in absent, false);
assert.equal(sanitizeFundingNode(null), null);

const leaked = sanitizeAccountProbe({
  balance: "75",
  error: { message: "segredo", fbtrace_id: "abc", access_token: "EAA123" },
  funding_source_details: { id: "pay_1", display_string: "Visa •••• 4242", amount: "14227" },
});
assert.equal(JSON.stringify(leaked).includes("segredo"), false);
assert.equal(JSON.stringify(leaked).includes("EAA123"), false);
assert.equal(JSON.stringify(leaked).includes("fbtrace"), false);
assert.equal(JSON.stringify(leaked).includes("4242"), false);
assert.equal(sanitizeProbeMessage('(#100) {"error":{"access_token":"EAA999"}}'), null);
assert.equal(sanitizeProbeMessage("(#100) funding_source_details requires MANAGE"), "(#100) funding_source_details requires MANAGE");
assert.equal(sanitizeProbeMessage("token EAAABCDEF email a@b.com cartao 4242424242424242"), "token token email email cartao numero");

console.log("meta-balance-probe tests ok");
