import assert from "node:assert/strict";
import { chooseFlow, crmSaveField, flowMedia, flowMediaLabel, outsideBusinessHours, stepFlow, type FlowGraph, type SavedFlow } from "./chatbot-flow";
import { applyMask, documentDigits, rgDigits } from "./masks";

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
assert.equal(crmSaveField(""), "note");
assert.equal(crmSaveField("name"), "name");
assert.equal(crmSaveField("phone"), "phone");
assert.equal(crmSaveField("document"), "document");
assert.equal(crmSaveField("rg"), "rg");
assert.equal(crmSaveField("deal"), "note");
assert.equal(crmSaveField("outro"), "note");
assert.equal(applyMask("doc", "12345678901"), "123.456.789-01");
assert.equal(applyMask("doc", "12345678000199"), "12.345.678/0001-99");
assert.equal(applyMask("phone", "11999998888"), "(11) 99999-8888");
assert.equal(applyMask("rg", "123456789"), "12.345.678-9");
assert.equal(applyMask("rg", "12345678x"), "12.345.678-X");
assert.equal(documentDigits("123.456.789-01"), "12345678901");
assert.equal(documentDigits("123"), "");
assert.equal(rgDigits("12.345.678-9"), "123456789");
assert.equal(rgDigits("12.345.678-X"), "12345678X");
assert.equal(rgDigits("123"), "");
assert.deepEqual(answered.actions, [
  { type: "save", field: "note", text: "Marcelo" },
  { type: "pause" },
]);
assert.equal(answered.run?.status, "done");
const namedGraph: FlowGraph = {
  nodes: [
    { id: "t", label: "Mensagem recebida", kind: "Gatilho", content: "" },
    { id: "q", label: "Fazer pergunta", kind: "Ação", content: "Qual seu nome?" },
    { id: "n", label: "Salvar resposta no CRM", kind: "Ação", content: "name" },
  ],
  edges: [
    { source: "t", target: "q" },
    { source: "q", target: "n" },
  ],
};
const asked = stepFlow({ id: "nome", name: "Nome", graph: namedGraph }, null, { text: "oi", at: noon, outsideHours: false });
const savedName = stepFlow({ id: "nome", name: "Nome", graph: namedGraph }, asked.run, { text: "Marina", at: noon + 1000, outsideHours: false });
assert.deepEqual(savedName.actions[0], { type: "save", field: "name", text: "Marina" });

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

const photo = { kind: "image" as const, name: "foto.jpg", mime: "image/jpeg", path: "11111111-1111-4111-8111-111111111111/flows/22222222-2222-4222-8222-222222222222.jpg" };
const mediaFlow: SavedFlow = {
  id: "midia",
  name: "Mídia",
  graph: {
    nodes: [
      { id: "t", label: "Mensagem recebida", kind: "Gatilho", content: "" },
      { id: "s", label: "Enviar mensagem", kind: "Ação", content: "Veja o material", media: photo },
      { id: "a", label: "Enviar mensagem", kind: "Ação", content: "", media: { ...photo, kind: "audio", mime: "audio/ogg", name: "recado.ogg", path: photo.path.replace(".jpg", ".ogg") } },
    ],
    edges: [
      { source: "t", target: "s" },
      { source: "s", target: "a" },
    ],
  },
};
const sentMedia = stepFlow(mediaFlow, null, { text: "oi", at: noon, outsideHours: false });
assert.equal(sentMedia.actions[0]?.type, "send");
assert.equal(sentMedia.actions[0]?.type === "send" ? sentMedia.actions[0].media?.kind : "", "image");
assert.equal(sentMedia.actions[0]?.type === "send" ? sentMedia.actions[0].text : "", "Veja o material");
assert.equal(sentMedia.actions[1]?.type === "send" ? sentMedia.actions[1].media?.kind : "", "audio");
assert.equal(flowMedia(photo)?.kind, "image");
assert.equal(flowMedia({ ...photo, path: "../segredo.jpg" }), null);
assert.equal(flowMediaLabel("video"), "Vídeo");
assert.equal(flowMediaLabel("audio"), "Áudio");
