import assert from "node:assert/strict";
import { nexDeployStatus } from "./nex-deploy";

type NexProcess = typeof globalThis & {
  __NEX_DEPLOY?: string;
  __NEX_BOOT_ID?: string;
  __NEX_SHUTTING_DOWN?: boolean;
};

const runtime = globalThis as NexProcess;
const previous = {
  marker: runtime.__NEX_DEPLOY,
  boot: runtime.__NEX_BOOT_ID,
  shuttingDown: runtime.__NEX_SHUTTING_DOWN,
};

function restore() {
  runtime.__NEX_DEPLOY = previous.marker;
  runtime.__NEX_BOOT_ID = previous.boot;
  runtime.__NEX_SHUTTING_DOWN = previous.shuttingDown;
}

runtime.__NEX_DEPLOY = "NEX-DEPLOY-TEST";
runtime.__NEX_BOOT_ID = "boot-1";
runtime.__NEX_SHUTTING_DOWN = false;
const live = nexDeployStatus();
assert.equal(live.ok, true);
assert.equal(live.ready, true);
assert.equal(live.shuttingDown, false);
assert.equal(live.deployMarker, "NEX-DEPLOY-TEST");
assert.equal(live.serverBootId, "boot-1");

runtime.__NEX_SHUTTING_DOWN = true;
const closing = nexDeployStatus();
assert.equal(closing.ok, false);
assert.equal(closing.ready, false);
assert.equal(closing.shuttingDown, true);
assert.equal(closing.deployMarker, "NEX-DEPLOY-TEST");

restore();
console.log("nex-deploy.test.ts ok");
