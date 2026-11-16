import assert from "node:assert/strict";
import {
  adsConnectionSections,
  adsDashboardOrder,
  commercialOffer,
  masterSeesUserAccess,
  metaConnectionBroken,
  organizationHasAdsAccess,
} from "./user-access";

const now = Date.parse("2026-10-23T12:00:00-03:00");

assert.equal(metaConnectionBroken({ status: "connected", expiresAt: "2026-10-23T18:00:00.000Z" }, now), false);
assert.equal(metaConnectionBroken({ status: "error", expiresAt: "2026-10-23T18:00:00.000Z" }, now), true);
assert.equal(metaConnectionBroken({ status: "connected", lastError: "A conexão com a Meta expirou." }, now), true);
assert.equal(metaConnectionBroken({ status: "connected", expiresAt: "2026-10-23T10:00:00.000Z" }, now), true);
assert.equal(metaConnectionBroken({ status: "disconnected", lastError: "A conexão com a Meta expirou." }, now), false);
assert.equal(metaConnectionBroken({ status: "missing" }, now), false);
assert.deepEqual(adsConnectionSections({ adsMeta: true, adsGoogle: false }), { meta: true, google: false });
assert.deepEqual(adsConnectionSections({ adsMeta: false, adsGoogle: true }), { meta: false, google: true });
assert.deepEqual(adsConnectionSections({ adsMeta: true, adsGoogle: true }), { meta: true, google: true });
assert.deepEqual(adsConnectionSections(null), { meta: true, google: false });
assert.deepEqual(adsDashboardOrder({ adsMeta: true, adsGoogle: false }), ["meta", "google"]);
assert.deepEqual(adsDashboardOrder({ adsMeta: false, adsGoogle: true }), ["google", "meta"]);
assert.deepEqual(adsDashboardOrder({ adsMeta: true, adsGoogle: true }), ["meta", "google"]);
assert.equal(commercialOffer("google").message.endsWith("Google Ads"), true);
assert.equal(commercialOffer("meta").message.endsWith("Meta Ads"), true);
assert.equal(commercialOffer("google").href, "https://wa.me/555197979224");
assert.equal(organizationHasAdsAccess({ adsMeta: true, adsGoogle: false }), true);
assert.equal(organizationHasAdsAccess({ adsMeta: false, adsGoogle: true }), true);
assert.equal(organizationHasAdsAccess({ adsMeta: false, adsGoogle: false }), false);
assert.equal(organizationHasAdsAccess(null), false);
const platforms = new Map([
  ["ads", { adsMeta: true, adsGoogle: false }],
  ["hosting", { adsMeta: false, adsGoogle: false }],
]);
assert.equal(masterSeesUserAccess({ role: "master", organizationId: null, platforms }), true);
assert.equal(masterSeesUserAccess({ role: "client_admin", organizationId: "ads", platforms }), true);
assert.equal(masterSeesUserAccess({ role: "client_user", organizationId: "ads", platforms }), true);
assert.equal(masterSeesUserAccess({ role: "client_admin", organizationId: "hosting", platforms }), false);
assert.equal(masterSeesUserAccess({ role: "client_admin", organizationId: "hosting", platforms: null }), true);
assert.equal(masterSeesUserAccess({ role: "client_admin", organizationId: null, platforms }), false);
