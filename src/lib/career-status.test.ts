import assert from "node:assert/strict";
import {
  careerActorLabel,
  careerKindLabel,
  careerStatusLabel,
  careerStatusTone,
} from "./career-status";

assert.equal(careerStatusLabel("new"), "Nova");
assert.equal(careerStatusLabel("prepared"), "Preparada");
assert.equal(careerStatusLabel("approved"), "Aprovada");
assert.equal(careerStatusLabel("completed"), "Concluída");
assert.equal(careerStatusLabel("ready"), "Pronta");

assert.equal(careerStatusTone("new"), "yellow");
assert.equal(careerStatusTone("ready"), "yellow");
assert.equal(careerStatusTone("approved"), "green");
assert.equal(careerStatusTone("prepared"), "green");
assert.equal(careerStatusTone("completed"), "green");
assert.equal(careerStatusTone("error"), "red");
assert.equal(careerStatusTone("archived"), "red");

assert.equal(careerKindLabel("companies_discover"), "Descoberta de empresas");
assert.equal(careerKindLabel("jobs_search"), "Busca de vagas");
assert.equal(careerKindLabel("application_prepare"), "Preparação de candidatura");
assert.equal(careerKindLabel("application_send"), "Envio de candidatura");
assert.equal(careerStatusLabel("sent"), "Enviada");
assert.equal(careerStatusTone("sent"), "green");
assert.equal(careerActorLabel("plugin"), "Plugin");

console.log("career-status.test.ts: ok");
