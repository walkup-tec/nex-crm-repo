import assert from "node:assert/strict";
import { chooseFlow, clientFlowVariableTokens, cloneFlowSelection, crmSaveField, fillFlowVariables, flowDropPosition, flowMedia, flowMediaLabel, flowMenuButtonText,
  flowMenuOptions, insertFlowVariable, businessHours, outsideBusinessHours, previewFlowTurns, stepFlow, waitMilliseconds, waitSetting, type FlowGraph, type SavedFlow } from "./chatbot-flow";
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
const saturdayOpen = businessHours({
  timeZone: "America/Sao_Paulo",
  days: [
    { open: true, start: "09:00", end: "18:00" },
    { open: true, start: "09:00", end: "18:00" },
    { open: true, start: "09:00", end: "18:00" },
    { open: true, start: "09:00", end: "18:00" },
    { open: true, start: "09:00", end: "18:00" },
    { open: true, start: "10:00", end: "14:00" },
    { open: false, start: "09:00", end: "18:00" },
  ],
});
assert.equal(outsideBusinessHours(Date.parse("2026-10-17T15:00:00.000Z"), saturdayOpen), false);
assert.equal(outsideBusinessHours(Date.parse("2026-10-17T18:00:00.000Z"), saturdayOpen), true);

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
assert.deepEqual(clientFlowVariableTokens({ document: false, rg: true }), ["Nome", "WhatsApp", "RG"]);
assert.equal(insertFlowVariable("Olá", "Nome"), "Olá {{Nome}}");
assert.equal(fillFlowVariables("Olá {{Nome}}, seu WhatsApp é {{whatsapp}}.", { Nome: "Ana", WhatsApp: "(11) 99999-8888" }), "Olá Ana, seu WhatsApp é (11) 99999-8888.");
assert.equal(fillFlowVariables("Documento {{CPF/CNPJ}}", { Nome: "Ana" }), "Documento {{CPF/CNPJ}}");
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
const askedKnownName = stepFlow({ id: "nome", name: "Nome", graph: namedGraph }, null, { text: "Marcelo Mozart", at: noon, outsideHours: false });
assert.equal(askedKnownName.run?.status, "waiting");
assert.equal(askedKnownName.actions.some((action) => action.type === "save"), false);
const keptWaiting = stepFlow({ id: "nome", name: "Nome", graph: namedGraph }, askedKnownName.run, { text: "", at: noon + 500, outsideHours: false });
assert.equal(keptWaiting.run?.status, "waiting");
assert.equal(keptWaiting.actions.length, 0);
const answeredKnown = stepFlow({ id: "nome", name: "Nome", graph: namedGraph }, askedKnownName.run, { text: "Ana", at: noon + 1000, outsideHours: false });
assert.deepEqual(answeredKnown.actions[0], { type: "save", field: "name", text: "Ana" });

const again = stepFlow(flow, answered.run, { text: "de novo", at: noon + 2000, outsideHours: false });
assert.deepEqual(again.actions, []);
assert.equal(chooseFlow([flow], { text: "de novo", outsideHours: false, run: answered.run })?.id, "flow");
assert.equal(chooseFlow([flow], { text: "oi", outsideHours: false, run: { flowId: "antigo", nodeId: "x", status: "waiting", waitUntil: 0, lastAnswer: "" } })?.id, "flow");
const restarted = stepFlow(flow, null, { text: "de novo", at: noon + 2000, outsideHours: false });
assert.equal(chooseFlow([flow], { text: "de novo", outsideHours: false, run: null })?.id, "flow");
assert.equal(restarted.actions[0]?.type, "send");

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
const manual: SavedFlow = { ...keyword, id: "manual", name: "Envio", launch: "manual" };
assert.equal(chooseFlow([manual], { text: "qual o preço?", outsideHours: false, run: null }), null);
assert.equal(chooseFlow([manual], { text: "", outsideHours: false, run: null, manualFlowId: "manual" })?.id, "manual");
assert.equal(chooseFlow([manual], { text: "ok", outsideHours: false, run: { flowId: "manual", nodeId: "s", status: "waiting", waitUntil: 0, lastAnswer: "" } })?.id, "manual");
const queued = previewFlowTurns({ nodes: [{ id: "t", label: "Mensagem recebida", kind: "Gatilho", content: "" }, { id: "q", label: "Encaminhar à fila", kind: "Ação", content: "" }], edges: [{ source: "t", target: "q" }] }, ["oi"], false, noon);
assert.equal(queued.turns.find((turn) => turn.from === "bot")?.text, "Conversa enviada para a fila de atendimento do Chatbot.");
const priced = stepFlow(keyword, null, { text: "qual o preço?", at: noon, outsideHours: false });
assert.equal(priced.actions[0]?.type, "send");

