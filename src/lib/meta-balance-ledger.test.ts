import assert from "node:assert/strict";
import {
  centsFromMetaAmount,
  classifyGraphPayment,
  hasCreditCard,
  mergeLedger,
  prepaidBalanceCents,
  readLedger,
  shouldUsePrepaidLedger,
} from "./meta-balance-ledger";

assert.equal(centsFromMetaAmount("200,00"), 20000);
assert.equal(centsFromMetaAmount("28,08"), 2808);
assert.equal(centsFromMetaAmount("200.00"), 20000);
assert.equal(centsFromMetaAmount("2.007,13"), 200713);
assert.equal(centsFromMetaAmount({ amount: "200.00", currency: "BRL" }), 20000);
assert.equal(centsFromMetaAmount(20000), 20000);
assert.equal(centsFromMetaAmount("0,00"), null);

const received = classifyGraphPayment({
  id: "28936639426026954-29130299313327629",
  status: "Com saldo",
  payment_option: "Pagamento manual",
  app_amount: { amount: "200,00", currency: "BRL" },
  time: 1759795200,
});
assert.equal(received?.direction, "credit");
assert.equal(received?.cents, 20000);

assert.equal(
  classifyGraphPayment({
    id: "29002720588963538-2891637076318758",
    status: "Pendente",
    payment_option: "Pagamento manual",
    app_amount: { amount: "500,00" },
  }),
  null,
);

const charge = classifyGraphPayment({
  id: "28270182876005950-28347147708309468",
  status: "Pago",
  payment_option: "Saldo pré-pago",
  app_amount: { amount: "28,08" },
  time: 1759881600,
});
assert.equal(charge?.direction, "debit");
assert.equal(charge?.cents, 2808);

const cardPaid = classifyGraphPayment({
  id: "card-paid",
  status: "Pago",
  payment_option: "Cartão de crédito",
  app_amount: { amount: "40,59" },
});
assert.equal(cardPaid?.direction, "debit");
assert.equal(cardPaid?.cents, 4059);

const anyCredit = classifyGraphPayment({
  id: "pix-1",
  status: "Com saldo",
  payment_option: "Pix",
  app_amount: { amount: "150,00" },
});
assert.equal(anyCredit?.direction, "credit");
assert.equal(anyCredit?.cents, 15000);

assert.equal(
  classifyGraphPayment({
    id: "fail-1",
    status: "Falha",
    payment_option: "Pagamento manual",
    app_amount: { amount: "80,00" },
  }),
  null,
);

assert.equal(
  classifyGraphPayment({
    id: "method-only",
    payment_option: "Saldo pré-pago",
    app_amount: { amount: "10,00" },
  }),
  null,
);

const cardCharge = classifyGraphPayment({
  id: "card-1",
  status: "completed",
  charge_type: "payment",
  payment_option: "credit_card",
  app_amount: { amount: "2100.40" },
});
assert.equal(cardCharge?.direction, "debit");
assert.equal(cardCharge?.cents, 210040);

const funding = classifyGraphPayment({
  id: "fund-1",
  is_funding_event: true,
  status: "completed",
  payment_option: "altpay",
  billing_reason: "add_funds",
  app_amount: { amount: "150.00" },
});
assert.equal(funding?.direction, "credit");
assert.equal(funding?.cents, 15000);

const added = classifyGraphPayment({
  event_type: "funding_event_successful",
  event_time: 1759795200,
  object_id: "886574174420761",
  extra_data: JSON.stringify({ new_value: "20000", currency: "BRL" }),
});
assert.equal(added?.direction, "credit");
assert.equal(added?.cents, 20000);

assert.equal(
  classifyGraphPayment({
    event_type: "funding_event_initiated",
    event_time: 1759795200,
    object_id: "886574174420761",
    extra_data: JSON.stringify({ new_value: "50000" }),
  }),
  null,
);

assert.equal(
  classifyGraphPayment({
    event_type: "ad_account_billing_decline",
    event_time: 1759795300,
    object_id: "886574174420761",
    extra_data: JSON.stringify({ new_value: "2808" }),
  }),
  null,
);

const activity = classifyGraphPayment({
  event_type: "ad_account_billing_charge",
  event_time: 1754600000,
  object_id: "act_1",
  translated_event_type: "Cobrança",
  extra_data: JSON.stringify({
    payment_option: "stored_balance",
    status: "paid",
    new_value: 3605,
  }),
});
assert.equal(activity?.direction, "debit");
assert.equal(activity?.cents, 3605);
assert.equal(activity?.id, "ad_account_billing_charge:act_1:1754600000");

assert.equal(prepaidBalanceCents([received!, charge!]), 17192);
assert.equal(
  prepaidBalanceCents([
    { direction: "credit", cents: 15000, at: "2026-08-11T15:00:00.000Z" },
    { direction: "debit", cents: 1054, at: "2026-08-12T15:00:00.000Z" },
    { direction: "debit", cents: 4059, at: "2026-08-13T15:00:00.000Z" },
    { direction: "debit", cents: 3643, at: "2026-08-14T15:00:00.000Z" },
    { direction: "debit", cents: 5305, at: "2026-08-15T15:00:00.000Z" },
    { direction: "debit", cents: 2808, at: "2026-08-18T12:00:00.000Z" },
    { direction: "debit", cents: 3347, at: "2026-08-18T18:00:00.000Z" },
    { direction: "debit", cents: 10327, at: "2026-09-04T15:00:00.000Z" },
    { direction: "credit", cents: 20000, at: "2026-10-07T15:00:00.000Z" },
  ]),
  20000,
);
assert.equal(
  prepaidBalanceCents([
    { direction: "credit", cents: 20000, at: "2026-10-07T15:00:00.000Z" },
    { direction: "debit", cents: 3000, at: "2026-10-08T15:00:00.000Z" },
  ]),
  17000,
);
assert.equal(mergeLedger([received!], [received!, charge!]).length, 2);

assert.equal(hasCreditCard({ type: 1, display_string: "Cartão" }), true);
assert.equal(hasCreditCard({ type: 20, amount: "0" }), false);
assert.equal(
  shouldUsePrepaidLedger({
    hasCard: true,
    displayedCents: 0,
    storedCents: 0,
    creditCount: 1,
  }),
  true,
);
assert.equal(
  shouldUsePrepaidLedger({
    hasCard: true,
    displayedCents: 900,
    storedCents: 900,
    creditCount: 1,
  }),
  false,
);
assert.equal(
  shouldUsePrepaidLedger({
    hasCard: false,
    displayedCents: 500,
    storedCents: null,
    creditCount: 1,
  }),
  false,
);
assert.equal(
  shouldUsePrepaidLedger({
    hasCard: false,
    displayedCents: 0,
    storedCents: null,
    creditCount: 1,
  }),
  true,
);

const stored = readLedger({
  entries: [
    { id: "a", direction: "credit", cents: 20000, at: null },
    { id: "", direction: "credit", cents: 1, at: null },
  ],
});
assert.equal(stored.length, 1);
assert.equal(stored[0]?.cents, 20000);

console.log("meta-balance-ledger tests ok");
