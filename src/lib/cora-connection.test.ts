import assert from "node:assert/strict";
import { normalizePem, resolveCoraSettings } from "./cora-connection";

const pem = "-----BEGIN CERTIFICATE-----\\nABC\\n-----END CERTIFICATE-----";

assert.equal(normalizePem(pem).includes("\nABC\n"), true);

const stage = resolveCoraSettings({ id: "app-teste", secret: "segredo" });
assert.equal(stage.direct, false);
assert.equal(stage.base, "https://api.stage.cora.com.br");

const production = resolveCoraSettings({ id: "int-teste", cert: pem, key: pem });
assert.equal(production.direct, true);
assert.equal(production.base, "https://matls-clients.api.cora.com.br");
assert.equal(production.secret, "");

assert.throws(
  () => resolveCoraSettings({ id: "int-teste", base: "https://matls-clients.api.cora.com.br" }),
  /certificado e a private key/,
);

console.log("cora-connection ok");
