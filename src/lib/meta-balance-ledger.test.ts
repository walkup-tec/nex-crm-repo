import assert from "node:assert/strict";
import {
  centsFromMetaAmount,
  classifyGraphPayment,
  classifyPrepaidRow,
  hasCreditCard,
  mergeLedger,
  prepaidAvailableCents,
  prepaidBalanceCents,
  ledgerSourceRows,
  readLedger,
  metaBalanceHistorySince,
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

const octoberDepositAt = Date.parse("2026-10-07T15:00:00.000Z");
const october27At = Date.parse("2026-10-27T15:00:00.000Z");
const october28At = Date.parse("2026-10-28T15:00:00.000Z");
const octoberDeposit = classifyGraphPayment({
  id: "28936639426026954-2913029933327629",
  status: "Com saldo",
  payment_option: "Pagamento manual",
  app_amount: { amount: "200,00" },
  time: octoberDepositAt / 1000,
});
const october27 = classifyGraphPayment({
  id: "29373632172327680-29236716052685959",
  status: "Pago",
  payment_option: "Saldo pré-pago",
  app_amount: { amount: "33,01" },
  time: 0,
  billing_end_time: october27At / 1000,
});
const october28 = classifyGraphPayment({
  id: "29270693555954871-29465309913159899",
  status: "Pago",
  payment_option: "Saldo pré-pago",
  app_amount: { amount: "24,73" },
  time: String(october28At / 1000),
});
assert.equal(october27?.direction, "debit");
assert.equal(october27?.cents, 3301);
assert.equal(october27?.at, "2026-10-27T15:00:00.000Z");
assert.equal(october28?.direction, "debit");
assert.equal(october28?.cents, 2473);
assert.equal(october28?.at, "2026-10-28T15:00:00.000Z");
assert.equal(prepaidBalanceCents([octoberDeposit!, october27!, october28!]), 14226);
const staleOctober28 = {
  id: october28!.id,
  direction: "debit" as const,
  cents: 2172,
  at: "1970-01-01T00:00:00.000Z",
};
assert.equal(
  prepaidBalanceCents(
    mergeLedger([octoberDeposit!, staleOctober28], [octoberDeposit!, october27!, october28!]),
  ),
  14226,
);

const storedSpend = classifyGraphPayment({
  id: "29270693555954871-29465309913159899",
  status: "completed",
  payment_option: "stored_balance",
  app_amount: { amount: "24,73" },
  time: 1761609600,
});
assert.equal(storedSpend?.direction, "debit");
assert.equal(storedSpend?.cents, 2473);

const ledgerNow = Date.parse("2026-10-28T18:00:00.000Z");
const depositOnly = [{ id: "fund", status: "Com saldo", payment_option: "Pagamento manual", app_amount: { amount: "200,00" }, time: Date.parse("2026-10-07T15:00:00.000Z") / 1000 }];
const spendActivity = [{ event_type: "ad_account_billing_charge", event_time: Date.parse("2026-10-28T12:00:00.000Z") / 1000, object_id: "act_1", extra_data: JSON.stringify({ new_value: 2473, status: "paid" }) }];
assert.equal(ledgerSourceRows(depositOnly, spendActivity, ledgerNow).length, 2);
assert.equal(ledgerSourceRows([...depositOnly, { id: "paid", status: "Pago", payment_option: "Saldo pré-pago", app_amount: { amount: "24,73" }, time: Date.parse("2026-10-27T15:00:00.000Z") / 1000 }], spendActivity, ledgerNow).length, 2);
assert.equal(ledgerSourceRows([], spendActivity, ledgerNow).length, 1);

const balanceNow = Date.parse("2026-10-26T12:00:00.000Z");
assert.equal(
  new Date(Number(metaBalanceHistorySince(balanceNow)) * 1000).toISOString(),
  "2026-09-26T12:00:00.000Z",
);
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

const walkupNow = Date.parse("2026-10-28T18:00:00.000Z");
const walkup = [
  classifyGraphPayment({
    id: "28936639426026954-2913029933327629",
    status: "Com saldo",
    payment_option: "Pagamento manual",
    app_amount: { amount: "200,00" },
    time: Date.parse("2026-10-20T15:00:00.000Z") / 1000,
  })!,
  classifyGraphPayment({
    id: "29373632172327680-29236716052685959",
    status: "Pago",
    payment_option: "Saldo pré-pago",
    app_amount: { amount: "33,01" },
    time: Date.parse("2026-10-27T15:00:00.000Z") / 1000,
  })!,
  classifyGraphPayment({
    id: "29270693555954871-29465309913159899",
    status: "Pago",
    payment_option: "Saldo pré-pago",
    app_amount: { amount: "24,73" },
    time: Date.parse("2026-10-28T12:00:00.000Z") / 1000,
  })!,
  classifyGraphPayment({
    id: "29353659210991639-29241185882238978",
    status: "Pago",
    payment_option: "Saldo pré-pago",
    app_amount: { amount: "56,75" },
    time: Date.parse("2026-10-28T16:00:00.000Z") / 1000,
  })!,
];
assert.equal(walkup[0]?.manual, true);
const englishManual = classifyGraphPayment({
  id: "manual-en",
  status: "completed",
  is_funding_event: true,
  payment_option: "Pagamento manual",
  app_amount: { amount: "200,00" },
  time: Date.parse("2026-10-07T15:00:00.000Z") / 1000,
});
assert.equal(englishManual?.direction, "credit");
assert.equal(englishManual?.manual, true);
const fundingCredit = classifyGraphPayment({
  event_type: "funding_event_successful",
  event_time: Date.parse("2026-10-07T15:00:00.000Z") / 1000,
  object_id: "886574174420761",
  extra_data: JSON.stringify({ new_value: "20000", currency: "BRL" }),
});
const fundingCharges = [3301, 2473, 5675].map((cents, index) =>
  classifyGraphPayment({
    event_type: "ad_account_billing_charge",
    event_time: Date.parse("2026-10-27T15:00:00.000Z") / 1000 + index,
    object_id: `charge-${index}`,
    extra_data: JSON.stringify({ new_value: cents, status: "paid" }),
  }),
);
assert.equal(fundingCredit?.manual, false);
assert.equal(
  prepaidAvailableCents([fundingCredit!, ...fundingCharges.filter((entry) => entry != null)], walkupNow),
  8551,
);
assert.equal(prepaidAvailableCents(walkup, walkupNow), 8551);
assert.equal(
  prepaidAvailableCents(
    [
      {
        ...walkup[0]!,
        at: "2026-10-07T15:00:00.000Z",
      },
      ...walkup.slice(1),
    ],
    walkupNow,
  ),
  8551,
);
assert.equal(
  prepaidAvailableCents(
    [
      {
        ...walkup[0]!,
        at: "2026-09-20T15:00:00.000Z",
      },
      ...walkup.slice(1),
    ],
    walkupNow,
  ),
  null,
);

const screenNow = Date.parse("2026-10-28T23:00:00.000Z");
const screenRows = [
  {
    id: "29353659210991639-29241185882238978",
    status: "Pago",
    payment_option: "Saldo pré-pago",
    app_amount: { amount: "56,75" },
    time: Date.parse("2026-10-28T16:00:00.000Z") / 1000,
  },
  {
    id: "29270693555954871-29465309913159899",
    status: "Pago",
    payment_option: "Saldo pré-pago",
    app_amount: { amount: "24,73" },
    time: Date.parse("2026-10-28T12:00:00.000Z") / 1000,
  },
  {
    id: "29373632172327680-29236716052685959",
    status: "Pago",
    payment_option: "Saldo pré-pago",
    app_amount: { amount: "33,01" },
    time: Date.parse("2026-10-27T15:00:00.000Z") / 1000,
  },
  {
    id: "28936639426026954-2913029933327629",
    status: "Com saldo",
    payment_option: "Pagamento manual",
    app_amount: { amount: "200,00" },
    time: Date.parse("2026-10-07T15:00:00.000Z") / 1000,
  },
  {
    id: "29007270588963838-28916370761387158",
    status: "Falha",
    payment_option: "Pagamento manual",
    app_amount: { amount: "500,00" },
    time: Date.parse("2026-10-07T14:00:00.000Z") / 1000,
  },
];
const screenEntries = screenRows.flatMap((row) => {
  const entry = classifyPrepaidRow(row);
  return entry ? [entry] : [];
});
assert.equal(screenEntries.some((entry) => entry.cents === 50000), false);
assert.equal(prepaidAvailableCents(screenEntries, screenNow), 8551);
const apiRows = [
  {
    id: "api-spend-56",
    status: "completed",
    payment_option: "stored_balance",
    app_amount: { amount: "56.75", currency: "BRL" },
    time: Date.parse("2026-10-28T16:00:00.000Z") / 1000,
  },
  {
    id: "api-spend-24",
    status: "completed",
    payment_option: "stored_balance",
    app_amount: { amount: "24.73", currency: "BRL" },
    time: Date.parse("2026-10-28T12:00:00.000Z") / 1000,
  },
  {
    id: "api-spend-33",
    status: "completed",
    payment_option: "stored_balance",
    app_amount: { amount: "33.01", currency: "BRL" },
    time: Date.parse("2026-10-27T15:00:00.000Z") / 1000,
  },
  {
    id: "api-manual",
    status: "completed",
    payment_option: "Pagamento manual",
    app_amount: { amount: "200.00", currency: "BRL" },
    time: Date.parse("2026-10-07T15:00:00.000Z") / 1000,
  },
  {
    id: "api-failed",
    status: "failed",
    payment_option: "Pagamento manual",
    app_amount: { amount: "500.00", currency: "BRL" },
    time: Date.parse("2026-10-07T14:00:00.000Z") / 1000,
  },
  {
    id: "api-card",
    status: "completed",
    payment_option: "credit_card",
    charge_type: "payment",
    app_amount: { amount: "2,100.40", currency: "BRL" },
    time: Date.parse("2026-10-08T12:00:00.000Z") / 1000,
  },
];
const apiEntries = apiRows.flatMap((row) => {
  const entry = classifyPrepaidRow(row);
  return entry ? [entry] : [];
});
assert.equal(apiEntries.some((entry) => entry.cents === 50000 || entry.cents === 210040), false);
assert.equal(prepaidAvailableCents(apiEntries, screenNow), 8551);
assert.equal(
  classifyPrepaidRow({
    event_type: "funding_event_successful",
    event_time: Date.parse("2026-10-07T15:00:00.000Z") / 1000,
    object_id: "886574174420761",
    extra_data: JSON.stringify({ new_value: "12843", currency: "BRL" }),
  }),
  null,
);

console.log("meta-balance-ledger tests ok");
