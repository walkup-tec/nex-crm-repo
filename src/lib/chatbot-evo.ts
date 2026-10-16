export type ChatbotConnectionStatus =
  | "waiting"
  | "qr"
  | "connecting"
  | "connected"
  | "disconnected"
  | "error";

export type ChatbotSnapshot = {
  configured: boolean;
  organizationId: string;
  connections: {
    id: string;
    name: string;
    phone: string;
    status: ChatbotConnectionStatus;
    error: string;
  }[];
  contacts: { id: string; name: string; phone: string; avatarUrl: string; botsDisabled: boolean }[];
  conversations: {
    id: string;
    contactId: string;
    connectionId: string;
    status: "queue" | "active" | "closed";
    assigneeName: string;
    botPaused: boolean;
    updatedAt: string;
    unreadCount: number;
    pinned: boolean;
    mine: boolean;
    open: boolean;
  }[];
  messages: {
    id: string;
    conversationId: string;
    text: string;
    direction: "in" | "out";
    status: "pending" | "sent" | "failed";
    createdAt: string;
    mediaKind: "" | "image" | "video" | "audio";
    mediaMime: string;
    saved: boolean;
    internal: boolean;
  }[];
};

export function internalNote(value: string) {
  const clean = value.trim().replace(/\s+/g, " ");
  if (!clean || clean.length > 500) return "";
  return clean;
}

export function headerAttendant(name: string) {
  return name.trim() || "Fila";
}

export function negotiatedCents(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 13);
  if (!digits) return null;
  const cents = Number(digits);
  return Number.isFinite(cents) ? cents : null;
}

export function negotiatedLabel(cents: number | null) {
  if (cents == null) return "";
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function clientVisibleTo(ownerId: string, userId: string, admin: boolean) {
  if (!ownerId) return false;
  if (admin) return true;
  return ownerId === userId;
}

export function keepAttendanceBotsPaused(botsDisabled: boolean, reopenHuman: boolean) {
  return botsDisabled || reopenHuman;
}

export function attendanceLabel(input: { assigneeName: string; botPaused: boolean; botSpoke: boolean; closed: boolean }) {
  if (input.closed) return "Encerrado";
  const name = input.assigneeName.trim();
  if (name) return name;
  if (!input.botPaused && input.botSpoke) return "Bot atendendo";
  return "Em fila";
}

export function inboxVisible(input: { assigneeId: string; userId: string; admin: boolean }) {
  if (!input.assigneeId) return true;
  return input.assigneeId === input.userId || input.admin;
}

export function inboxUnread(createdAt: string[], lastReadAt: string) {
  if (!lastReadAt) return createdAt.length;
  return createdAt.filter((at) => at > lastReadAt).length;
}

export function shouldSyncEvolution(lastStartedAt: number, now: number) {
  return now - lastStartedAt >= 10000;
}

export function pendingOutgoing<T extends { conversationId: string; direction: string; text: string; createdAt: string; internal?: boolean }>(
  saved: T[],
  previews: { id: string; conversationId: string; text: string; createdAt: string }[],
) {
  const consumed = saved.filter((message) => message.direction === "out" && !message.internal);
  return previews.filter((preview) => {
    const earliest = new Date(Date.parse(preview.createdAt) - 5000).toISOString();
    const index = consumed.findIndex(
      (message) => message.conversationId === preview.conversationId && message.text === preview.text && message.createdAt >= earliest,
    );
    if (index < 0) return true;
    consumed.splice(index, 1);
    return false;
  });
}

export function messageClock(iso: string, nowIso = new Date().toISOString()) {
  const date = new Date(iso);
  const now = new Date(nowIso);
  if (Number.isNaN(date.getTime()) || Number.isNaN(now.getTime())) return "";
  const time = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }).format(date);
  const dayKey = (value: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
  const sentDay = dayKey(iso);
  const today = dayKey(nowIso);
  const yesterdayDate = new Date(`${today}T12:00:00Z`);
  yesterdayDate.setUTCDate(yesterdayDate.getUTCDate() - 1);
  const yesterday = yesterdayDate.toISOString().slice(0, 10);
  if (sentDay === today) return `Hoje, ${time}`;
  if (sentDay === yesterday) return `Ontem, ${time}`;
  const day = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" }).format(date);
  return `${day}, ${time}`;
}

