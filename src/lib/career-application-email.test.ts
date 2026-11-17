import assert from "node:assert/strict";
import {
  CAREER_APPLICATION_EMAIL_TEXT,
  careerApplicationEmailHtml,
} from "./career-application-email";

assert.ok(CAREER_APPLICATION_EMAIL_TEXT.includes("Marcelo Mozart"));
assert.ok(CAREER_APPLICATION_EMAIL_TEXT.includes("https://marcelomozart.com.br"));
assert.ok(CAREER_APPLICATION_EMAIL_TEXT.includes("51 999666841"));
assert.ok(CAREER_APPLICATION_EMAIL_TEXT.includes("\n\n"));
assert.ok(!CAREER_APPLICATION_EMAIL_TEXT.includes("**"));

const html = careerApplicationEmailHtml();
assert.ok(html.includes("<strong>Marcelo Mozart</strong>"));
assert.ok(html.includes("https://marcelomozart.com.br"));
assert.ok(html.includes("<br>"));

console.log("career-application-email.test.ts: ok");
