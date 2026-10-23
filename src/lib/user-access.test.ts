import assert from "node:assert/strict";
import { adsConnectionSections, adsDashboardOrder, commercialOffer, metaConnectionBroken } from "./user-access";

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
