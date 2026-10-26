import assert from "node:assert/strict";
import {
  accountDailyQuery,
  campaignMetricsQuery,
  enabledCampaignQuery,
  fillAccountDays,
  googleAdsQueryWindow,
  shiftIsoMonths,
  googleAdsMetricTotal,
  parseAccountDays,
  selectGoogleAdsMetric,
  sumGoogleCampaigns,
  cleanCustomerId,
  customerClientQuery,
  googleAdsEnvNames,
  adsLoadFailure,
  googleAdsFailure,
  missingGoogleAdsEnv,
  parseAccessibleCustomers,
  parseCampaignMetrics,
  parseEnabledCampaigns,
  parseCustomerClients,
  refreshTokenBody,
  refreshTokenUsable,
} from "./google-ads";

const empty = missingGoogleAdsEnv({});
assert.deepEqual(empty, [...googleAdsEnvNames]);
assert.deepEqual(missingGoogleAdsEnv(Object.fromEntries(googleAdsEnvNames.map((name) => [name, "valor"]))), []);

assert.equal(cleanCustomerId("customers/123-456-7890"), "1234567890");
assert.equal(cleanCustomerId("12"), "");
assert.equal(refreshTokenUsable(undefined), true);
assert.equal(refreshTokenUsable("https://www.googleapis.com/auth/adwords"), true);
assert.equal(refreshTokenUsable("https://www.googleapis.com/auth/calendar.events"), false);

const body = refreshTokenBody({ clientId: "id", clientSecret: "secret", refreshToken: "refresh" });
assert.equal(body.get("grant_type"), "refresh_token");
assert.equal(body.get("refresh_token"), "refresh");
assert.equal(body.has("developer_token"), false);

assert.deepEqual(parseAccessibleCustomers({ resourceNames: ["customers/1111111111", "customers/2222222222"] }), ["1111111111", "2222222222"]);
assert.deepEqual(
  parseCustomerClients({
    results: [
      { customerClient: { clientCustomer: "customers/3333333333", descriptiveName: "Cliente A", currencyCode: "BRL", status: "ENABLED", manager: false } },
      { customerClient: { clientCustomer: "customers/4444444444", descriptiveName: "MCC", manager: true } },
    ],
  }),
  [{ customerId: "3333333333", name: "Cliente A", currency: "BRL", status: "ENABLED" }],
);