export function audioDurationLabel(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.round(seconds);
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

export function audioWaveBars(samples: ArrayLike<number>, bars: number) {
  const count = Math.max(1, Math.floor(bars));
  if (!samples.length) return Array.from({ length: count }, () => 0.22);
  const block = Math.max(1, Math.floor(samples.length / count));
  const peaks: number[] = [];
  for (let index = 0; index < count; index += 1) {
    const start = index * block;
    const end = Math.min(samples.length, start + block);
    let peak = 0;
    const step = Math.max(1, Math.floor((end - start) / 20));
    for (let cursor = start; cursor < end; cursor += step) peak = Math.max(peak, Math.abs(samples[cursor] ?? 0));
    peaks.push(peak);
  }
  const max = Math.max(...peaks, 0.001);
  return peaks.map((peak) => Math.max(0.18, Math.min(1, peak / max)));
}

export function composerSendsOnEnter(input: { key: string; code: string; shiftKey: boolean; pending: boolean; text: string }) {
  const enter = input.key === "Enter" || input.code === "Enter" || input.code === "NumpadEnter";
  return enter && !input.shiftKey && !input.pending && input.text.trim().length > 0;
}

export function acceptSnapshot(requestId: number, lastAppliedId: number) {
  return requestId > lastAppliedId;
}

export function stickToLatestMessage(distanceFromBottom: number) {
  return distanceFromBottom <= 80;
}

export function inboxOrder<T extends { id: string; pinned: boolean; updatedAt: string }>(items: T[]) {
  return [...items].sort((left, right) => {
    if (left.pinned !== right.pinned) return left.pinned ? -1 : 1;
    const byTime = right.updatedAt.localeCompare(left.updatedAt);
    if (byTime !== 0) return byTime;
    return left.id.localeCompare(right.id);
  });
}

export function chatbotInstanceName(organizationId: string) {
  const org = organizationId.replace(/[^a-z0-9]/gi, "").slice(0, 12).toLowerCase();
  const stamp = Date.now().toString(36);
  return `nex${org}${stamp}`.slice(0, 40);
}

export function droppedChannels<T extends { status: string }>(channels: T[]) {
  return channels.filter((channel) => channel.status === "disconnected" || channel.status === "error");
}

export function channelsAllConnected(channels: { status: string }[]) {
  return channels.length > 0 && channels.every((channel) => channel.status === "connected");
}

export function whatsappMask(value: string) {
  const raw = value.replace(/\D/g, "");
  let digits = raw.startsWith("55") && raw.length > 11 ? raw.slice(2) : raw;
  const mobileWithoutNine = raw.startsWith("55") && raw.length === 12 && digits.length === 10 && /[6-9]/.test(digits[2] ?? "");
  if (mobileWithoutNine) digits = `${digits.slice(0, 2)}9${digits.slice(2)}`;
  digits = digits.slice(0, 11);
  if (!digits) return "";
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export function preferredWhatsappPhone(stored: string, incoming: string) {
  if (!incoming) return stored;
  if (!stored) return incoming;
  if (whatsappMask(stored) !== whatsappMask(incoming)) return incoming;
  return stored.replace(/\D/g, "").length >= incoming.replace(/\D/g, "").length ? stored : incoming;
}

export const whatsappDeviceRemovedMessage =
  "O WhatsApp removeu o aparelho vinculado. Escaneie o QR Code novamente, uma única vez.";

export function whatsappDeviceRemoved(reason: unknown) {
  return Number(reason) === 401;
}

export function sameWhatsappAccount(left: string, right: string) {
  const compact = (value: string) => {
    const digits = value.replace(/\D/g, "");
    const local = digits.startsWith("55") && digits.length > 11 ? digits.slice(2) : digits;
    if (local.length === 11 && local[2] === "9") return `${local.slice(0, 2)}${local.slice(3)}`;
    return local;
  };
  const first = compact(left);
  const second = compact(right);
  return first.length >= 10 && first === second;
}

export function attendancePhone(value: string) {
  const raw = value.replace(/\D/g, "");
  const hasCountry = value.includes("+") || raw.length > 11;
  const digits = hasCountry && raw.startsWith("55") ? raw.slice(2) : raw;
  if (digits.length !== 10 && digits.length !== 11) return "";
  return `55${digits}`;
}

export function whatsappJidPhone(jid: string) {
  const head = jid.split("@")[0] ?? "";
  const digits = head.replace(/\D/g, "");
  if (jid.endsWith("@g.us") || jid.endsWith("@broadcast") || digits.length < 8) return "";
  return digits;
}

export function whatsappGroupJid(value: string) {
  const jid = value.trim().toLowerCase();
  if (!jid.endsWith("@g.us")) return "";
  const head = jid.slice(0, -"@g.us".length);
  if (!/^\d{10,24}$/.test(head)) return "";
  return `${head}@g.us`;
}

export function whatsappGroupLabel(jid: string) {
  const head = whatsappGroupJid(jid).split("@")[0] ?? "";
  const tail = head.slice(-4);
  return tail ? `Grupo ${tail}` : "Grupo";
}

export function sameChatbotContact(left: string, right: string) {
  const leftGroup = whatsappGroupJid(left);
  const rightGroup = whatsappGroupJid(right);
  if (leftGroup || rightGroup) return leftGroup !== "" && leftGroup === rightGroup;
  return left === right || sameWhatsappAccount(left, right);
}

export function evolutionConversationPhone(key: Record<string, unknown>, known: Record<string, string>) {
  const remote = key["remoteJid"];
  if (typeof remote === "string") {
    const group = whatsappGroupJid(remote);
    if (group) return group;
  }
  return resolveIncomingPhone(key, known) || evolutionContactPhone(key);
}

export function evolutionGroupSubject(payload: unknown) {
  return catalogName(readGroupSubject(payload, 0), 80);
}

function readGroupSubject(value: unknown, depth: number): string {
  if (!value || typeof value !== "object" || depth > 3) return "";
  if (Array.isArray(value)) {
    for (const item of value) {
      const subject = readGroupSubject(item, depth + 1);
      if (subject) return subject;
    }
    return "";
  }
  const record = value as Record<string, unknown>;
  if (typeof record["subject"] === "string" && record["subject"].trim()) return record["subject"];
  for (const key of ["group", "data", "groupMetadata"]) {
    const subject = readGroupSubject(record[key], depth + 1);
    if (subject) return subject;
  }
  return "";
}

export function groupInboundText(sender: string, text: string) {
  const name = catalogName(sender, 80);
  const body = text.trim();
  if (!name) return body;
  if (!body) return name;
  if (body === name || body.startsWith(`${name}: `)) return body;
  return `${name}: ${body}`;
}

export function evolutionConnectionStatus(state: string): ChatbotConnectionStatus {
  const value = state.toLowerCase();
  if (value === "open") return "connected";
  if (value === "connecting") return "connecting";
  if (value === "close" || value === "closed") return "disconnected";
  return "waiting";
}

export function evolutionInstanceNameOf(record: Record<string, unknown>) {
  const nested = record["instance"];
  const nestedRecord = nested && typeof nested === "object" ? (nested as Record<string, unknown>) : null;
  const found = [record["name"], record["instanceName"], nestedRecord?.["instanceName"], nestedRecord?.["name"]].find(
    (value) => typeof value === "string" && value.trim(),
  );
  return typeof found === "string" ? found.trim() : "";
}

export function evolutionInstanceClosed(record: Record<string, unknown> | null) {
  if (!record) return true;
  const nested = record["instance"];
  const nestedRecord = nested && typeof nested === "object" ? (nested as Record<string, unknown>) : null;
  const status = [record["connectionStatus"], record["status"], record["state"], nestedRecord?.["state"], nestedRecord?.["status"]].find(
    (value) => typeof value === "string" && value.trim(),
  );
  const value = typeof status === "string" ? status.toLowerCase() : "";
  return value === "close" || value === "closed" || value === "disconnected";
}

export function evolutionNumberInUse(instances: unknown, phone: string) {
  if (!Array.isArray(instances)) return false;
  return instances.some((item) => {
    if (!item || typeof item !== "object") return false;
    const record = item as Record<string, unknown>;
    if (evolutionInstanceClosed(record)) return false;
    const number = record["number"];
    const owner = record["ownerJid"];
    return (
      (typeof number === "string" && sameWhatsappAccount(phone, number)) ||
      (typeof owner === "string" && sameWhatsappAccount(phone, owner))
    );
  });
}

const nexQrPurple = { r: 0x6f, g: 0x02, b: 0xfd };

export function tintQrPixel(r: number, g: number, b: number, a: number) {
  const distance = Math.hypot(255 - r, 255 - g, 255 - b) / 441.67295593;
  if (distance < 0.12) return [r, g, b, a] as const;
  const ink = Math.min(1, distance / 0.45);
  return [
    Math.round(255 + (nexQrPurple.r - 255) * ink),
    Math.round(255 + (nexQrPurple.g - 255) * ink),
    Math.round(255 + (nexQrPurple.b - 255) * ink),
    a,
  ] as const;
}

export function evolutionProfilePictureUrl(payload: unknown) {
  if (!payload || typeof payload !== "object") return "";
  const url = (payload as Record<string, unknown>)["profilePictureUrl"];
  return typeof url === "string" && url.startsWith("https://") ? url : "";
}

export function evolutionContactAvatar(data: unknown) {
  const record = data && typeof data === "object" ? (data as Record<string, unknown>) : null;
  if (!record) return null;
  const jid = [record["remoteJid"], record["id"], record["jid"]].find((value) => typeof value === "string");
  const phone = typeof jid === "string" ? whatsappJidPhone(jid) : "";
  if (!phone) return null;
  const raw = [record["profilePicUrl"], record["profilePictureUrl"], record["imgUrl"]].find((value) => typeof value === "string");
  const url = typeof raw === "string" && raw.startsWith("https://") ? raw : "";
  return { phone, url, changed: raw === "changed" };
}

export function evolutionQrImage(payload: unknown): string {
  const found = findString(payload, ["base64", "qrcode"]);
  if (!found) return "";
  if (found.startsWith("data:image")) return found;
  if (/^[A-Za-z0-9+/=]+$/.test(found) && found.length > 80) return `data:image/png;base64,${found}`;
  return "";
}

export function evolutionContactIdentity(key: Record<string, unknown>) {
  const fields = ["remoteJidAlt", "senderPn", "participantPn", "participant", "remoteJid"];
  let phone = "";
  let lid = "";
  for (const field of fields) {
    const value = key[field];
    if (typeof value !== "string" || !value) continue;
    if (value.endsWith("@lid")) {
      if (!lid) lid = value;
      continue;
    }
    const digits = whatsappJidPhone(value);
    if (digits && !phone) phone = digits;
  }
  return { phone, lid };
}

export function learnLidPhones(keys: Record<string, unknown>[]) {
  const known: Record<string, string> = {};
  for (const key of keys) {
    const identity = evolutionContactIdentity(key);
    if (identity.lid && identity.phone) known[identity.lid] = identity.phone;
  }
  return known;
}

export function resolveIncomingPhone(key: Record<string, unknown>, known: Record<string, string>) {
  const identity = evolutionContactIdentity(key);
  if (identity.phone) return identity.phone;
  if (identity.lid && known[identity.lid]) return known[identity.lid];
  return "";
}

export function evolutionContactPhone(key: Record<string, unknown>) {
  const resolved = resolveIncomingPhone(key, {});
  if (resolved) return resolved;
  const digits = evolutionContactIdentity(key).lid.split("@")[0]?.replace(/\D/g, "") ?? "";
  if (digits.length >= 8 && digits.length <= 13) return digits;
  return "";
}

export function evolutionSameOwnerInstance(instances: unknown, currentName: string) {
  if (!Array.isArray(instances) || !currentName) return "";
  const rows = instances.filter(isRecord);
  const current = rows.find((row) => row["name"] === currentName);
  const owner = current?.["ownerJid"];
  if (typeof owner !== "string" || !owner) return "";
  let best = "";
  let bestCount = 0;
  for (const row of rows) {
    if (row["name"] === currentName || row["ownerJid"] !== owner) continue;
    const count = messageCount(row["_count"]);
    const name = row["name"];
    if (typeof name !== "string" || count <= bestCount) continue;
    best = name;
    bestCount = count;
  }
  return best;
}

function messageCount(value: unknown) {
  if (!isRecord(value)) return 0;
  const count = value["Message"];
  return typeof count === "number" ? count : 0;
}

export function evolutionIncomingMessages(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data.filter(isRecord);
  if (!isRecord(data)) return [];
  const messages = data["messages"];
  if (Array.isArray(messages)) return messages.filter(isRecord);
  if (isRecord(messages) && Array.isArray(messages["records"])) return messages["records"].filter(isRecord);
  if (Array.isArray(data["records"])) return data["records"].filter(isRecord);
  if (isRecord(data["message"]) && isRecord((data["message"] as Record<string, unknown>)["key"])) {
    return [data["message"] as Record<string, unknown>];
  }
  if (data["key"] || data["message"]) return [data];
  return [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

const mediaWrappers = ["ephemeralMessage", "viewOnceMessage", "viewOnceMessageV2", "viewOnceMessageV2Extension", "documentWithCaptionMessage", "editedMessage"];

function unwrapEvolutionMessage(message: Record<string, unknown>) {
  let current = message;
  for (let depth = 0; depth < 4; depth += 1) {
    const wrapper = mediaWrappers.find((key) => isRecord(current[key]));
    if (!wrapper) break;
    const nested = current[wrapper] as Record<string, unknown>;
    current = isRecord(nested["message"]) ? nested["message"] : nested;
  }
  return current;
}

function mediaKindFromName(value: unknown): "" | "image" | "video" | "audio" {
  if (value === "imageMessage") return "image";
  if (value === "videoMessage" || value === "ptvMessage") return "video";
  if (value === "audioMessage" || value === "pttMessage") return "audio";
  return "";
}

function mediaMime(value: unknown) {
  if (typeof value !== "string") return "";
  return value.split(";")[0]?.trim().toLowerCase() ?? "";
}

export function evolutionMessageContent(data: unknown): { text: string; mediaKind: "" | "image" | "video" | "audio"; mediaMime: string } {
  const root = isRecord(data) ? data : {};
  const source = isRecord(root["message"]) ? root["message"] : root;
  const message = unwrapEvolutionMessage(source);
  const nested = isRecord(message["imageMessage"])
    ? message["imageMessage"]
    : isRecord(message["videoMessage"])
      ? message["videoMessage"]
      : isRecord(message["ptvMessage"])
        ? message["ptvMessage"]
        : isRecord(message["audioMessage"])
          ? message["audioMessage"]
          : message;
  const mediaKind =
    mediaKindFromName(root["messageType"]) ||
    mediaKindFromName(message["messageType"]) ||
    (message["imageMessage"] ? "image" : message["videoMessage"] || message["ptvMessage"] ? "video" : message["audioMessage"] ? "audio" : "") ||
    (mediaMime(nested["mimetype"]).startsWith("image/") ? "image" : mediaMime(nested["mimetype"]).startsWith("video/") ? "video" : mediaMime(nested["mimetype"]).startsWith("audio/") ? "audio" : "");
  if (!mediaKind) return { text: evolutionMessageText(message), mediaKind: "", mediaMime: "" };
  const caption = typeof nested["caption"] === "string" ? nested["caption"].trim() : "";
  return { text: caption || (mediaKind === "audio" ? "[áudio]" : ""), mediaKind, mediaMime: mediaMime(nested["mimetype"]) };
}

export function evolutionMediaFile(payload: unknown, hint: "" | "image" | "video" | "audio" = ""): { mime: string; base64: string; kind: "" | "image" | "video" | "audio" } {
  const root = isRecord(payload) ? payload : {};
  const record = typeof root["base64"] === "string" ? root : isRecord(root["data"]) && typeof root["data"]["base64"] === "string" ? root["data"] : root;
  let base64 = typeof record["base64"] === "string" ? record["base64"].replace(/\s/g, "") : "";
  let mime = mediaMime(record["mimetype"]);
  const prefix = /^data:([^;]+);base64,(.+)$/s.exec(base64);
  if (prefix) {
    mime = mime || mediaMime(prefix[1]);
    base64 = prefix[2] ?? "";
  }
  const named = typeof record["mediaType"] === "string" ? record["mediaType"] : "";
  const kind = mime.startsWith("video/") || named === "video" || named === "videoMessage"
    ? "video"
    : mime.startsWith("audio/") || named === "audio" || named === "audioMessage"
      ? "audio"
      : mime.startsWith("image/") || named === "image" || named === "imageMessage"
        ? "image"
        : hint;
  if (!base64 || !kind || base64.length > 40_000_000) return { mime: "", base64: "", kind: "" };
  return { mime: mime || (kind === "video" ? "video/mp4" : kind === "audio" ? "audio/ogg" : "image/jpeg"), base64, kind };
}

function buttonReplyText(value: unknown) {
  if (!value || typeof value !== "object") return "";
  const row = value as Record<string, unknown>;
  if (typeof row["selectedDisplayText"] === "string" && row["selectedDisplayText"].trim()) return row["selectedDisplayText"].trim();
  const id = row["selectedButtonId"] ?? row["selectedId"];
  if (typeof id === "string" && id.trim()) return id.trim();
  const single = row["singleSelectReply"];
  if (single && typeof single === "object") {
    const selected = (single as Record<string, unknown>)["selectedRowId"];
    if (typeof selected === "string" && selected.trim()) return selected.trim();
  }
  return typeof row["title"] === "string" ? row["title"].trim() : "";
}

export function evolutionMessageText(message: unknown): string {
  if (typeof message === "string") return message.trim();
  if (!message || typeof message !== "object") return "";
  const record = message as Record<string, unknown>;
  if (typeof record["conversation"] === "string") return record["conversation"];
  for (const key of ["buttonsResponseMessage", "templateButtonReplyMessage", "listResponseMessage"]) {
    const reply = buttonReplyText(record[key]);
    if (reply) return reply;
  }
  const extended = record["extendedTextMessage"];
  if (extended && typeof extended === "object" && typeof (extended as Record<string, unknown>)["text"] === "string") {
    return (extended as Record<string, unknown>)["text"] as string;
  }
  for (const wrapper of ["ephemeralMessage", "viewOnceMessage", "viewOnceMessageV2", "viewOnceMessageV2Extension", "documentWithCaptionMessage", "editedMessage"]) {
    const nested = record[wrapper];
    if (nested && typeof nested === "object") {
      const inner = (nested as Record<string, unknown>)["message"];
      const text = evolutionMessageText(inner);
      if (text) return text;
    }
  }
  if (record["imageMessage"]) return "[imagem]";
  if (record["audioMessage"]) return "[áudio]";
  if (record["videoMessage"] || record["ptvMessage"]) return "[vídeo]";
  if (record["documentMessage"]) return "[documento]";
  if (record["locationMessage"]) return "[localização]";
  if (record["contactMessage"]) return "[contato]";
  return record["conversation"] === undefined && Object.keys(record).length ? "[mensagem]" : "";
}

export const wonKanbanStage = "Sucesso";
export const defaultKanbanStages = ["Novos leads", "Qualificação", "Proposta", "Negociação", "Ganho", wonKanbanStage];

export function protectedKanbanStage(name: string) {
  return name.trim().toLowerCase() === wonKanbanStage.toLowerCase();
}

export function withWonKanbanStage(names: string[]) {
  if (names.some((name) => protectedKanbanStage(name))) return names;
  return [...names, wonKanbanStage];
}

export type ChatbotOverview = {
  received: number;
  attending: number;
  finished: number;
  openDeals: number;
  negotiatingCents: number;
  wonCents: number;
  clients: number;
  ratingAverage: number | null;
  ratingCount: number;
  stages: { name: string; count: number }[];
  days: { day: string; count: number }[];
};

export function stageDistribution(stages: string[], contacts: { stage: string }[]) {
  return stages.map((name) => ({
    name,
    count: contacts.filter((item) => item.stage === name).length,
  }));
}

export function overviewMetrics(input: {
  conversations: { contactId: string; assigneeId: string; finishedCount: number; createdAt?: string }[];
  contacts: { negotiatedCents: number | null; stage: string; ownerId: string }[];
  scores?: number[];
  stages?: string[];
  userId: string;
  admin: boolean;
}): ChatbotOverview {
  const received = new Set(input.conversations.map((item) => item.contactId).filter(Boolean));
  const attending = new Set(
    input.conversations.filter((item) => item.assigneeId).map((item) => item.contactId).filter(Boolean),
  );
  const deals = input.contacts.filter((item) => item.negotiatedCents != null);
  const won = deals.filter((item) => protectedKanbanStage(item.stage));
  const clients = input.contacts.filter((item) => clientVisibleTo(item.ownerId, input.userId, input.admin));
  const scores = (input.scores ?? []).filter((score) => Number.isInteger(score) && score >= 1 && score <= 5);
  return {
    received: received.size,
    attending: attending.size,
    finished: input.conversations.reduce((sum, item) => sum + Math.max(0, item.finishedCount), 0),
    openDeals: deals.length,
    negotiatingCents: deals.reduce((sum, item) => sum + (item.negotiatedCents ?? 0), 0),
    wonCents: won.reduce((sum, item) => sum + (item.negotiatedCents ?? 0), 0),
    clients: clients.length,
    ratingAverage: ratingAverage(scores),
    ratingCount: scores.length,
    stages: stageDistribution(input.stages ?? [], input.contacts),
    days: dailyAttendanceCounts(input.conversations.map((item) => item.createdAt ?? "")),
  };
}

const attendanceTimeZone = "America/Sao_Paulo";

function zonedDay(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const read = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return { year: read("year"), month: read("month"), day: read("day") };
}

function dayKey(day: { year: number; month: number; day: number }) {
  return `${day.year}-${String(day.month).padStart(2, "0")}-${String(day.day).padStart(2, "0")}`;
}

function addUtcDays(day: { year: number; month: number; day: number }, amount: number) {
  const next = new Date(Date.UTC(day.year, day.month - 1, day.day + amount));
  return { year: next.getUTCFullYear(), month: next.getUTCMonth() + 1, day: next.getUTCDate() };
}

export function dailyAttendanceCounts(createdAts: string[], timeZone = attendanceTimeZone) {
  const counts = new Map<string, number>();
  for (const value of createdAts) {
    const parsed = Date.parse(value);
    if (!Number.isFinite(parsed)) continue;
    const day = dayKey(zonedDay(new Date(parsed), timeZone));
    counts.set(day, (counts.get(day) ?? 0) + 1);
  }
  return [...counts.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([day, count]) => ({ day, count }));
}

export function attendanceSeries(
  counts: { day: string; count: number }[],
  period: OverviewPeriod,
  now = new Date(),
  timeZone = attendanceTimeZone,
) {
  const today = dayKey(zonedDay(now, timeZone));
  const startKey = period.mode === "custom" ? period.since : counts[0]?.day ?? today;
  const endKey = period.mode === "custom" ? period.until : today;
  const start = parseDay(startKey);
  if (!start || startKey > endKey) return [];
  const byDay = new Map(counts.map((item) => [item.day, item.count]));
  const points: { label: string; count: number }[] = [];
  for (let cursor = start; dayKey(cursor) <= endKey && points.length < 400; cursor = addUtcDays(cursor, 1)) {
    points.push({
      label: `${String(cursor.day).padStart(2, "0")}/${String(cursor.month).padStart(2, "0")}`,
      count: byDay.get(dayKey(cursor)) ?? 0,
    });
  }
  return points;
}

export type OverviewPeriod = { mode: "total" } | { mode: "custom"; since: string; until: string };

export type OverviewFilters = {
  period: OverviewPeriod;
  attendantId: string;
  channelId: string;
};

export type OverviewBoard = {
  stages: string[];
  attendants: { id: string; name: string; team: string }[];
  channels: { id: string; name: string }[];
  conversations: { id: string; contactId: string; connectionId: string; assigneeId: string; assumedBy?: string; finishedCount: number; createdAt: string }[];
  contacts: { id: string; negotiatedCents: number | null; stage: string; ownerId: string; stageSetBy?: string }[];
  ratings: { conversationId: string; score: number; createdAt: string }[];
  products?: { id: string; name: string }[];
  productLinks?: { contactId: string; productId: string }[];
  userId: string;
  admin: boolean;
};

export type OverviewAgent = { id: string; name: string; team: string; total: number; success: number; wonCents: number };

function parseDay(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

function dayInPeriod(value: string, period: OverviewPeriod, timeZone = attendanceTimeZone) {
  if (period.mode === "total") return true;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return false;
  const day = dayKey(zonedDay(new Date(parsed), timeZone));
  return day >= period.since && day <= period.until;
}

export function previousOverviewPeriod(period: OverviewPeriod): OverviewPeriod | null {
  if (period.mode !== "custom") return null;
  const start = parseDay(period.since);
  if (!start || period.since > period.until) return null;
  let length = 0;
  for (let cursor = start; dayKey(cursor) <= period.until && length < 400; cursor = addUtcDays(cursor, 1)) length += 1;
  if (!length) return null;
  const previousEnd = addUtcDays(start, -1);
  const previousStart = addUtcDays(previousEnd, -(length - 1));
  return { mode: "custom", since: dayKey(previousStart), until: dayKey(previousEnd) };
}

export function percentAgainstPrevious(current: number, previous: number) {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / Math.abs(previous)) * 100);
}

export type OverviewTrends = {
  received: number[];
  attending: number[];
  finished: number[];
  openDeals: number[];
  negotiatingCents: number[];
  wonCents: number[];
  clients: number[];
  rating: Array<number | null>;
};

export function applyOverviewFilters(source: OverviewBoard, filters: OverviewFilters) {
  const narrowed = filters.period.mode === "custom" || filters.attendantId !== "" || filters.channelId !== "";
  const inChannelAndPeriod = source.conversations.filter(
    (item) => (!filters.channelId || item.connectionId === filters.channelId) && dayInPeriod(item.createdAt, filters.period),
  );
  const matched = inChannelAndPeriod.filter((item) => !filters.attendantId || item.assigneeId === filters.attendantId);
  const contactIds = new Set(matched.map((item) => item.contactId).filter(Boolean));
  const contacts = narrowed ? source.contacts.filter((item) => contactIds.has(item.id)) : source.contacts;
  const conversationsById = new Map(source.conversations.map((item) => [item.id, item]));
  const rated = source.ratings.filter((rating) => {
    const conversation = conversationsById.get(rating.conversationId);
    if (filters.channelId && conversation?.connectionId !== filters.channelId) return false;
    if (filters.attendantId && conversation?.assigneeId !== filters.attendantId) return false;
    if ((filters.channelId || filters.attendantId) && !conversation) return false;
    return dayInPeriod(rating.createdAt, filters.period);
  });
  const scores = rated.map((rating) => rating.score);
  const metrics = overviewMetrics({
    userId: source.userId,
    admin: source.admin,
    stages: source.stages,
    scores,
    conversations: matched.map((item) => ({
      contactId: item.contactId,
      assigneeId: item.assigneeId,
      finishedCount: item.finishedCount,
      createdAt: item.createdAt,
    })),
    contacts,
  });
  const visibleContacts = new Set(inChannelAndPeriod.map((item) => item.contactId).filter(Boolean));
  const successOwner = new Map(source.contacts.flatMap((contact) => {
    if (!protectedKanbanStage(contact.stage) || !visibleContacts.has(contact.id)) return [];
    const owner = contact.stageSetBy || soleAttendant(contact.id, inChannelAndPeriod);
    return owner ? [[contact.id, owner] as const] : [];
  }));
  const agents = source.attendants
    .filter((person) => !filters.attendantId || person.id === filters.attendantId)
    .map((person) => {
      const won = source.contacts.filter((contact) => successOwner.get(contact.id) === person.id);
      return {
        id: person.id,
        name: person.name,
        team: person.team || "Sem equipe",
        total: attendanceTotal(person.id, inChannelAndPeriod),
        success: won.length,
        wonCents: won.reduce((sum, contact) => sum + (contact.negotiatedCents ?? 0), 0),
      };
    });
  return {
    ...metrics,
    agents,
    trends: cardTrends({
      period: filters.period,
      conversations: matched,
      contacts,
      ratings: rated,
      userId: source.userId,
      admin: source.admin,
    }),
    ...attendanceShares(source, matched),
  };
}

function conversationDay(value: string) {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return "";
  return dayKey(zonedDay(new Date(parsed), attendanceTimeZone));
}

function addAmount(target: Map<string, number>, day: string, amount: number) {
  if (!day || !Number.isFinite(amount) || amount === 0) return;
  target.set(day, (target.get(day) ?? 0) + amount);
}

function eachPeriodDay(period: OverviewPeriod, earliest: string, now = new Date()) {
  const today = dayKey(zonedDay(now, attendanceTimeZone));
  const startKey = period.mode === "custom" ? period.since : earliest || today;
  const endKey = period.mode === "custom" ? period.until : today;
  const start = parseDay(startKey);
  if (!start || startKey > endKey) return [];
  const days: string[] = [];
  for (let cursor = start; dayKey(cursor) <= endKey && days.length < 400; cursor = addUtcDays(cursor, 1)) days.push(dayKey(cursor));
  return days;
}

function readDaily(days: string[], amounts: Map<string, number>) {
  return days.map((day) => amounts.get(day) ?? 0);
}

function cardTrends(input: {
  period: OverviewPeriod;
  conversations: { contactId: string; assigneeId: string; finishedCount: number; createdAt: string }[];
  contacts: { id: string; negotiatedCents: number | null; stage: string; ownerId: string }[];
  ratings: { score: number; createdAt: string }[];
  userId: string;
  admin: boolean;
  now?: Date;
}): OverviewTrends {
  const firstDay = new Map<string, string>();
  const assignedDay = new Map<string, string>();
  const finished = new Map<string, number>();
  let earliest = "";
  for (const item of input.conversations) {
    const day = conversationDay(item.createdAt);
    if (!day) continue;
    if (!earliest || day < earliest) earliest = day;
    addAmount(finished, day, Math.max(0, item.finishedCount));
    if (!item.contactId) continue;
    const known = firstDay.get(item.contactId);
    if (!known || day < known) firstDay.set(item.contactId, day);
    if (!item.assigneeId) continue;
    const assigned = assignedDay.get(item.contactId);
    if (!assigned || day < assigned) assignedDay.set(item.contactId, day);
  }
  const received = new Map<string, number>();
  const attending = new Map<string, number>();
  for (const day of firstDay.values()) addAmount(received, day, 1);
  for (const day of assignedDay.values()) addAmount(attending, day, 1);
  const openDeals = new Map<string, number>();
  const negotiatingCents = new Map<string, number>();
  const wonCents = new Map<string, number>();
  const clients = new Map<string, number>();
  for (const contact of input.contacts) {
    const day = firstDay.get(contact.id) ?? "";
    if (contact.negotiatedCents != null) {
      addAmount(openDeals, day, 1);
      addAmount(negotiatingCents, day, contact.negotiatedCents);
      if (protectedKanbanStage(contact.stage)) addAmount(wonCents, day, contact.negotiatedCents);
    }
    if (clientVisibleTo(contact.ownerId, input.userId, input.admin)) addAmount(clients, day, 1);
  }
  const ratingBuckets = new Map<string, number[]>();
  for (const rating of input.ratings) {
    const day = conversationDay(rating.createdAt);
    if (!day || !Number.isFinite(rating.score)) continue;
    if (!earliest || day < earliest) earliest = day;
    ratingBuckets.set(day, [...(ratingBuckets.get(day) ?? []), rating.score]);
  }
  const days = eachPeriodDay(input.period, earliest, input.now);
  let carried: number | null = null;
  const rating = days.map((day) => {
    const scores = ratingBuckets.get(day);
    if (!scores?.length) return carried;
    carried = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    return carried;
  });
  const firstRating = rating.find((value) => value != null) ?? null;
  return {
    received: readDaily(days, received),
    attending: readDaily(days, attending),
    finished: readDaily(days, finished),
    openDeals: readDaily(days, openDeals),
    negotiatingCents: readDaily(days, negotiatingCents),
    wonCents: readDaily(days, wonCents),
    clients: readDaily(days, clients),
    rating: rating.map((value) => value ?? firstRating),
  };
}

function attendanceTotal(
  personId: string,
  conversations: { contactId: string; assigneeId: string; assumedBy?: string; finishedCount: number }[],
) {
  const attending = new Set(
    conversations.filter((item) => item.assigneeId === personId && item.contactId).map((item) => item.contactId),
  );
  const finished = conversations
    .filter((item) => (item.assumedBy || item.assigneeId) === personId)
    .reduce((sum, item) => sum + Math.max(0, item.finishedCount), 0);
  return attending.size + finished;
}

function soleAttendant(contactId: string, conversations: { contactId: string; assigneeId: string; assumedBy?: string }[]) {
  const ids = new Set<string>();
  for (const item of conversations) {
    if (item.contactId !== contactId) continue;
    const attendant = item.assumedBy || item.assigneeId;
    if (attendant) ids.add(attendant);
  }
  if (ids.size !== 1) return "";
  return [...ids][0] ?? "";
}

export type OverviewShare = { name: string; count: number };

function attendanceShares(
  source: OverviewBoard,
  conversations: OverviewBoard["conversations"],
): { productShares: OverviewShare[]; channelShares: OverviewShare[] } {
  const channelName = new Map(source.channels.map((item) => [item.id, item.name]));
  const channelCounts = new Map<string, number>();
  const productName = new Map((source.products ?? []).map((item) => [item.id, item.name]));
  const productsOf = new Map<string, string[]>();
  for (const link of source.productLinks ?? []) {
    const name = productName.get(link.productId);
    if (!name || !link.contactId) continue;
    const current = productsOf.get(link.contactId) ?? [];
    if (!current.includes(name)) productsOf.set(link.contactId, [...current, name]);
  }
  const productCounts = new Map<string, number>();
  for (const conversation of conversations) {
    const channel = channelName.get(conversation.connectionId) || "Canal sem nome";
    channelCounts.set(channel, (channelCounts.get(channel) ?? 0) + 1);
    const names = productsOf.get(conversation.contactId) ?? [];
    if (!names.length) {
      productCounts.set("Sem produto", (productCounts.get("Sem produto") ?? 0) + 1);
      continue;
    }
    for (const name of names) productCounts.set(name, (productCounts.get(name) ?? 0) + 1);
  }
  const shares = (counts: Map<string, number>) =>
    [...counts.entries()]
      .filter(([, count]) => count > 0)
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], "pt-BR"))
      .map(([name, count]) => ({ name, count }));
  return { productShares: shares(productCounts), channelShares: shares(channelCounts) };
}

