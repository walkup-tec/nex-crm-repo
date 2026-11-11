import assert from "node:assert/strict";
import { attendantChannelScope, teamChannelsAfterRemoval, teamNeedsChannel } from "./chatbot-teams";

assert.deepEqual(teamChannelsAfterRemoval(["canal-a"], "canal-a"), []);
assert.equal(teamNeedsChannel(teamChannelsAfterRemoval(["canal-a"], "canal-a")), true);
assert.deepEqual(teamChannelsAfterRemoval(["canal-a", "canal-b"], "canal-a"), ["canal-b"]);
assert.equal(teamNeedsChannel(teamChannelsAfterRemoval(["canal-a", "canal-b"], "canal-a")), false);
assert.deepEqual(teamChannelsAfterRemoval(["canal-b"], "canal-a"), ["canal-b"]);
assert.deepEqual(teamChannelsAfterRemoval(["canal-a", "canal-a"], "canal-a"), []);
assert.equal(attendantChannelScope({ admin: true, teamConnectionIds: [] }), "all");
assert.equal(attendantChannelScope({ admin: true, teamConnectionIds: ["canal-nex"] }), "restricted");
assert.equal(attendantChannelScope({ admin: false, teamConnectionIds: ["canal-nex"] }), "restricted");
assert.equal(attendantChannelScope({ admin: false, teamConnectionIds: [] }), "restricted");