const campaigns = parseCampaignMetrics({
  results: [
    { campaign: { id: "9", name: "Marca", status: "ENABLED" }, metrics: { impressions: "10", clicks: "2", costMicros: "1500000", conversions: 1 } },
    { campaign: { id: "9", name: "Marca", status: "ENABLED" }, metrics: { impressions: 5, clicks: 1, costMicros: 500000, conversions: 0 } },
  ],
});
assert.equal(campaigns.length, 1);
assert.equal(campaigns[0]?.impressions, 15);
assert.equal(campaigns[0]?.clicks, 3);
assert.equal(campaigns[0]?.cost, 2);
assert.equal(campaigns[0]?.conversions, 1);
assert.equal(customerClientQuery().includes("customer_client.manager = FALSE"), true);
const daily = accountDailyQuery("2026-10-01", "2026-10-23");
assert.equal(daily.startsWith("SELECT"), true);
assert.equal(daily.includes("segments.date"), true);
assert.equal(daily.includes("BETWEEN '2026-10-01' AND '2026-10-23'"), true);
assert.equal(daily.includes("THIS_MONTH"), false);
assert.equal(daily.includes("UPDATE"), false);
assert.equal(daily.includes("mutate"), false);
assert.equal(shiftIsoMonths("2026-10-23", -37), "2023-09-23");
assert.equal(googleAdsQueryWindow({ period: "total" }, "2026-10-23").since, "2023-09-23");
assert.equal(googleAdsQueryWindow({ period: "custom", since: "2026-10-01", until: "2026-10-23" }, "2026-10-23").until, "2026-10-23");
assert.throws(() => googleAdsQueryWindow({ period: "custom", since: "2026-10-23", until: "2026-10-01" }, "2026-10-23"), /começar antes/);
assert.throws(() => googleAdsQueryWindow({ period: "custom", since: "2026-10-01", until: "2026-10-24" }, "2026-10-23"), /futuro/);
assert.throws(() => googleAdsQueryWindow({ period: "custom", since: "2020-01-01", until: "2026-10-23" }, "2026-10-23"), /37 meses/);
const days = parseAccountDays({
  results: [
    { segments: { date: "2026-10-02" }, metrics: { impressions: "4", clicks: "1", costMicros: "1000000" } },
    { segments: { date: "2026-10-02" }, metrics: { impressions: 6, clicks: 1, costMicros: 500000 } },
    { segments: { date: "2026-10-03" }, metrics: { impressions: 0, clicks: 0, costMicros: 0 } },
  ],
});
assert.equal(days.length, 2);
assert.equal(days[0]?.clicks, 2);
assert.equal(days[0]?.impressions, 10);
assert.equal(days[0]?.cost, 1.5);
const month = fillAccountDays(days, "2026-10-01", "2026-10-03");
assert.equal(month.length, 3);
assert.equal(month[0]?.date, "2026-10-01");
assert.equal(month[0]?.clicks, 0);
assert.equal(month[1]?.clicks, 2);
assert.equal(month[2]?.date, "2026-10-03");
assert.equal(googleAdsMetricTotal(days, "cpc"), 0.75);
assert.equal(googleAdsMetricTotal(days, "clicks"), 2);
assert.deepEqual(selectGoogleAdsMetric(["clicks"], "impressions"), ["clicks", "impressions"]);
assert.deepEqual(selectGoogleAdsMetric(["clicks", "impressions"], "cost"), ["clicks", "cost"]);
assert.deepEqual(selectGoogleAdsMetric(["clicks", "impressions"], "impressions"), ["clicks"]);
assert.deepEqual(selectGoogleAdsMetric(["clicks"], "clicks"), ["clicks"]);
assert.equal(campaignMetricsQuery("2026-10-01", "2026-10-23").startsWith("SELECT"), true);
assert.equal(campaignMetricsQuery("2026-10-01", "2026-10-23").includes("BETWEEN '2026-10-01' AND '2026-10-23'"), true);
assert.equal(campaignMetricsQuery("2026-10-01", "2026-10-23").includes("UPDATE"), false);
assert.equal(campaignMetricsQuery("2026-10-01", "2026-10-23").includes("mutate"), false);
assert.equal(enabledCampaignQuery().includes("campaign.status = 'ENABLED'"), true);
assert.deepEqual(
  parseEnabledCampaigns({
    results: [
      { campaign: { id: "9", name: "Marca", status: "ENABLED" } },
      { campaign: { id: "9", name: "Marca", status: "ENABLED" } },
      { campaign: { id: "4", name: "Pausada", status: "PAUSED" } },
    ],
  }),
  [{ id: "9", name: "Marca" }],
);
assert.deepEqual(
  sumGoogleCampaigns([
    { impressions: 21, clicks: 0, cost: 1, conversions: 0 },
    { impressions: 271, clicks: 33, cost: 11, conversions: 1 },
  ]),
  { impressions: 292, clicks: 33, cost: 12, conversions: 1 },
);
assert.equal(
  googleAdsFailure(403, { error: { status: "PERMISSION_DENIED", details: [{ errors: [{ errorCode: { authorizationError: "CLOUD_PROJECT_NOT_APPROVED_FOR_PRODUCTION" }, message: "The project is not approved." }] }] } }),
  "O projeto Google Cloud ainda não tem acesso Explorer ou superior para consultar contas reais. PERMISSION_DENIED — CLOUD_PROJECT_NOT_APPROVED_FOR_PRODUCTION — The project is not approved.",
);
assert.equal(
  googleAdsFailure(400, { error: { code: 400, status: "INVALID_ARGUMENT", message: "Request contains an invalid argument.", details: [{ errors: [{ errorCode: { queryError: "BAD_VALUE" } }] }] } }),
  "Não foi possível consultar o Google Ads. HTTP 400 — INVALID_ARGUMENT — BAD_VALUE — Request contains an invalid argument.",
);
assert.equal(googleAdsFailure(401, { error: "invalid_grant" }), "A autorização do Google Ads expirou. Atualize o refresh token no servidor.");
assert.equal(adsLoadFailure(new Error("Failed to fetch")), "A conexão com o Google Ads caiu antes da resposta.");
assert.equal(adsLoadFailure(new Error("ya29.secret")), "A consulta das contas do Google Ads foi interrompida antes da resposta.");