export function kanbanStageName(value: string) {
  return catalogName(value, 40);
}

export function moveKanbanStage(stages: string[], index: number, direction: -1 | 1) {
  const target = index + direction;
  if (index < 0 || index >= stages.length || target < 0 || target >= stages.length) return stages;
  const next = [...stages];
  const current = next[index];
  const other = next[target];
  if (!current || !other) return stages;
  next[index] = other;
  next[target] = current;
  return next;
}

export function catalogName(value: string, max = 80) {
  const clean = value.trim().replace(/\s+/g, " ");
  if (clean.length < 2 || clean.length > max) return "";
  return clean;
}

export function quickReplyText(value: string, max = 1000) {
  const clean = value.replace(/\r\n/g, "\n").trim();
  if (clean.length < 2 || clean.length > max) return "";
  return clean;
}

export function tagColorValue(value: string) {
  const match = /^#([0-9a-fA-F]{6})$/.exec(value.trim());
  return match ? `#${match[1].toLowerCase()}` : "";
}

export function tagInk(color: string) {
  const hex = tagColorValue(color);
  if (!hex) return "#111111";
  const red = Number.parseInt(hex.slice(1, 3), 16);
  const green = Number.parseInt(hex.slice(3, 5), 16);
  const blue = Number.parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * red + 0.587 * green + 0.114 * blue) / 255;
  return luminance > 0.62 ? "#1a1a1a" : "#ffffff";
}

