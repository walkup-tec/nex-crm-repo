import assert from "node:assert/strict";
import { inboxPollNotice } from "./chatbot-evo";

assert.equal(inboxPollNotice("404 page not found", true), "");
assert.equal(inboxPollNotice("404 page not found", false), "Não foi possível atualizar as conversas.");
assert.equal(inboxPollNotice("502 Bad Gateway", true), "");
assert.equal(inboxPollNotice("O WhatsApp dessa conversa não está conectado.", true), "O WhatsApp dessa conversa não está conectado.");
assert.equal(inboxPollNotice("   ", true), "");

console.log("inbox poll notice ok");
