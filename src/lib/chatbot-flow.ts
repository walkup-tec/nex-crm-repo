export type FlowMediaKind = "image" | "video" | "audio";
export type FlowMedia = { kind: FlowMediaKind; name: string; mime: string; path: string };
export type FlowMenuOption = { id: "1" | "2" | "3"; label: string };
export type FlowNode = { id: string; label: string; kind: string; content: string; media?: FlowMedia; options?: FlowMenuOption[] };

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
export type FlowHoursHandle = "sim" | "nao";
export type FlowMenuHandle = "1" | "2" | "3";
export type FlowSourceHandle = FlowHoursHandle | FlowMenuHandle;
export type FlowEdge = { source: string; target: string; sourceHandle?: FlowSourceHandle };

export const businessDayNames = ["Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado", "Domingo"] as const;
export type BusinessDay = { open: boolean; start: string; end: string };
export type BusinessHours = { timeZone: string; days: BusinessDay[] };

export function defaultBusinessHours(): BusinessHours {
  return {
    timeZone: "America/Sao_Paulo",
    days: businessDayNames.map((_, index) => ({ open: index < 5, start: "09:00", end: "18:00" })),
  };
}

function clockMinutes(value: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

export function businessHours(value: unknown): BusinessHours {
  const fallback = defaultBusinessHours();
  const row = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const days = Array.isArray(row["days"]) ? row["days"] : [];
  const timeZone = typeof row["timeZone"] === "string" && row["timeZone"].trim() ? row["timeZone"].trim() : fallback.timeZone;
  return {
    timeZone,
    days: fallback.days.map((day, index) => {
      const item = days[index];
      if (!item || typeof item !== "object") return day;
      const record = item as Record<string, unknown>;
      const start = typeof record["start"] === "string" && clockMinutes(record["start"]) != null ? record["start"] : day.start;
      const end = typeof record["end"] === "string" && clockMinutes(record["end"]) != null ? record["end"] : day.end;
      return { open: record["open"] === true, start, end };
    }),
  };
}

export function hoursHandle(value: unknown): FlowHoursHandle | undefined {
  return value === "sim" || value === "nao" ? value : undefined;
}

export function flowSourceHandle(value: unknown): FlowSourceHandle | undefined {
  return hoursHandle(value) ?? (value === "1" || value === "2" || value === "3" ? value : undefined);
}

export function flowMenuOptions(value: unknown): FlowMenuOption[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const options: FlowMenuOption[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const id = row["id"];
    if ((id !== "1" && id !== "2" && id !== "3") || seen.has(id)) continue;
    const label = typeof row["label"] === "string" ? row["label"].trim().slice(0, 20) : "";
    if (!label) continue;
    seen.add(id);
    options.push({ id, label });
  }
  return options;
}

export function nextMenuOptionId(options: { id: string }[] | undefined) {
  return (["1", "2", "3"] as const).find((id) => !options?.some((option) => option.id === id));
}

export function flowMenuButtonText(text: string) {
  const question = text.trim().slice(0, 1024);
  return { title: "", description: question, footer: "" };
}

export function cloneFlowSelection<TNode extends { id: string; x: number; y: number }, TEdge extends { id: string; source: string; target: string }>(
  nodes: TNode[],
  edges: TEdge[],
  selectedIds: string[],
  nextId: () => string,
  offset = 48,
) {
  const picked = new Set(selectedIds);
  const ids = new Map<string, string>();
  const clones = nodes.flatMap((node) => {
    if (!picked.has(node.id)) return [];
    const id = nextId();
    ids.set(node.id, id);
    return [{ ...node, id, x: node.x + offset, y: node.y + offset }];
  });
  const links = edges.flatMap((edge) => {
    const source = ids.get(edge.source);
    const target = ids.get(edge.target);
    if (!source || !target) return [];
    return [{ ...edge, id: nextId(), source, target }];
  });
  return { nodes: clones, edges: links };
}

export function flowDropPosition(point: { x: number; y: number }, existing: { x: number; y: number }[]) {
  let x = point.x;
  let y = point.y;
  for (let step = 0; step < 12 && existing.some((node) => Math.abs(node.x - x) < 24 && Math.abs(node.y - y) < 24); step += 1) {
    x += 28;
    y += 28;
  }
  return { x, y };
}
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

export function clientFlowVariableTokens(flags: { document: boolean; rg: boolean }) {
  return ["Nome", "WhatsApp", ...(flags.document ? ["CPF/CNPJ"] : []), ...(flags.rg ? ["RG"] : [])];
}

export function insertFlowVariable(content: string, token: string) {
  const piece = `{{${token}}}`;
  if (!content) return piece;
  return /\s$/.test(content) ? `${content}${piece}` : `${content} ${piece}`;
}

export function fillFlowVariables(text: string, values: Record<string, string>) {
  const keys = Object.keys(values);
  return text.replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (match, raw: string) => {
    const name = raw.trim().toLocaleLowerCase("pt-BR");
    const key = keys.find((item) => item.toLocaleLowerCase("pt-BR") === name);
    if (!key) return match;
    return values[key] ?? "";
  });
}

