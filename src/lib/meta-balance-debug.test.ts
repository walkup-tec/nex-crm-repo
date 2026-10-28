import assert from "node:assert/strict";
import { formatMetaFieldRead, sanitizeMetaDebug } from "./meta-balance-debug";

const body = sanitizeMetaDebug({
  total_prepay_balance: "14227",
  access_token: "EAASecret",
  funding_source_details: {
    type: 20,
    amount: "14227",
    display_string: "Cartão 4242424242424242",
    note: "token EAA1234567890",
  },
}) as {
  total_prepay_balance: string;
  access_token?: string;
  funding_source_details: { type: number; amount: string; display_string: string; note: string };
};

assert.equal(body.total_prepay_balance, "14227");
assert.equal(body.access_token, undefined);
assert.equal(body.funding_source_details.amount, "14227");
assert.equal(body.funding_source_details.display_string.includes("4242"), false);
assert.equal(body.funding_source_details.note.includes("EAA"), false);

const report = formatMetaFieldRead({
  name: "Saldo disponível · total_prepay_balance",
  field: "total_prepay_balance",
  ok: true,
  status: 200,
  code: null,
  body: { total_prepay_balance: "14227" },
});
assert.equal(report.text.includes("HTTP 200"), true);
assert.equal(report.text.includes("14227"), true);
assert.equal(report.text.includes("access_token"), false);

console.log("meta-balance-debug tests ok");
