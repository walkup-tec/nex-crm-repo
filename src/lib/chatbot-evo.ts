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
  contacts: { id: string; name: string; phone: string; avatarUrl: string }[];
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
  }[];
};

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

export function pendingOutgoing<T extends { conversationId: string; direction: string; text: string; createdAt: string }>(
  saved: T[],
  previews: { id: string; conversationId: string; text: string; createdAt: string }[],
) {
  const consumed = saved.filter((message) => message.direction === "out");
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

export function evolutionMessageText(message: unknown): string {
  if (typeof message === "string") return message.trim();
  if (!message || typeof message !== "object") return "";
  const record = message as Record<string, unknown>;
  if (typeof record["conversation"] === "string") return record["conversation"];
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

export const defaultKanbanStages = ["Novos leads", "Qualificação", "Proposta", "Negociação", "Ganho"];

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
  catalogReady: boolean;
  tags: { id: string; name: string; color: string; selected: boolean }[];
  products: { id: string; name: string; selected: boolean }[];
  files: { id: string; name: string; mime: string; createdAt: string; url: string }[];
};

export type ChatbotTag = { id: string; name: string; color: string };
export type ChatbotCatalogItem = { id: string; name: string };

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
