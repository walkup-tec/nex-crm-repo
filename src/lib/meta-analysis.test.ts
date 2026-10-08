import assert from "node:assert/strict";
import {
  aggregateDays,
  buildAnalysis,
  buildInsights,
  changePercent,
  formatInteger,
  formatMoney,
  formatPercent,
  funnelStageWidths,
  ratesOf,
} from "./meta-analysis";
import type { MetaCampaignRow, MetaDayPoint, MetaKpis } from "./meta-access";

function campaign(
  partial: Partial<MetaCampaignRow> & Pick<MetaCampaignRow, "id" | "name">,
): MetaCampaignRow {
  return {
    status: "Ativa",
    statusGroup: "Ativa",
    reach: 0,
    impressions: 0,
    clicks: 0,
    results: 0,
    resultLabel: "Conversas",
    spend: 0,
    cpc: null,
    ctr: null,
    ...partial,
  };
}

function kpis(partial: Partial<MetaKpis>): MetaKpis {
  return {
    reach: 0,
    impressions: 0,
    clicks: 0,
    results: 0,
    resultLabel: "Conversas",
    spend: 0,
    cpc: null,
    ctr: null,
    cpm: null,
    frequency: null,
    ...partial,
  };
}

const days: MetaDayPoint[] = [
  { date: "2026-08-01", campaignId: "a", spend: 10, impressions: 100, clicks: 4, results: 2 },
  { date: "2026-08-02", campaignId: "a", spend: 12, impressions: 80, clicks: 2, results: 3 },
  { date: "2026-08-03", campaignId: "a", spend: 20, impressions: 0, clicks: 0, results: 0 },
];

const withResults = ratesOf({
  spend: 395.52,
  impressions: 25430,
  reach: 18250,
  clicks: 1420,
  results: 96,
  resultLabel: "Conversas",
});
assert.equal(withResults.costPerResult, 395.52 / 96);
assert.ok(withResults.ctr != null && withResults.ctr > 0);
assert.equal(formatMoney(withResults.costPerResult), "R$\u00a04,12");

const noResults = ratesOf({
  spend: 50,
  impressions: 1000,
  reach: 800,
  clicks: 10,
  results: 0,
  resultLabel: "Cliques",
});
assert.equal(noResults.costPerResult, null);
assert.notEqual(formatMoney(noResults.costPerResult), "NaN");
assert.equal(formatMoney(noResults.costPerResult), "—");

const noSpend = ratesOf({
  spend: 0,
  impressions: 0,
  reach: 0,
  clicks: 0,
  results: 0,
  resultLabel: "Cliques",
});
assert.equal(noSpend.cpc, null);
assert.equal(noSpend.frequency, null);
assert.equal(formatInteger(noSpend.ctr), "—");

assert.equal(changePercent(10, 0), null);
assert.equal(changePercent(0, 0), 0);
assert.equal(changePercent(0, 10), -100);

const oneDay = aggregateDays(days.slice(0, 1), "day");
assert.equal(oneDay.length, 1);
assert.equal(oneDay[0]?.results, 2);
assert.equal(oneDay[0]?.costPerResult, 5);

const several = aggregateDays(days, "day");
assert.equal(several.length, 3);
assert.equal(several[2]?.costPerResult, null);

const month = aggregateDays(days, "month");
assert.equal(month.length, 1);
assert.equal(month[0]?.results, 5);
assert.equal(month[0]?.spend, 42);
assert.equal(month[0]?.costPerResult, 42 / 5);

const analysis = buildAnalysis({
  period: { mode: "custom", since: "2026-08-01", until: "2026-08-03" },
  campaigns: [
    campaign({
      id: "a",
      name: "Campanha com nome muito longo para não quebrar o cálculo financeiro",
      results: 96,
      spend: 355.2,
      impressions: 20000,
      reach: 15000,
      clicks: 900,
    }),
    campaign({
      id: "b",
      name: "Campanha B",
      results: 140,
      spend: 588,
      impressions: 10000,
      reach: 8000,
      clicks: 400,
    }),
  ],
  kpis: kpis({
    results: 236,
    spend: 943.2,
    impressions: 30000,
    reach: 18250,
    clicks: 1300,
    resultLabel: "Conversas",
  }),
  previous: kpis({
    results: 200,
    spend: 900,
    impressions: 28000,
    reach: 14000,
    clicks: 1000,
    resultLabel: "Conversas",
  }),
  previousReady: true,
  previousCampaigns: [],
  days,
  campaignId: null,
});
assert.equal(analysis.campaigns[0]?.id, "b");
assert.equal(analysis.campaigns[0]?.name?.includes("Campanha B"), true);
assert.ok((analysis.campaigns[1]?.name.length ?? 0) > 40);
assert.equal(
  analysis.insights.some((item) => /criativo|saturad|segmenta/i.test(item.text)),
  false,
);
assert.notEqual(formatPercent(analysis.rates.ctr), "NaN");
assert.notEqual(formatInteger(analysis.current.results), "Infinity");