export function keepWhatsappName(currentName: string, edited: boolean, pushName: string, phone: string) {
  if (edited) return currentName;
  const next = catalogName(pushName, 80);
  if (!next || next === phone.trim()) return currentName;
  return next;
}

export function contactFileLabel(mime: string, name: string) {
  const kind = `${mime} ${name}`.toLowerCase();
  if (kind.includes("audio")) return "Áudio";
  if (kind.includes("video")) return "Vídeo";
  if (kind.includes("image") || kind.includes("imagem")) return "Imagem";
  return "Arquivo";
}

const generatedMediaName = /^(imagem|audio|video)\.[a-z0-9]+$/i;

export function savedMediaTitle(mime: string, name: string) {
  const clean = name.trim();
  if (clean && !generatedMediaName.test(clean)) return clean;
  return contactFileLabel(mime, clean);
}

export type ChatbotContactProfile = {
  id: string;
  name: string;
  phone: string;
  avatarUrl: string;
  catalogReady: boolean;
  stageReady: boolean;
  stage: string;
  stages: string[];
  tags: { id: string; name: string; color: string; selected: boolean }[];
  products: { id: string; name: string; selected: boolean }[];
  files: { id: string; name: string; mime: string; createdAt: string; url: string }[];
  dealReady: boolean;
  negotiatedCents: number | null;
  clientOwnerId: string;
  note: string;
  document: string;
  rg: string;
  showDocument: boolean;
  showRg: boolean;
};

