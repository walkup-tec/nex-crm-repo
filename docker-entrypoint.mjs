import http from "node:http";
import { randomUUID } from "node:crypto";

const NEX_DEPLOY = "NEX-DEPLOY-BOTFLOW";
const SHUTDOWN_GRACE_MS = 20000;
const servers = new Set();

globalThis.__NEX_DEPLOY = NEX_DEPLOY;
globalThis.__NEX_BOOT_ID = randomUUID();
globalThis.__NEX_SHUTTING_DOWN = false;
console.log(NEX_DEPLOY);

function beginShutdown(signal) {
  if (globalThis.__NEX_SHUTTING_DOWN) return;
  globalThis.__NEX_SHUTTING_DOWN = true;
  console.log(`[shutdown] ${signal} — Nex em atualização. O sistema segue respondendo e /health avisa a tela.`);
  setTimeout(() => {
    for (const server of servers) server.close(() => {});
    setTimeout(() => process.exit(0), 1000).unref();
  }, SHUTDOWN_GRACE_MS - 1000).unref();
  setTimeout(() => {
    console.warn("[shutdown] tempo esgotado — encerramento forçado.");
    process.exit(1);
  }, SHUTDOWN_GRACE_MS).unref();
}

process.once("SIGTERM", () => beginShutdown("SIGTERM"));
process.once("SIGINT", () => beginShutdown("SIGINT"));

const listen = http.Server.prototype.listen;
const metaBalanceProbeOnly = process.argv.includes("--meta-balance-probe");
const transactionsDiagnoseOnly = process.argv.includes("--meta-transactions-diagnose");
const manualReadOnly = metaBalanceProbeOnly || transactionsDiagnoseOnly;

http.Server.prototype.listen = function (options, ...args) {
  if (manualReadOnly) return this;
  servers.add(this);
  this.once("close", () => servers.delete(this));
  if (options && typeof options === "object") {
    options.host = "0.0.0.0";
  }
  this.once("listening", () => {
    console.log(`NEX escutando ${JSON.stringify(this.address())}`);
  });
  return listen.call(this, options, ...args);
};

if (manualReadOnly) {
  try {
    await import("./.output/server/_ssr/ssr.mjs");
  } catch {
    const label = transactionsDiagnoseOnly ? "meta_transactions_diagnose" : "meta_balance_probe";
    console.info(`${label} {"account":"886574174420761","failed":"read"}`);
    process.exit(1);
  }
  await new Promise(() => {});
}
