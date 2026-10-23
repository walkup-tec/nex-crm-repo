import assert from "node:assert/strict";
import { dashboardRequestDropped, readDashboardSnapshot, retryDroppedDashboard, writeDashboardSnapshot, type DashboardStorage } from "./dashboard-cache";

assert.equal(dashboardRequestDropped(new Error("Failed to fetch")), true);
assert.equal(dashboardRequestDropped(new Error("A conta não existe.")), false);

const storage = new Map<string, string>();
const memory: DashboardStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
};
const accept = (value: unknown): value is { name: string } => Boolean(value) && typeof value === "object" && typeof (value as { name?: unknown }).name === "string";
writeDashboardSnapshot(memory, "nex.dashboard.sample", { name: "NEX Agência" });
assert.deepEqual(readDashboardSnapshot(memory, "nex.dashboard.sample", accept), { name: "NEX Agência" });
writeDashboardSnapshot(memory, "nex.dashboard.bad", { name: 1 });
assert.equal(readDashboardSnapshot(memory, "nex.dashboard.bad", accept), null);

let calls = 0;
const recovered = await retryDroppedDashboard(async () => {
  calls += 1;
  if (calls === 1) throw new Error("Failed to fetch");
  return "ok";
});
assert.equal(recovered, "ok");
assert.equal(calls, 2);

await assert.rejects(
  () => retryDroppedDashboard(async () => {
    throw new Error("A conta não existe.");
  }),
  /não existe/,
);