export type ChatbotClientRow = {
  id: string;
  name: string;
  phone: string;
  negotiatedCents: number | null;
  tags: string[];
  attendant: string;
  stage: string;
  products: string[];
};

export type ChatbotKanbanCard = {
  id: string;
  name: string;
  stage: string;
  products: string[];
  negotiatedCents: number | null;
};

export type ChatbotKanbanBoard = {
  ready: boolean;
  stages: string[];
  cards: ChatbotKanbanCard[];
};

export type ClientListFilters = {
  search: string;
  name: string;
  tag: string;
  attendant: string;
  stage: string;
  product: string;
};

export function clientPhoneLabel(phone: string) {
  if (whatsappGroupJid(phone)) return "Grupo";
  return whatsappMask(phone) || phone;
}

function uniqueLabels(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort((left, right) => left.localeCompare(right, "pt-BR"));
}

export function clientFilterOptions(clients: ChatbotClientRow[]) {
  return {
    name: uniqueLabels(clients.map((client) => client.name)),
    tag: uniqueLabels(clients.flatMap((client) => client.tags)),
    attendant: uniqueLabels(clients.map((client) => client.attendant)),
    stage: uniqueLabels(clients.map((client) => client.stage)),
    product: uniqueLabels(clients.flatMap((client) => client.products)),
  };
}

