import assert from "node:assert/strict";
import {
  asaasSyncMonitor,
  coraChargeStatus,
  financeMonitorCaption,
  financeMonitorGroups,
} from "./finance-access";

assert.equal(
  financeMonitorCaption({ id: "asaas", label: "Integração", ok: true, detail: "OK" }),
  "Integração OK",
);
assert.equal(
  financeMonitorCaption({ id: "asaas", label: "Integração", ok: false, detail: "chave recusada" }),
  "Integração: chave recusada",
);

assert.deepEqual(asaasSyncMonitor("", true), { ok: true, detail: "OK" });
assert.deepEqual(asaasSyncMonitor("Nenhum contrato integrado ao Asaas.", true), { ok: true, detail: "OK" });
assert.deepEqual(asaasSyncMonitor("A chave do Asaas foi recusada.", false), {
  ok: false,
  detail: "chave recusada",
});
assert.deepEqual(asaasSyncMonitor("Não foi possível consultar o Asaas agora.", true), {
  ok: false,
  detail: "falhou",
});

assert.equal(coraChargeStatus("PAID", "2026-10-01", "2026-11-02"), "paid");
assert.equal(coraChargeStatus("CANCELLED", "2026-10-01", "2026-11-02"), "cancelled");
assert.equal(coraChargeStatus("OPEN", "2026-10-01", "2026-11-02"), "overdue");
assert.equal(coraChargeStatus("OPEN", "2026-11-10", "2026-11-02"), "pending");
assert.equal(coraChargeStatus("LATE", "2026-11-10", "2026-11-02"), "overdue");

const groups = financeMonitorGroups([
  { id: "asaas", label: "Integração", ok: false, detail: "chave recusada" },
  { id: "cora", label: "Integração", ok: true, detail: "OK" },
  { id: "asaas_sync", label: "Cobranças", ok: false, detail: "chave recusada" },
  { id: "cora_sync", label: "Cobranças", ok: true, detail: "OK" },
]);
assert.deepEqual(
  groups.map((group) => ({ label: group.label, ids: group.items.map((item) => item.id) })),
  [
    { label: "Cora", ids: ["cora", "cora_sync"] },
    { label: "Asaas", ids: ["asaas", "asaas_sync"] },
  ],
);

console.log("finance-monitor ok");
