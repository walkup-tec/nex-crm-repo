import assert from "node:assert/strict";
import { asaasSyncMonitor, financeMonitorCaption } from "./finance-access";

assert.equal(
  financeMonitorCaption({ id: "asaas", label: "Integração Asaas", ok: true, detail: "OK" }),
  "Integração Asaas OK",
);
assert.equal(
  financeMonitorCaption({ id: "asaas", label: "Integração Asaas", ok: false, detail: "chave recusada" }),
  "Integração Asaas: chave recusada",
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

console.log("finance-monitor ok");