export function filterChatbotClients(clients: ChatbotClientRow[], filters: ClientListFilters) {
  const term = filters.search.trim().toLowerCase();
  const digits = term.replace(/\D/g, "");
  return clients.filter((client) => {
    if (filters.name && client.name !== filters.name) return false;
    if (filters.tag && !client.tags.includes(filters.tag)) return false;
    if (filters.attendant && client.attendant !== filters.attendant) return false;
    if (filters.stage && client.stage !== filters.stage) return false;
    if (filters.product && !client.products.includes(filters.product)) return false;
    if (!term) return true;
    const phone = clientPhoneLabel(client.phone).toLowerCase();
    return client.name.toLowerCase().includes(term) || phone.includes(term) || (digits.length > 0 && client.phone.includes(digits));
  });
}

export type ChatbotTag = { id: string; name: string; color: string };
export type ChatbotQuickReply = { id: string; title: string; text: string };
export type ChatbotCatalogItem = { id: string; name: string };

export const defaultRatingPrompt = "Seu atendimento foi encerrado. Como você avalia?";

export const ratingChoices = [
  { score: 1, label: "Péssimo" },
  { score: 2, label: "Ruim" },
  { score: 3, label: "Regular" },
  { score: 4, label: "Bom" },
  { score: 5, label: "Excelente" },
] as const;

