import assert from "node:assert/strict";
import {
  mapMetaDailyInsight,
  mapMetaInsight,
  metaAnalysisFileName,
  moneyFromMetaBudget,
  resultsFromActions,
  targetingSummary,
} from "./meta-export";

assert.equal(moneyFromMetaBudget("15000"), 150);
assert.equal(moneyFromMetaBudget(null), null);

assert.deepEqual(
  resultsFromActions(
    [
      { action_type: "link_click", value: "10" },
      { action_type: "onsite_conversion.messaging_conversation_started_7d", value: "4" },
    ],
    ["onsite_conversion.messaging_conversation_started_7d"],
  ),
  { results: 4, result_metric: "onsite_conversion.messaging_conversation_started_7d" },
);

const insight = mapMetaInsight({
  spend: "100.5",
  impressions: "2000",
  reach: "1600",
  frequency: "1.25",
  clicks: "60",
  inline_link_clicks: "40",
  ctr: "3",
  inline_link_click_ctr: "2",
  cpc: "1.67",
  cost_per_inline_link_click: "2.5",
  cpm: "50",
  actions: [{ action_type: "onsite_conversion.messaging_conversation_started_7d", value: "10" }],
});
assert.equal(insight?.spend, 100.5);
assert.equal(insight?.link_clicks, 40);
assert.equal(insight?.results, 10);
assert.equal(insight?.cost_per_result, 10.05);

const day = mapMetaDailyInsight({
  date_start: "2026-10-26",
  spend: "20",
  impressions: "400",
  reach: "350",
  clicks: "12",
  inline_link_clicks: "8",
  actions: [{ action_type: "lead", value: "2" }],
});
assert.equal(day?.date, "2026-10-26");
assert.equal(day?.results, 2);

assert.equal(
  targetingSummary({
    age_min: 25,
    age_max: 45,
    genders: [1, 2],
    geo_locations: { countries: ["BR"] },
  }),
  "idade 25-45; gêneros 1,2; países BR",
);

assert.equal(
  metaAnalysisFileName({
    accountId: "act_123",
    since: "2026-10-01",
    until: "2026-10-31",
    exportedAt: "2026-11-02T13:00:00-03:00",
  }),
  "nex_meta_analysis_123_2026-10-01_2026-10-31_2026-11-02-13-00-00.json",
);

console.log("meta-export ok");
