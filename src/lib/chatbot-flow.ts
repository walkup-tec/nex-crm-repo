export type FlowMediaKind = "image" | "video" | "audio";
export type FlowMedia = { kind: FlowMediaKind; name: string; mime: string; path: string };
export type FlowNode = { id: string; label: string; kind: string; content: string; media?: FlowMedia };

const flowMediaMimes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/3gpp",
  "audio/ogg",
  "audio/mpeg",
  "audio/mp4",
  "audio/webm",
  "audio/aac",
  "audio/opus",
  "audio/wav",
]);

export function flowMedia(value: unknown): FlowMedia | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const kind = row["kind"];
  const name = typeof row["name"] === "string" ? row["name"].replace(/[^\w.\- ()]+/g, "").trim().slice(0, 80) : "";
  const mime = typeof row["mime"] === "string" ? row["mime"].split(";")[0]?.trim().toLowerCase() ?? "" : "";
  const path = typeof row["path"] === "string" ? row["path"].trim() : "";
  if (kind !== "image" && kind !== "video" && kind !== "audio") return null;
  if (!name || !flowMediaMimes.has(mime) || !mime.startsWith(`${kind}/`)) return null;
  if (!/^[0-9a-f-]{36}\/flows\/[0-9a-f-]{36}\.[a-z0-9]+$/i.test(path)) return null;
  return { kind, name, mime, path };
}

export function flowMediaLabel(kind: FlowMediaKind) {
  if (kind === "video") return "Vídeo";
  if (kind === "audio") return "Áudio";
  return "Imagem";
}
export type FlowEdge = { source: string; target: string };
export type FlowGraph = { nodes: FlowNode[]; edges: FlowEdge[] };
export type FlowRun = { flowId: string; nodeId: string; status: "waiting" | "delay" | "done"; waitUntil: number; lastAnswer: string };
export const crmSaveFields = [
  { id: "note", label: "Observação" },
  { id: "name", label: "Nome" },
  { id: "phone", label: "WhatsApp" },
  { id: "document", label: "CPF/CNPJ" },
  { id: "rg", label: "RG" },
] as const;

export type CrmSaveField = (typeof crmSaveFields)[number]["id"];

export function crmSaveField(content: string): CrmSaveField {
  const found = crmSaveFields.find((field) => field.id === content.trim());
  return found?.id ?? "note";
}

export function crmSaveLabel(content: string) {
  const id = crmSaveField(content);
  return crmSaveFields.find((field) => field.id === id)?.label ?? "Observação";
}

export type FlowAction =
  | { type: "send"; text: string; media?: FlowMedia }
  | { type: "tag"; name: string }
  | { type: "deal"; text: string }
  | { type: "save"; field: CrmSaveField; text: string }
  | { type: "queue" }
  | { type: "pause" };
export type FlowStep = { actions: FlowAction[]; run: FlowRun | null };
export type SavedFlow = { id: string; name: string; graph: FlowGraph };

const emptyStep: FlowStep = { actions: [], run: null };

export function outsideBusinessHours(at: number, timeZone = "America/Sao_Paulo") {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(at));
  const weekday = parts.find((part) => part.type === "weekday")?.value ?? "";
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
  if (weekday === "Sat" || weekday === "Sun") return true;
  const clock = hour * 60 + minute;
  return clock < 9 * 60 || clock >= 18 * 60;
}

function terms(content: string) {
  return content
    .split(/[,\n]/)
    .map((item) => item.trim().toLocaleLowerCase("pt-BR"))
    .filter((item) => item.length >= 2);
}

function includesTerm(text: string, content: string) {
  const haystack = text.trim().toLocaleLowerCase("pt-BR");
  const needles = terms(content);
  if (!haystack || !needles.length) return false;
  return needles.some((needle) => haystack.includes(needle));
}

function waitMinutes(content: string) {
  const value = Number(content.match(/\d+/)?.[0] ?? "1");
  if (!Number.isFinite(value)) return 1;
  return Math.min(1440, Math.max(1, Math.trunc(value)));
}

function outgoing(graph: FlowGraph, id: string) {
  return graph.edges.filter((edge) => edge.source === id).map((edge) => edge.target);
}

function nodeById(graph: FlowGraph, id: string) {
  return graph.nodes.find((node) => node.id === id);
}

function triggers(graph: FlowGraph) {
  return graph.nodes.filter((node) => node.kind === "Gatilho");
}

function doneRun(flowId: string, nodeId: string, lastAnswer: string): FlowRun {
  return { flowId, nodeId, status: "done", waitUntil: 0, lastAnswer };
}

