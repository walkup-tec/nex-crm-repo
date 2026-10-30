import assert from "node:assert/strict";
import { masterDashboardFrom, normalizeUf, previousBounds, resolveDashboardPeriod, type DashboardClient } from "./master-dashboard";

assert.equal(normalizeUf("sp"), "SP");
assert.equal(normalizeUf("São Paulo"), null);
assert.deepEqual(previousBounds({ start: "2026-10-01", end: "2026-10-31" }), {
  start: "2026-09-01",
  end: "2026-09-30",
});

const period = resolveDashboardPeriod({ mode: "custom", since: "2026-10-01", until: "2026-10-31" }, "2026-10-30");
assert.equal(period.mode, "custom");

const clients: DashboardClient[] = [
  {
    id: "1",
    legalName: "Almeida Cred",
    commercialName: "Almeida Cred",
    status: "active",
    createdAt: "2026-10-05T12:00:00.000Z",
    startsOn: "2026-01-01",
    endsOn: "2026-12-31",
    state: "SP",
    invoices: [
      { competence: "2026-10-01", dueDate: "2026-10-10", totalCents: 500000, status: "paid", paidAt: "2026-10-09T12:00:00.000Z" },
      { competence: "2026-11-01", dueDate: "2026-11-10", totalCents: 500000, status: "pending", paidAt: null },
    ],
  },
  {
    id: "2",
    legalName: "Sul Financeira",
    status: "overdue",
    createdAt: "2026-09-01T12:00:00.000Z",
    startsOn: "2026-09-01",
    endsOn: null,
    state: "RS",
    invoices: [
      { competence: "2026-10-01", dueDate: "2026-10-05", totalCents: 200000, status: "overdue", paidAt: null },
    ],
  },
  {
    id: "3",
    legalName: "Inativa Norte",
    status: "disabled",
    createdAt: "2025-01-01T12:00:00.000Z",
    startsOn: "2025-01-01",
    endsOn: "2025-12-31",
    state: "AM",
    invoices: [],
  },
];

const snap = masterDashboardFrom(clients, { mode: "custom", since: "2026-10-01", until: "2026-10-31" }, "2026-10-15");
assert.equal(snap.activeClients.value, 2);
assert.equal(snap.newClients.value, 1);
assert.equal(snap.periodRevenue.cents, 700000);
assert.equal(snap.overdueClients.value, 1);
assert.equal(snap.paymentSlices.find((item) => item.key === "paid")?.cents, 500000);
assert.equal(snap.paymentSlices.find((item) => item.key === "overdue")?.cents, 200000);
assert.equal(snap.topClients[0]?.name, "Almeida Cred");
assert.equal(snap.regions.find((item) => item.key === "SE")?.clients, 1);
assert.equal(snap.regions.find((item) => item.key === "S")?.clients, 1);
assert.deepEqual(
  snap.ufs.map((item) => item.uf).sort(),
  ["RS", "SP"],
);
assert.ok(snap.revenueClientsSeries.length === 6);
assert.ok(snap.dueWeeks.length === 4);
assert.equal(snap.statusSlices.find((item) => item.key === "inactive")?.value, 1);
