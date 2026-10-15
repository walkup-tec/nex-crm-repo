import assert from "node:assert/strict";
import { applyClearedNotices, clearVisibleNotices } from "./notice-clear";

const leads = [
  { conversationId: "a", name: "Paulo" },
  { conversationId: "b", name: "Francisco" },
];
const empty = { queue: [], offline: false, balance: false };

const cleared = clearVisibleNotices(["a", "b"], true, false, empty);
const hidden = applyClearedNotices(leads, true, false, cleared);
assert.deepEqual(hidden.leads, []);
assert.equal(hidden.offline, false);

const withNewLead = applyClearedNotices([...leads, { conversationId: "c", name: "Ana" }], true, false, hidden.cleared);
assert.deepEqual(withNewLead.leads.map((lead) => lead.conversationId), ["c"]);

const backOnline = applyClearedNotices(leads, false, false, hidden.cleared);
assert.equal(backOnline.cleared.offline, false);
const offlineAgain = applyClearedNotices([], true, false, backOnline.cleared);
assert.equal(offlineAgain.offline, true);

const leftQueue = applyClearedNotices([{ conversationId: "b", name: "Francisco" }], false, false, hidden.cleared);
assert.deepEqual(leftQueue.cleared.queue, ["b"]);
