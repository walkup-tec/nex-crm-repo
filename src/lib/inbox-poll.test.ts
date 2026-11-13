import assert from "node:assert/strict";
import { absorbInboxThreadUpdates, inboxDocumentTitle, inboxPollIntervalMs, inboxPollNotice, mergeInboxThreadMessages } from "./chatbot-evo";

assert.equal(inboxPollNotice("404 page not found", true), "");
assert.equal(inboxPollNotice("404 page not found", false), "Não foi possível atualizar as conversas.");
assert.equal(inboxPollNotice("502 Bad Gateway", true), "");
assert.equal(inboxPollNotice("O WhatsApp dessa conversa não está conectado.", true), "O WhatsApp dessa conversa não está conectado.");
assert.equal(inboxPollNotice("   ", true), "");
assert.equal(inboxPollIntervalMs(false), 5_000);
assert.equal(inboxPollIntervalMs(true), 15_000);
assert.equal(inboxDocumentTitle(0), "NEX Ads");
assert.equal(inboxDocumentTitle(3), "(3) NEX Ads");
assert.deepEqual(
  mergeInboxThreadMessages(
    [{ id: "a", createdAt: "2026-01-01T10:00:00.000Z" }],
    [{ id: "b", createdAt: "2026-01-01T09:00:00.000Z" }],
  ).map((item) => item.id),
  ["b", "a"],
);
assert.deepEqual(
  absorbInboxThreadUpdates(
    [
      { id: "a", createdAt: "2026-01-01T10:00:00.000Z" },
      { id: "b", createdAt: "2026-01-01T11:00:00.000Z" },
    ],
    [
      { id: "old", createdAt: "2026-01-01T09:00:00.000Z" },
      { id: "c", createdAt: "2026-01-01T12:00:00.000Z" },
      { id: "a", createdAt: "2026-01-01T10:00:00.000Z" },
    ],
  ).map((item) => item.id),
  ["a", "b", "c"],
);

console.log("inbox poll notice ok");
