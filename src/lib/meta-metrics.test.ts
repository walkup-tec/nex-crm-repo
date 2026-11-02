import assert from "node:assert/strict";
import {
  computeAccountMetricsFromCampaignSpend,
  computeCostPerResult,
  computeCpc,
  computeCpm,
  computeCtr,
  fromMoneyCents,
  sumMoneyCents,
  toMoneyCents,
} from "./meta-metrics";

// Teste A — Investimento total 81.05 + 78.17 + 27.64 = 186.86
const cents = sumMoneyCents([81.05, 78.17, 27.64]);
assert.equal(cents, 18686);
assert.equal(fromMoneyCents(cents), 186.86);

const account = computeAccountMetricsFromCampaignSpend([81.05, 78.17, 27.64], {
  currency: "BRL",
  impressions: [1000, 2000, null],
  clicks: [10, 20, 5],
});
assert.equal(account.spend_total, 186.86);
assert.equal(account.spend_total_cents, 18686);
assert.equal(account.impressions_total, 3000);
assert.equal(account.clicks_total, 35);
assert.equal(account.ctr, computeCtr(35, 3000));
assert.equal(account.cpc, computeCpc(186.86, 35));
assert.equal(account.cpm, computeCpm(186.86, 3000));

assert.equal(toMoneyCents("12.345"), 1235);
assert.equal(computeCostPerResult(100, 0), null);
assert.equal(computeCostPerResult(100, null), null);
assert.equal(computeCtr(null, 100), null);

console.log("meta-metrics.test.ts: ok");
