export type FlowNode = { id: string; label: string; kind: string; content: string };
export type FlowEdge = { source: string; target: string };
export type FlowGraph = { nodes: FlowNode[]; edges: FlowEdge[] };
export type FlowRun = { flowId: string; nodeId: string; status: "waiting" | "delay" | "done"; waitUntil: number; lastAnswer: string };
export type FlowAction =
  | { type: "send"; text: string }
  | { type: "tag"; name: string }
  | { type: "deal"; text: string }
  | { type: "note"; text: string }
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
    if (node.label === "Enviar mensagem" && content) actions.push({ type: "send", text: content });
    if (node.label === "Fazer pergunta" && content) {
      actions.push({ type: "send", text: content });
      return { actions, run: { flowId: flow.id, nodeId: node.id, status: "waiting", waitUntil: 0, lastAnswer } };
    }
    if (node.label === "Salvar resposta no CRM" && lastAnswer) actions.push({ type: "note", text: lastAnswer });
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