export function ratingPrompt(value: unknown) {
  const clean = String(value ?? "")
    .trim()
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n");
  if (clean.length < 2 || clean.length > 300) return "";
  return clean;
}

export function ratingMessage(prompt: string) {
  const intro = ratingPrompt(prompt) || defaultRatingPrompt;
  const scale = ratingChoices.map((item) => `${item.score} — ${item.label}`).join("\n");
  return `${intro}\n\nResponda com o número da nota:\n${scale}`;
}

export function ratingScore(text: string) {
  const clean = text.trim().toLocaleLowerCase("pt-BR").replace(/\s+/g, " ");
  if (!clean || clean.length > 48) return null;
  for (const item of ratingChoices) {
    const label = item.label.toLocaleLowerCase("pt-BR");
    const score = String(item.score);
    if (clean === score || clean === label || clean === `nota ${score}`) return item.score;
    if (clean.startsWith(`${score} `) || clean.startsWith(`${score}—`) || clean.startsWith(`${score}-`) || clean.startsWith(`${score}.`)) return item.score;
  }
  return null;
}

export function ratingAverage(scores: number[]) {
  const valid = scores.filter((score) => Number.isInteger(score) && score >= 1 && score <= 5);
  if (!valid.length) return null;
  return Math.round((valid.reduce((sum, score) => sum + score, 0) / valid.length) * 10) / 10;
}

