import assert from "node:assert/strict";
import {
  assembleTransactionDiagnosis,
  diagnoseTransactionRow,
  rejectedTransactionField,
  transactionDateClass,
} from "./meta-transactions-diagnose";

assert.equal(
  rejectedTransactionField("(#100) Tried accessing nonexistent field (billing_reason)"),
  "billing_reason",
);
assert.equal(rejectedTransactionField(null), null);

const row = diagnoseTransactionRow({
  id: "28936639426026954-2913029933327629",
  status: "completed",
  payment_option: "manual",
  time: 0,
  is_funding_event: true,
  app_amount: { amount: "200.00", currency: "BRL", secret: "EAASECRETVALUE" },
  card_number: "4111111111111111",
});
assert.equal(row.time, 0);
assert.equal(row.card_number, undefined);
assert.deepEqual(row.other_keys, ["card_number"]);
const amount = row.app_amount as { amount: string; keys: string[]; secret?: string };
assert.equal(amount.amount, "200.00");
assert.equal(amount.secret, undefined);
assert.equal(amount.keys.includes("secret"), true);

const absent = diagnoseTransactionRow({ status: "Pago" });
assert.equal(absent.time, null);

const now = Date.parse("2026-10-28T23:00:00.000Z");
assert.equal(transactionDateClass(0, now), "unknown");
assert.equal(transactionDateClass(undefined, now), "unknown");
assert.equal(transactionDateClass(Date.parse("2026-10-07T15:00:00.000Z") / 1000, now), "inside");
assert.equal(transactionDateClass(Date.parse("2026-08-01T00:00:00.000Z") / 1000, now), "outside");

const report = assembleTransactionDiagnosis({
  attempts: [],
  fields: ["id", "status"],
  pages: 1,
  hasMore: false,
  now,
  rows: [
    { id: "28936639426026954-2913029933327629", time: 0, status: "completed" },
    { id: "28936639426026954-2913029933327629", time: 0, status: "completed" },
  ],
});
assert.equal(report.unknown_date, 2);
assert.deepEqual(report.duplicate_ids, ["28936639426026954-2913029933327629"]);
assert.equal(report.known.find((item) => item.id.startsWith("28936639426026954"))?.found, true);
assert.equal(report.known.filter((item) => !item.found).length, 4);

console.log("meta-transactions-diagnose tests ok");
