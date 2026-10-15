import assert from "node:assert/strict";
import { chooseFlow, outsideBusinessHours, stepFlow, type FlowGraph, type SavedFlow } from "./chatbot-flow";

const graph: FlowGraph = {
  nodes: [
    { id: "t", label: "Mensagem recebida", kind: "Gatilho", content: "" },
    { id: "m", label: "Enviar mensagem", kind: "Ação", content: "Olá" },
    { id: "q", label: "Fazer pergunta", kind: "Ação", content: "Qual seu nome?" },
    { id: "n", label: "Salvar resposta no CRM", kind: "Ação", content: "" },
    { id: "e", label: "Encerrar fluxo", kind: "Ação", content: "" },
  ],
  edges: [
    { source: "t", target: "m" },
    { source: "m", target: "q" },
    { source: "q", target: "n" },
    { source: "n", target: "e" },
  ],
};
const flow: SavedFlow = { id: "flow", name: "Boas-vindas", graph };

const noon = Date.parse("2026-10-15T15:00:00.000Z");
const night = Date.parse("2026-10-16T00:00:00.000Z");
assert.equal(outsideBusinessHours(noon), false);
assert.equal(outsideBusinessHours(night), true);
assert.equal(outsideBusinessHours(Date.parse("2026-10-17T15:00:00.000Z")), true);

const started = stepFlow(flow, null, { text: "oi", at: noon, outsideHours: false });
assert.deepEqual(started.actions.map((item) => item.type), ["send", "send"]);
assert.equal(started.run?.status, "waiting");

const answered = stepFlow(flow, started.run, { text: "Marcelo", at: noon + 1000, outsideHours: false });
assert.deepEqual(answered.actions, [
  { type: "note", text: "Marcelo" },
  { type: "pause" },
]);
assert.equal(answered.run?.status, "done");

const again = stepFlow(flow, answered.run, { text: "de novo", at: noon + 2000, outsideHours: false });
assert.deepEqual(again.actions, []);

const keyword: SavedFlow = {
  id: "key",
  name: "Preço",
  graph: {
    nodes: [
      { id: "k", label: "Palavra-chave", kind: "Gatilho", content: "preço, valor" },
      { id: "s", label: "Enviar mensagem", kind: "Ação", content: "Nosso plano começa em R$ 99." },
    ],
    edges: [{ source: "k", target: "s" }],
  },
};
assert.equal(chooseFlow([flow, keyword], { text: "qual o preço?", outsideHours: false, run: null })?.id, "key");
const priced = stepFlow(keyword, null, { text: "qual o preço?", at: noon, outsideHours: false });
assert.equal(priced.actions[0]?.type, "send");

const closed: SavedFlow = {
  id: "closed",
  name: "Fora",
  graph: {
    nodes: [
      { id: "h", label: "Fora do expediente", kind: "Gatilho", content: "" },
      { id: "s", label: "Enviar mensagem", kind: "Ação", content: "Voltamos no horário comercial." },
    ],
    edges: [{ source: "h", target: "s" }],
  },
};
assert.equal(chooseFlow([flow, closed], { text: "oi", outsideHours: true, run: null })?.id, "closed");
assert.equal(chooseFlow([flow, closed], { text: "oi", outsideHours: false, run: null })?.id, "flow");