export function ratingAverageLabel(average: number | null) {
  if (average == null) return "—";
  return average.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

export const defaultQueueMinutes = 15;

export function queueMinutes(value: unknown) {
  const minutes = typeof value === "number" ? value : Number(String(value ?? "").trim());
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 480) return null;
  return minutes;
}

export function chatbotCompanyName(value: unknown) {
  const name = String(value ?? "").trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 120) return "";
  return name;
}

export const reactivationChoices = [15, 20, 30, 40, 60] as const;

export function reactivationMinutes(value: unknown) {
  const minutes = Number(value);
  return (reactivationChoices as readonly number[]).includes(minutes) ? minutes : 15;
}

export function reactivatesClosedConversation(closedAt: string, minutes: number, now: number) {
  const closed = Date.parse(closedAt);
  if (!Number.isFinite(closed)) return false;
  return now - closed < reactivationMinutes(minutes) * 60_000;
}

export const defaultOfflineNotice = "No momento não há atendentes disponíveis. Sua mensagem continua na fila e será atendida assim que alguém entrar.";

export function offlineNoticeText(value: unknown) {
  const text = String(value ?? "").trim();
  if (text.length < 2 || text.length > 300) return "";
  return text;
}

export function waitingMinutes(since: string, now = Date.now()) {
  const start = Date.parse(since);
  if (!Number.isFinite(start)) return 0;
  return Math.max(0, Math.floor((now - start) / 60_000));
}

export function noticeCue(
  previous: { messages: string[]; queues: string[] } | null,
  next: { messages: string[]; queues: string[] },
) {
  if (!previous) return { play: false, messages: next.messages.filter(Boolean).slice(-80), queues: next.queues.filter(Boolean) };
  const knownMessages = new Set(previous.messages);
  const knownQueues = new Set(previous.queues);
  const messages = next.messages.filter(Boolean);
  const queues = next.queues.filter(Boolean);
  const play = messages.some((id) => !knownMessages.has(id)) || queues.some((id) => !knownQueues.has(id));
  return {
    play,
    messages: [...new Set([...previous.messages, ...messages])].slice(-80),
    queues,
  };
}

export function noticePlayer(tabId: string, intents: { tabId: string; visible: boolean }[]) {
  const unique = new Map<string, { tabId: string; visible: boolean }>();
  for (const intent of intents) unique.set(intent.tabId, intent);
  const ranked = [...unique.values()].sort(
    (left, right) => Number(right.visible) - Number(left.visible) || left.tabId.localeCompare(right.tabId),
  );
  return ranked[0]?.tabId === tabId;
}

export function overdueQueue<T extends { since: string }>(rows: T[], limitMinutes: number, now = Date.now()) {
  const limit = queueMinutes(limitMinutes) ?? defaultQueueMinutes;
  return rows
    .map((row) => ({ ...row, waitingMinutes: waitingMinutes(row.since, now) }))
    .filter((row) => row.waitingMinutes >= limit)
    .sort((left, right) => right.waitingMinutes - left.waitingMinutes);
}

function findString(value: unknown, keys: string[]): string {
  if (!value || typeof value !== "object") return "";
  const record = value as Record<string, unknown>;
  for (const key of keys) {
    const current = record[key];
    if (typeof current === "string" && current.trim()) return current.trim();
  }
  for (const nested of Object.values(record)) {
    if (nested && typeof nested === "object") {
      const found = findString(nested, keys);
      if (found) return found;
    }
  }
  return "";
}
