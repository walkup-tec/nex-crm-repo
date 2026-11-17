import assert from "node:assert/strict";
import { extractBearerToken, secretsMatch } from "./chatgpt-integration";
import { handleMetaLowBalanceScanRequest } from "../server/meta-credit-scan.server";

const SECRET = "nex-meta-low-balance-cron-test";
process.env["META_LOW_BALANCE_CRON_SECRET"] = SECRET;
delete process.env["CHATGPT_INTEGRATION_SECRET"];

const url = "https://app.nexmeta.com.br/api/meta/low-balance-scan";

assert.equal(extractBearerToken("Bearer abc"), "abc");
assert.equal(secretsMatch(SECRET, SECRET), true);

{
  const res = await handleMetaLowBalanceScanRequest(
    new Request(url, { method: "POST", headers: { "content-type": "application/json" } }),
  );
  assert.equal(res.status, 401);
  const body = (await res.json()) as { error?: string };
  assert.equal(body.error, "unauthorized");
  assert.ok(!JSON.stringify(body).includes(SECRET));
}

{
  const res = await handleMetaLowBalanceScanRequest(
    new Request(url, {
      method: "POST",
      headers: { authorization: "Bearer wrong", "content-type": "application/json" },
    }),
  );
  assert.equal(res.status, 401);
}

console.log("meta-credit-scan.test.ts: ok");