export type FlowAction =
  | { type: "send"; text: string; media?: FlowMedia }
  | { type: "menu"; text: string; options: FlowMenuOption[] }
  | { type: "tag"; name: string }
  | { type: "stage"; name: string }
  | { type: "save"; field: CrmSaveField; text: string }
  | { type: "queue" }
  | { type: "pause" };
export type FlowStep = { actions: FlowAction[]; run: FlowRun | null };
export type FlowLaunch = "auto" | "manual";
export type SavedFlow = { id: string; name: string; graph: FlowGraph; launch?: FlowLaunch };

export function flowLaunch(value: unknown): FlowLaunch {
  if (value === "manual") return "manual";
  if (!value || typeof value !== "object") return "auto";
  return (value as Record<string, unknown>)["launch"] === "manual" ? "manual" : "auto";
}

const emptyStep: FlowStep = { actions: [], run: null };

const weekdayIndex: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };

function insideBusinessClock(clock: number, start: number, end: number) {
  const close = end === 0 ? 24 * 60 : end;
  if (close === start) return false;
  if (close > start) return clock >= start && clock < close;
  return clock >= start || clock < close;
}

export function outsideBusinessHours(at: number, hours: BusinessHours = defaultBusinessHours()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: hours.timeZone || "America/Sao_Paulo",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(at));
  const weekday = parts.find((part) => part.type === "weekday")?.value ?? "";
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
  const day = hours.days[weekdayIndex[weekday] ?? -1];
  if (!day?.open) return true;
  const start = clockMinutes(day.start);
  const end = clockMinutes(day.end);
  if (start == null || end == null) return true;
  return !insideBusinessClock(hour * 60 + minute, start, end);
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

export type WaitUnit = "segundos" | "minutos" | "horas";
const waitLimits: Record<WaitUnit, number> = { segundos: 86400, minutos: 1440, horas: 24 };

export function waitSetting(content: string): { amount: number; unit: WaitUnit } {
  const clean = content.trim().toLocaleLowerCase("pt-BR");
  const raw = Number(clean.match(/\d+/)?.[0] ?? "1");
  const unit: WaitUnit = /hora|\d\s*h\b/.test(clean) ? "horas" : /seg|\d\s*s\b/.test(clean) ? "segundos" : "minutos";
  const amount = Number.isFinite(raw) ? Math.min(waitLimits[unit], Math.max(1, Math.trunc(raw))) : 1;
  return { amount, unit };
}

export function waitContent(amount: number, unit: WaitUnit) {
  const setting = waitSetting(`${Number.isFinite(amount) ? amount : 1} ${unit}`);
  return `${setting.amount} ${setting.unit}`;
}