const hoursFlow: SavedFlow = {
  id: "hours",
  name: "Expediente",
  graph: {
    nodes: [
      { id: "h", label: "Fora do expediente", kind: "Gatilho", content: "" },
      { id: "yes", label: "Enviar mensagem", kind: "Ação", content: "Estamos fechados." },
      { id: "no", label: "Enviar mensagem", kind: "Ação", content: "Estamos abertos." },
    ],
    edges: [
      { source: "h", target: "yes", sourceHandle: "sim" },
      { source: "h", target: "no", sourceHandle: "nao" },
    ],
  },
};
assert.equal(chooseFlow([flow, hoursFlow], { text: "oi", outsideHours: true, run: null })?.id, "flow");
const closedPath = stepFlow(hoursFlow, null, { text: "oi", at: night, outsideHours: true });
assert.equal(closedPath.actions[0]?.type === "send" ? closedPath.actions[0].text : "", "Estamos fechados.");
const openPath = stepFlow(hoursFlow, null, { text: "oi", at: noon, outsideHours: false });
assert.equal(openPath.actions[0]?.type === "send" ? openPath.actions[0].text : "", "Estamos abertos.");
const closedPreview = previewFlowTurns(hoursFlow.graph, ["oi"], true, night);
assert.equal(closedPreview.turns.find((turn) => turn.from === "bot")?.text, "Estamos fechados.");
const openPreview = previewFlowTurns(hoursFlow.graph, ["oi"], false, noon);
assert.equal(openPreview.turns.find((turn) => turn.from === "bot")?.text, "Estamos abertos.");
assert.equal(openPreview.finished, true);

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

const menuFlow: SavedFlow = {
  id: "menu",
  name: "Menu",
  graph: {
    nodes: [
      { id: "t", label: "Mensagem recebida", kind: "Gatilho", content: "" },
      { id: "menu", label: "Menu", kind: "Ação", content: "Como posso ajudar?", options: [{ id: "1", label: "Vendas" }, { id: "2", label: "Suporte" }] },
      { id: "a", label: "Enviar mensagem", kind: "Ação", content: "Time de vendas." },
      { id: "b", label: "Enviar mensagem", kind: "Ação", content: "Time de suporte." },
    ],
    edges: [
      { source: "t", target: "menu" },
      { source: "menu", target: "a", sourceHandle: "1" },
      { source: "menu", target: "b", sourceHandle: "2" },
    ],
  },
};
const menuStep = stepFlow(menuFlow, null, { text: "oi", at: noon, outsideHours: false });
assert.equal(menuStep.actions[0]?.type, "menu");
assert.equal(menuStep.run?.status, "waiting");
const sales = stepFlow(menuFlow, menuStep.run, { text: "Vendas", at: noon, outsideHours: false });
assert.equal(sales.actions[0]?.type === "send" ? sales.actions[0].text : "", "Time de vendas.");
const support = stepFlow(menuFlow, menuStep.run, { text: "2", at: noon, outsideHours: false });
assert.equal(support.actions[0]?.type === "send" ? support.actions[0].text : "", "Time de suporte.");
const ignored = stepFlow(menuFlow, menuStep.run, { text: "outra", at: noon, outsideHours: false });
assert.equal(ignored.run?.nodeId, "menu");
assert.equal(ignored.actions.length, 0);
const duplicated = cloneFlowSelection(
  [{ id: "a", x: 10, y: 20 }, { id: "b", x: 40, y: 20 }, { id: "c", x: 80, y: 20 }],
  [{ id: "ab", source: "a", target: "b", sourceHandle: "1" as const }, { id: "bc", source: "b", target: "c" }],
  ["a", "b"],
  (() => { let n = 0; return () => `n${(n += 1)}`; })(),
);
assert.deepEqual(duplicated.nodes.map((node) => [node.id, node.x, node.y]), [["n1", 58, 68], ["n2", 88, 68]]);
assert.deepEqual(duplicated.edges, [{ id: "n3", source: "n1", target: "n2", sourceHandle: "1" }]);
assert.deepEqual(flowDropPosition({ x: 10, y: 20 }, [{ x: 10, y: 20 }]), { x: 38, y: 48 });
assert.deepEqual(flowDropPosition({ x: 200, y: 80 }, []), { x: 200, y: 80 });
assert.equal(flowMenuOptions([{ id: "1", label: "  Vendas  " }, { id: "4", label: "Fora" }]).map((option) => option.label).join(","), "Vendas");
const menuButton = flowMenuButtonText("  Você já fez anúncio?  ");
assert.equal(menuButton.title, "Você já fez anúncio?");
assert.equal(menuButton.title.includes("*"), false);
assert.equal(menuButton.description, "\u00a0");
assert.deepEqual(waitSetting("5"), { amount: 5, unit: "minutos" });
assert.deepEqual(waitSetting("30 segundos"), { amount: 30, unit: "segundos" });
assert.deepEqual(waitSetting("2 horas"), { amount: 2, unit: "horas" });
assert.equal(waitMilliseconds("30 segundos"), 30_000);
assert.equal(waitMilliseconds("2 horas"), 7_200_000);
assert.equal(waitMilliseconds(""), 60_000);
const waitFlow: SavedFlow = {
  id: "espera",
  name: "Espera",
  graph: {
    nodes: [
      { id: "t", label: "Mensagem recebida", kind: "Gatilho", content: "" },
      { id: "w", label: "Tempo de espera", kind: "Lógica", content: "45 segundos" },
    ],
    edges: [{ source: "t", target: "w" }],
  },
};
const waited = stepFlow(waitFlow, null, { text: "oi", at: noon, outsideHours: false });
assert.equal(waited.run?.status, "delay");
assert.equal(waited.run?.waitUntil, noon + 45_000);
assert.equal(previewFlowTurns(waitFlow.graph, ["oi"], false, noon).turns.find((turn) => turn.from === "bot")?.text, "Aguarda 45 s antes de continuar.");