const missingPrevious = buildAnalysis({
  period: { mode: "total" },
  campaigns: [
    campaign({ id: "a", name: "A", results: 4, spend: 20, clicks: 8, impressions: 100, reach: 80 }),
  ],
  kpis: kpis({ results: 4, spend: 20, clicks: 8, impressions: 100, reach: 80 }),
  previous: null,
  previousReady: false,
  previousCampaigns: [],
  days: days.slice(0, 1),
  campaignId: "a",
});
assert.equal(missingPrevious.previous, null);
assert.equal(missingPrevious.status, null);
assert.deepEqual(missingPrevious.insights, []);

const currentZero = buildAnalysis({
  period: { mode: "custom", since: "2026-09-06", until: "2026-10-05" },
  campaigns: [campaign({ id: "a", name: "Zerada", results: 0, spend: 0 })],
  kpis: kpis({ results: 0, spend: 0 }),
  previous: kpis({ results: 10, spend: 40, clicks: 4, impressions: 100, reach: 80 }),
  previousReady: true,
  previousCampaigns: [{ id: "a", spend: 40, impressions: 100, reach: 80, clicks: 4, results: 10 }],
  days: [{ date: "2026-09-06", campaignId: "a", spend: 0, impressions: 0, clicks: 0, results: 0 }],
  campaignId: "a",
});
assert.equal(currentZero.rates.costPerResult, null);
assert.equal(currentZero.status?.label, "Ponto de atenção");

const efficiency = buildInsights(
  { spend: 100, impressions: 1000, reach: 800, clicks: 50, results: 118, resultLabel: "Conversas" },
  { spend: 100, impressions: 900, reach: 640, clicks: 30, results: 100, resultLabel: "Conversas" },
  ratesOf({
    spend: 100,
    impressions: 1000,
    reach: 800,
    clicks: 50,
    results: 118,
    resultLabel: "Conversas",
  }),
  ratesOf({
    spend: 100,
    impressions: 900,
    reach: 640,
    clicks: 30,
    results: 100,
    resultLabel: "Conversas",
  }),
);
assert.equal(
  efficiency.some((item) => item.title === "Campanha ganhando eficiência"),
  true,
);

const mixed = buildAnalysis({
  period: { mode: "custom", since: "2026-08-01", until: "2026-08-31" },
  campaigns: [
    campaign({
      id: "a",
      name: "Conversas",
      resultLabel: "Conversas",
      results: 10,
      spend: 40,
      reach: 1000,
      impressions: 2000,
      clicks: 80,
    }),
    campaign({
      id: "b",
      name: "Leads",
      resultLabel: "Leads",
      results: 4,
      spend: 20,
      reach: 500,
      impressions: 800,
      clicks: 20,
    }),
  ],
  kpis: kpis({
    results: 14,
    spend: 60,
    reach: 1400,
    impressions: 2800,
    clicks: 100,
    resultLabel: "Resultados",
  }),
  previous: kpis({
    results: 10,
    spend: 60,
    reach: 1000,
    impressions: 2000,
    clicks: 50,
    resultLabel: "Resultados",
  }),
  previousReady: true,
  previousCampaigns: [],
  days: [],
  campaignId: null,
});
assert.equal(mixed.comparable, false);
assert.equal(mixed.status, null);
assert.equal(mixed.current.results, 0);
assert.equal(mixed.rates.costPerResult, null);
assert.equal(mixed.previous?.spend, 60);
assert.equal(mixed.previous?.results, 0);
assert.equal(
  mixed.insights.some((item) => item.title === "Maior alcance"),
  true,
);
assert.equal(
  mixed.insights.some((item) => /criativo|saturad|segmenta/i.test(`${item.title} ${item.text}`)),
  false,
);
assert.equal(mixed.campaigns[0]?.resultLabel, "Conversas");
assert.equal(mixed.campaigns[1]?.resultLabel, "Leads");

const screenshotFunnel = funnelStageWidths([3819, 2320, 86, 37]);
assert.equal(screenshotFunnel.length, 4);
assert.equal(screenshotFunnel[0], 1);
assert.ok((screenshotFunnel[1] ?? 0) > 0.7 && (screenshotFunnel[1] ?? 0) < 0.9);
assert.ok((screenshotFunnel[2] ?? 0) >= 0.22);
assert.ok((screenshotFunnel[3] ?? 0) >= 0.15);
for (let index = 1; index < screenshotFunnel.length; index += 1) {
  assert.ok((screenshotFunnel[index] ?? 0) < (screenshotFunnel[index - 1] ?? 0));
}

const hiddenResults = funnelStageWidths([3819, 2320, 86, null]);
assert.ok((hiddenResults[3] ?? 0) < (hiddenResults[2] ?? 0));
assert.ok((hiddenResults[3] ?? 1) > 0.12);

const flat = funnelStageWidths([100, 100, 100, 100]);
assert.deepEqual(flat, [1, 1, 1, 1]);

const flare = funnelStageWidths([100, 400, 50, 10]);
assert.ok((flare[1] ?? 1) <= (flare[0] ?? 0));
assert.ok((flare[2] ?? 1) < (flare[1] ?? 0));
assert.ok((flare[3] ?? 1) < (flare[2] ?? 0));

const emptyJourney = funnelStageWidths([0, 0, 0, 0]);
for (let index = 1; index < emptyJourney.length; index += 1) {
  assert.ok((emptyJourney[index] ?? 0) < (emptyJourney[index - 1] ?? 0));
}

console.log("meta-analysis tests ok");
