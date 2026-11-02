import assert from "node:assert/strict";
import { openaiPublicError } from "./openai.server";

assert.match(openaiPublicError(404, "404 page not found"), /OPENAI_API_URL/);
assert.match(openaiPublicError(502, '{"error":{"message":"404 page not found"}}'), /OPENAI_API_URL/);
assert.match(openaiPublicError(401, "{}"), /recusada/);
assert.match(openaiPublicError(500, '{"error":{"message":"model overloaded"}}'), /model overloaded/);

console.log("openai.server.test.ts: ok");