export function chooseFlow(flows: SavedFlow[], input: { text: string; outsideHours: boolean; run: FlowRun | null; manualFlowId?: string }) {
  if (input.manualFlowId) return flows.find((flow) => flow.id === input.manualFlowId) ?? null;
  if (input.run && input.run.status !== "done") return flows.find((flow) => flow.id === input.run?.flowId) ?? null;
  const keyword = flows.find((flow) =>
    triggers(flow.graph).some((node) => node.label === "Palavra-chave" && includesTerm(input.text, node.content)),
  );
  if (keyword && (!input.run || includesTerm(input.text, triggers(keyword.graph).find((node) => node.label === "Palavra-chave")?.content ?? ""))) return keyword;
  if (input.run?.status === "done") return null;
  if (input.outsideHours) {
    const closed = flows.find((flow) => triggers(flow.graph).some((node) => node.label === "Fora do expediente"));
    if (closed) return closed;
  }
  return flows.find((flow) => triggers(flow.graph).some((node) => node.label === "Mensagem recebida")) ?? null;
}

function startNode(graph: FlowGraph, input: { text: string; outsideHours: boolean; manual: boolean }) {
  const roots = triggers(graph);
  if (input.manual) return roots[0];
  const keyword = roots.find((node) => node.label === "Palavra-chave" && includesTerm(input.text, node.content));
  if (keyword) return keyword;
  if (input.outsideHours) {
    const closed = roots.find((node) => node.label === "Fora do expediente");
    if (closed) return closed;
  }
  return roots.find((node) => node.label === "Mensagem recebida");
}

export function stepFlow(flow: SavedFlow, run: FlowRun | null, input: { text: string; at: number; outsideHours: boolean; manual?: boolean }): FlowStep {
  const manual = input.manual === true;
  if (run && run.flowId === flow.id && run.status === "delay") {
    if (input.at < run.waitUntil) return { actions: [], run };
    return walk(flow, outgoing(flow.graph, run.nodeId), run.lastAnswer, input);
  }
  if (run && run.flowId === flow.id && run.status === "waiting" && !manual) {
    return walk(flow, outgoing(flow.graph, run.nodeId), input.text.trim(), input);
  }
  if (run?.status === "done" && !manual) {
    const keyword = triggers(flow.graph).find((node) => node.label === "Palavra-chave" && includesTerm(input.text, node.content));
    if (!keyword) return { actions: [], run };
    return walk(flow, outgoing(flow.graph, keyword.id), input.text.trim() || run.lastAnswer, input);
  }
  const trigger = startNode(flow.graph, { text: input.text, outsideHours: input.outsideHours, manual });
  if (!trigger) return emptyStep;
  return walk(flow, outgoing(flow.graph, trigger.id), "", input);
}

function walk(flow: SavedFlow, start: string[], lastAnswer: string, input: { text: string; at: number }): FlowStep {
  const actions: FlowAction[] = [];
  const pending = [...start];
  const seen = new Set<string>();
  while (pending.length) {
    const id = pending.shift();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const node = nodeById(flow.graph, id);
    if (!node) continue;
    const content = node.content.trim();
    if (node.label === "Enviar mensagem") {
      const media = flowMedia(node.media);
      if (content || media) actions.push(media ? { type: "send", text: content, media } : { type: "send", text: content });
    }
    if (node.label === "Fazer pergunta" && content) {
      actions.push({ type: "send", text: content });
      return { actions, run: { flowId: flow.id, nodeId: node.id, status: "waiting", waitUntil: 0, lastAnswer } };
    }
    if (node.label === "Salvar resposta no CRM" && lastAnswer) actions.push({ type: "save", field: crmSaveField(content), text: lastAnswer });
    if (node.label === "Adicionar etiqueta" && content) actions.push({ type: "tag", name: content });
    if (node.label === "Criar oportunidade" && content) actions.push({ type: "deal", text: content });
    if (node.label === "Encaminhar à fila") {
      actions.push({ type: "queue" });
      return { actions, run: doneRun(flow.id, node.id, lastAnswer) };
    }
    if (node.label === "Encerrar fluxo") {
      actions.push({ type: "pause" });
      return { actions, run: doneRun(flow.id, node.id, lastAnswer) };
    }
    if (node.label === "Tempo de espera") {
      return {
        actions,
        run: { flowId: flow.id, nodeId: node.id, status: "delay", waitUntil: input.at + waitMinutes(content) * 60_000, lastAnswer },
      };
    }
    if (node.label === "Condição se / senão") {
      const next = outgoing(flow.graph, node.id);
      const matched = content ? includesTerm(lastAnswer || input.text, content) : Boolean((lastAnswer || input.text).trim());
      const target = matched ? next[0] : next[1];
      if (target) pending.unshift(target);
      continue;
    }
    const children = outgoing(flow.graph, node.id);
    for (let index = children.length - 1; index >= 0; index -= 1) pending.unshift(children[index] ?? "");
  }
  if (!actions.length && !start.length) return emptyStep;
  actions.push({ type: "pause" });
  return { actions, run: doneRun(flow.id, start[0] ?? "", lastAnswer) };
}
