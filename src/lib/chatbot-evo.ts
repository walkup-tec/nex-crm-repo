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
  contacts: { id: string; name: string; phone: string }[];
  conversations: {
    id: string;
    contactId: string;
    connectionId: string;
    status: "queue" | "active" | "closed";
  }[];
  messages: {
    id: string;
    conversationId: string;
    text: string;
    direction: "in" | "out";
    status: "pending" | "sent" | "failed";
    createdAt: string;
  }[];
};

export function chatbotInstanceName(organizationId: string) {
  const org = organizationId.replace(/[^a-z0-9]/gi, "").slice(0, 12).toLowerCase();
  const stamp = Date.now().toString(36);
  return `nex${org}${stamp}`.slice(0, 40);
}

export function whatsappMask(value: string) {
  const raw = value.replace(/\D/g, "");
  const digits = (raw.startsWith("55") && raw.length > 11 ? raw.slice(2) : raw).slice(0, 11);
  if (!digits) return "";
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
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

export function evolutionQrImage(payload: unknown): string {
  const found = findString(payload, ["base64", "qrcode"]);
  if (!found) return "";
  if (found.startsWith("data:image")) return found;
  if (/^[A-Za-z0-9+/=]+$/.test(found) && found.length > 80) return `data:image/png;base64,${found}`;
  return "";
}

export function evolutionIncomingMessages(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data.filter(isRecord);
  if (!isRecord(data)) return [];
  const messages = data["messages"];
  if (Array.isArray(messages)) return messages.filter(isRecord);
  if (data["key"] || data["message"]) return [data];
  return [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function evolutionMessageText(message: unknown): string {
  if (!message || typeof message !== "object") return "";
  const record = message as Record<string, unknown>;
  if (typeof record["conversation"] === "string") return record["conversation"];
  const extended = record["extendedTextMessage"];
  if (extended && typeof extended === "object" && typeof (extended as { text?: unknown }).text === "string") {
    return (extended as { text: string }).text;
  }
  if (record["imageMessage"]) return "[imagem]";
  if (record["audioMessage"]) return "[áudio]";
  if (record["videoMessage"]) return "[vídeo]";
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