export function waitMilliseconds(content: string) {
  const setting = waitSetting(content);
  if (setting.unit === "segundos") return setting.amount * 1000;
  if (setting.unit === "horas") return setting.amount * 3_600_000;
  return setting.amount * 60_000;
}

export function waitPreviewLabel(content: string) {
  const setting = waitSetting(content);
  const unit = setting.unit === "segundos" ? "s" : setting.unit === "horas" ? "h" : "min";
  return `Aguarda ${setting.amount} ${unit} antes de continuar.`;
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

export function inboundFlowRun(stored: FlowRun | null, hasOutbound: boolean) {
  if (!stored || !hasOutbound || stored.status === "done") return null;
  return stored;
}

export function chooseFlow(flows: SavedFlow[], input: { text: string; outsideHours: boolean; run: FlowRun | null; manualFlowId?: string }) {
  if (input.manualFlowId) return flows.find((flow) => flow.id === input.manualFlowId) ?? null;
  if (input.run && input.run.status !== "done") {
    const current = flows.find((flow) => flow.id === input.run?.flowId);
    if (current) return current;
  }
  const automatic = flows.filter((flow) => flow.launch !== "manual");
  const keyword = automatic.find((flow) =>
    triggers(flow.graph).some((node) => node.label === "Palavra-chave" && includesTerm(input.text, node.content)),
  );
  if (keyword && (!input.run || input.run.status === "done" || includesTerm(input.text, triggers(keyword.graph).find((node) => node.label === "Palavra-chave")?.content ?? ""))) return keyword;
  const received = automatic.find((flow) => triggers(flow.graph).some((node) => node.label === "Mensagem recebida"));
  if (received) return received;
  return automatic.find((flow) => triggers(flow.graph).some((node) => node.label === "Fora do expediente")) ?? null;
}

function hasHoursEdges(graph: FlowGraph, id: string) {
  return graph.edges.some((edge) => edge.source === id && (edge.sourceHandle === "sim" || edge.sourceHandle === "nao"));
}

function inboundRank(flow: SavedFlow) {
  const labels = triggers(flow.graph).map((node) => node.label);
  const hours = labels.includes("Fora do expediente") || triggers(flow.graph).some((node) => hasHoursEdges(flow.graph, node.id));
  const received = labels.includes("Mensagem recebida");
  if (flow.launch !== "manual" && hours) return 0;
  if (flow.launch !== "manual" && received) return 1;
  if (hours) return 2;
  if (received) return 3;
  return 4;
}

function stepSends(step: FlowStep) {
  return step.actions.some((action) => action.type === "send" || action.type === "menu");
}

function freshFlowStep(flow: SavedFlow, input: { text: string; outsideHours: boolean; at: number }) {
  return stepFlow(flow, null, { text: input.text, at: input.at, outsideHours: input.outsideHours });
}

function pickAutomaticFlow(flows: SavedFlow[], input: { text: string; outsideHours: boolean; at: number }) {
  const ranked = [...flows].sort((left, right) => inboundRank(left) - inboundRank(right));
  return ranked.find((flow) => stepSends(freshFlowStep(flow, input))) ?? null;
}

export function startInboundFlow(
  flows: SavedFlow[],
  input: { text: string; outsideHours: boolean; run: FlowRun | null; at: number },
): { flow: SavedFlow; step: FlowStep; restart: boolean } | null {
  const current = input.run && input.run.status !== "done" ? flows.find((flow) => flow.id === input.run?.flowId) : null;
  if (current && input.run) {
    const step = stepFlow(current, input.run, { text: input.text, at: input.at, outsideHours: input.outsideHours });
    if (step.actions.length) return { flow: current, step, restart: false };
  }
  const flow = pickAutomaticFlow(flows, input);
  if (!flow) return null;
  const step = freshFlowStep(flow, input);
  if (!stepSends(step)) return null;
  return { flow, step, restart: Boolean(input.run && input.run.status !== "done") };
}

function startNode(graph: FlowGraph, input: { text: string; manual: boolean }) {
  const roots = triggers(graph);
  if (input.manual) return roots[0];
  const keyword = roots.find((node) => node.label === "Palavra-chave" && includesTerm(input.text, node.content));
  if (keyword) return keyword;
  return roots.find((node) => node.label === "Mensagem recebida") ?? roots.find((node) => node.label === "Fora do expediente") ?? roots.find((node) => hasHoursEdges(graph, node.id));
}

export function stepFlow(flow: SavedFlow, run: FlowRun | null, input: { text: string; at: number; outsideHours: boolean; manual?: boolean }): FlowStep {
  const manual = input.manual === true;
  if (run && run.flowId === flow.id && run.status === "delay") {
    if (input.at < run.waitUntil) return { actions: [], run };
    return walk(flow, outgoing(flow.graph, run.nodeId), run.lastAnswer, input);
  }
  if (run && run.flowId === flow.id && run.status === "waiting" && !manual) {
    const waiting = nodeById(flow.graph, run.nodeId);
    if (waiting?.label === "Menu") {
      const target = menuTarget(flow.graph, waiting, input.text);
      if (target == null) return { actions: [], run };
      return walk(flow, target ? [target] : [], input.text.trim(), input);
    }
    if (waiting?.label === "Fazer pergunta" && !input.text.trim()) return { actions: [], run };
    return walk(flow, outgoing(flow.graph, run.nodeId), input.text.trim(), input);
  }
  if (run?.status === "done" && !manual) {
    const keyword = triggers(flow.graph).find((node) => node.label === "Palavra-chave" && includesTerm(input.text, node.content));
    if (!keyword) return { actions: [], run };
    return walk(flow, outgoing(flow.graph, keyword.id), input.text.trim() || run.lastAnswer, input);
  }
  const trigger = startNode(flow.graph, { text: input.text, manual });
  if (!trigger) return emptyStep;
  if (trigger.label === "Fora do expediente" || hasHoursEdges(flow.graph, trigger.id)) {
    const target = hoursTarget(flow.graph, trigger.id, input.outsideHours) || (manual ? soleHoursTarget(flow.graph, trigger.id) : "");
    return walk(flow, target ? [target] : [], "", input);
  }
  return walk(flow, outgoing(flow.graph, trigger.id), "", input);
}

function menuTarget(graph: FlowGraph, node: FlowNode, text: string) {
  const answer = text.trim().toLocaleLowerCase("pt-BR");
  const matched = flowMenuOptions(node.options).find((option) => {
    const label = option.label.toLocaleLowerCase("pt-BR");
    return option.id === text.trim() || label === answer || answer === `${option.id} - ${label}`;
  });
  if (!matched) return null;
  return graph.edges.find((edge) => edge.source === node.id && edge.sourceHandle === matched.id)?.target ?? "";
}

function soleHoursTarget(graph: FlowGraph, id: string) {
  const edges = graph.edges.filter((edge) => edge.source === id);
  const tagged = edges.filter((edge) => edge.sourceHandle === "sim" || edge.sourceHandle === "nao");
  return tagged.length === 1 ? tagged[0]?.target ?? "" : "";
}

export function manualFlowNotice(input: { plannedSend: boolean; delivered: boolean; owned: boolean }) {
  if (input.plannedSend && !input.delivered) return "O bot não conseguiu enviar a mensagem no WhatsApp.";
  if (!input.delivered && !input.owned) return "Esse bot não tem uma ação ligada ao gatilho.";
  return "";
}

function hoursTarget(graph: FlowGraph, id: string, outside: boolean) {
  const edges = graph.edges.filter((edge) => edge.source === id);
  const handle = outside ? "sim" : "nao";
  const tagged = edges.find((edge) => edge.sourceHandle === handle);
  if (tagged) return tagged.target;
  const other = outside ? "nao" : "sim";
  const rest = edges.filter((edge) => edge.sourceHandle !== other);
  if (rest.length === 1 && rest[0]) return rest[0].target;
  if (edges.some((edge) => edge.sourceHandle === "sim" || edge.sourceHandle === "nao")) return "";
  return outside ? (edges[0]?.target ?? "") : (edges[1]?.target ?? "");
}

function walk(flow: SavedFlow, start: string[], lastAnswer: string, input: { text: string; at: number; outsideHours: boolean }): FlowStep {
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
    if (node.label === "Menu") {
      const options = flowMenuOptions(node.options);
      if (content && options.length) {
        actions.push({ type: "menu", text: content, options });
        return { actions, run: { flowId: flow.id, nodeId: node.id, status: "waiting", waitUntil: 0, lastAnswer } };
      }
    }
    if (node.label === "Fazer pergunta" && content) {
      actions.push({ type: "send", text: content });
      return { actions, run: { flowId: flow.id, nodeId: node.id, status: "waiting", waitUntil: 0, lastAnswer: "" } };
    }
    if (node.label === "Salvar resposta no CRM" && lastAnswer) actions.push({ type: "save", field: crmSaveField(content), text: lastAnswer });
    if (node.label === "Adicionar etiqueta" && content) actions.push({ type: "tag", name: content });
    if ((node.label === "Kanban" || node.label === "Criar oportunidade") && content) actions.push({ type: "stage", name: content });
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
        run: { flowId: flow.id, nodeId: node.id, status: "delay", waitUntil: input.at + waitMilliseconds(content), lastAnswer },
      };
    }
    if (node.label === "Condição se / senão") {
      const next = outgoing(flow.graph, node.id);
      const matched = content ? includesTerm(lastAnswer || input.text, content) : Boolean((lastAnswer || input.text).trim());
      const target = matched ? next[0] : next[1];
      if (target) pending.unshift(target);
      continue;
    }
    if (node.label === "Fora do expediente") {
      const target = hoursTarget(flow.graph, node.id, input.outsideHours);
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

export type FlowPreviewTurn = { from: "contact" | "bot"; text: string };

function describeFlowAction(action: FlowAction) {
  if (action.type === "menu") return [action.text, ...action.options.map((option) => option.label)].filter(Boolean).join(" · ");
  if (action.type === "send") {
    const media = action.media ? flowMediaLabel(action.media.kind) : "";
    const text = action.text.trim();
    if (text && media) return `${media}: ${text}`;
    return text || media;
  }
  if (action.type === "tag") return `Etiqueta adicionada: ${action.name}`;
  if (action.type === "stage") return `Contato colocado na etapa ${action.name}.`;
  if (action.type === "save") return `Resposta salva em ${crmSaveLabel(action.field)}: ${action.text}`;
  if (action.type === "queue") return "Conversa enviada para a fila de atendimento do Chatbot.";
  return "";
}

export function previewFlowTurns(graph: FlowGraph, messages: string[], outsideHours: boolean, at = Date.now()) {
  const flow: SavedFlow = { id: "preview", name: "Prévia", graph };
  let run: FlowRun | null = null;
  const turns: FlowPreviewTurn[] = [];
  const clean = messages.map((item) => item.trim()).filter(Boolean).slice(0, 12);
  for (const text of clean) {
    turns.push({ from: "contact", text });
    const step = stepFlow(flow, run, { text, at, outsideHours });
    run = step.run;
    const lines = step.actions.map(describeFlowAction).filter(Boolean);
    if (run?.status === "delay") {
      const waiting = nodeById(flow.graph, run.nodeId);
      lines.push(waitPreviewLabel(waiting?.content ?? ""));
    }
    if (!lines.length) lines.push("O fluxo não enviou mensagem nesta etapa.");
    for (const line of lines) turns.push({ from: "bot", text: line });
    if (run?.status === "done" || run?.status === "delay") break;
  }
  return { turns, waiting: run?.status === "waiting", finished: run?.status === "done" };
}
