import assert from "node:assert/strict";
import {
  CAREER_ALLOWED_EMAIL,
  isCareerAllowedEmail,
  normalizeCnpj,
  normalizeCompanyName,
  normalizeDomain,
  normalizeJobTitle,
  normalizeJobUrl,
  normalizeLinkedInUrl,
} from "./career-access";
import { assertCareerPanelAccess, clearCareerOwnerCache, canAccessCareerPanel } from "../server/career-access.server";
import { chatgptCareerOpenApiDocument } from "./chatgpt-career-openapi";
import { authenticateChatgptIntegration } from "../server/chatgpt-integration.server";

assert.equal(isCareerAllowedEmail("walkup@walkuptec.com.br"), true);
assert.equal(isCareerAllowedEmail(" Walkup@WalkupTec.com.br "), true);
assert.equal(isCareerAllowedEmail("outro@walkuptec.com.br"), false);
assert.equal(CAREER_ALLOWED_EMAIL, "walkup@walkuptec.com.br");

assert.equal(normalizeCompanyName("  Agência  FOO-Bar  Ltda. "), "agencia foo bar ltda");
assert.equal(normalizeCnpj("12.345.678/0001-90"), "12345678000190");
assert.equal(normalizeCnpj("123"), "");
assert.equal(normalizeDomain("https://WWW.Example.com/path?x=1"), "example.com");
assert.equal(normalizeDomain("example.com.br"), "example.com.br");
assert.equal(normalizeLinkedInUrl("https://www.linkedin.com/company/Foo-Bar/?trk=x"), "linkedin.com/company/foo-bar");
assert.equal(
  normalizeJobUrl("https://jobs.example.com/vaga/1/?utm_source=x&fbclid=1#sec"),
  "https://jobs.example.com/vaga/1",
);
assert.equal(normalizeJobTitle("Gerente de Tráfego Sênior"), "gerente de trafego senior");

clearCareerOwnerCache();
process.env["CAREER_ALLOWED_USER_ID"] = "user-walkup-uuid";
await assertCareerPanelAccess("user-walkup-uuid");
assert.equal(await canAccessCareerPanel("user-walkup-uuid"), true);
assert.equal(await canAccessCareerPanel("outro-master"), false);
let forbidden = false;
try {
  await assertCareerPanelAccess("outro-master");
} catch (error) {
  forbidden = error instanceof Error && error.name === "CareerForbiddenError";
}
assert.equal(forbidden, true);
clearCareerOwnerCache();
delete process.env["CAREER_ALLOWED_USER_ID"];

const openapi = chatgptCareerOpenApiDocument("https://app.nexmeta.com.br");
assert.equal(openapi.info.title.includes("Career"), true);
assert.ok(openapi.paths["/api/integrations/chatgpt/career/companies/discover"]);
assert.ok(openapi.paths["/api/integrations/chatgpt/career/jobs/search"]);
assert.ok(!openapi.paths["/api/integrations/chatgpt/analyses/{executionId}"]);

process.env["CHATGPT_INTEGRATION_SECRET"] = "nex-career-test-secret";
assert.equal(authenticateChatgptIntegration(new Request("https://nex.test/api")).status, 401);
assert.equal(
  authenticateChatgptIntegration(
    new Request("https://nex.test/api", { headers: { authorization: "Bearer wrong" } }),
  )?.status,
  401,
);
assert.equal(
  authenticateChatgptIntegration(
    new Request("https://nex.test/api", { headers: { authorization: "Bearer nex-career-test-secret" } }),
  ),
  null,
);

console.log("career-access.test.ts: ok");
