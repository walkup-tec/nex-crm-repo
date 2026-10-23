import assert from "node:assert/strict";
import {
  campaignMetricsQuery,
  cleanCustomerId,
  customerClientQuery,
  googleAdsEnvNames,
  googleAdsFailure,
  missingGoogleAdsEnv,
  parseAccessibleCustomers,
  parseCampaignMetrics,
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
assert.equal(campaignMetricsQuery().startsWith("SELECT"), true);
assert.equal(campaignMetricsQuery().includes("UPDATE"), false);
assert.equal(campaignMetricsQuery().includes("mutate"), false);
assert.equal(googleAdsFailure(403, { error: { status: "PERMISSION_DENIED", details: [{ errors: [{ errorCode: { authorizationError: "CLOUD_PROJECT_NOT_APPROVED_FOR_PRODUCTION" } }] }] } }), "O projeto Google Cloud ainda não tem acesso Explorer ou superior para consultar contas reais.");
assert.equal(googleAdsFailure(401, { error: "invalid_grant" }), "A autorização do Google Ads expirou. Atualize o refresh token no servidor.");
