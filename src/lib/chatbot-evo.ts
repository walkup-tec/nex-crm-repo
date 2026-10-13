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
    mediaKind: "" | "image" | "video";
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

export function evolutionContactPhone(key: Record<string, unknown>) {
  const candidates = [key["remoteJidAlt"], key["senderPn"], key["participant"], key["remoteJid"]];
  let fallback = "";
  for (const candidate of candidates) {
    if (typeof candidate !== "string") continue;
    const phone = whatsappJidPhone(candidate);
    if (!phone) continue;
    if (!candidate.endsWith("@lid")) return phone;
    fallback = phone;
  }
  return fallback;
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

function mediaKindFromName(value: unknown): "" | "image" | "video" {
  if (value === "imageMessage") return "image";
  if (value === "videoMessage" || value === "ptvMessage") return "video";
  return "";
}

function mediaMime(value: unknown) {
  if (typeof value !== "string") return "";
  return value.split(";")[0]?.trim().toLowerCase() ?? "";
}

export function evolutionMessageContent(data: unknown): { text: string; mediaKind: "" | "image" | "video"; mediaMime: string } {
  const root = isRecord(data) ? data : {};
  const source = isRecord(root["message"]) ? root["message"] : root;
  const message = unwrapEvolutionMessage(source);
  const nested = isRecord(message["imageMessage"]) ? message["imageMessage"] : isRecord(message["videoMessage"]) ? message["videoMessage"] : isRecord(message["ptvMessage"]) ? message["ptvMessage"] : message;
  const mediaKind = mediaKindFromName(root["messageType"]) || mediaKindFromName(message["messageType"]) || (message["imageMessage"] ? "image" : message["videoMessage"] || message["ptvMessage"] ? "video" : "") || (mediaMime(nested["mimetype"]).startsWith("image/") ? "image" : mediaMime(nested["mimetype"]).startsWith("video/") ? "video" : "");
  if (!mediaKind) return { text: evolutionMessageText(message), mediaKind: "", mediaMime: "" };
  const caption = typeof nested["caption"] === "string" ? nested["caption"].trim() : "";
  return { text: caption, mediaKind, mediaMime: mediaMime(nested["mimetype"]) };
}

export function evolutionMediaFile(payload: unknown, hint: "" | "image" | "video" = ""): { mime: string; base64: string; kind: "" | "image" | "video" } {
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
    : mime.startsWith("image/") || named === "image" || named === "imageMessage"
      ? "image"
      : hint;
  if (!base64 || !kind || base64.length > 40_000_000) return { mime: "", base64: "", kind: "" };
  return { mime: mime || (kind === "video" ? "video/mp4" : "image/jpeg"), base64, kind };
}

export function evolutionMessageText(message: unknown): string {
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
