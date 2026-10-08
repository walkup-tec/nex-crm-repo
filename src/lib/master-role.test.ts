import assert from "node:assert/strict";
import { clientNavPaths, decideMaster, masterFromReads, type RoleRead } from "./master-role";

const clientPaths = [
  "/dashboard",
  "/campanhas",
  "/creditos-meta",
  "/financeiro",
  "/criativos",
  "/usuarios",
  "/minha-conta",
];

const empty: RoleRead = { roles: [], error: false };
const failed: RoleRead = { roles: null, error: true };
const master: RoleRead = { roles: ["master"], error: false };
const admin: RoleRead = { roles: ["client_admin"], error: false };

assert.equal(decideMaster(empty, 0), "retry");
assert.equal(decideMaster(failed, 0), "retry");
assert.equal(decideMaster(failed, 3), "client");
assert.equal(decideMaster(admin, 0), "client");
assert.equal(decideMaster(master, 2), "master");

assert.equal(masterFromReads([master]), true);
assert.equal(masterFromReads([admin, master]), false);
assert.equal(masterFromReads([empty, failed, master]), true);
assert.equal(masterFromReads([failed, empty, empty, admin]), false);
assert.equal(masterFromReads([empty, empty, empty, empty]), false);
assert.equal(masterFromReads([failed, failed, failed, failed]), false);
assert.equal(masterFromReads([{ roles: ["client_user", "master"], error: false }]), true);

assert.deepEqual(clientNavPaths(clientPaths, false), clientPaths);
assert.deepEqual(clientNavPaths(clientPaths, true), [
  "/dashboard",
  "/master/clientes",
  ...clientPaths.slice(1),
]);
assert.deepEqual(clientNavPaths(["/dashboard", "/master/clientes", "/campanhas"], true), [
  "/dashboard",
  "/master/clientes",
  "/campanhas",
]);

console.log("master-role ok");
