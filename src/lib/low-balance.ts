export const lowBalanceLimitCents = 5000;

export const lowBalanceCreditUrl = "https://app.nexmeta.com.br/creditos-meta";

export function isLowMetaBalance(cents: number | null | undefined) {
  return typeof cents === "number" && Number.isFinite(cents) && cents <= lowBalanceLimitCents;
}

export function lowBalanceSignal(cents: number | null | undefined): "low" | "clear" | "unknown" {
  if (cents == null || !Number.isFinite(cents)) return "unknown";
  return isLowMetaBalance(cents) ? "low" : "clear";
}

export function shouldSendLowBalanceWhatsapp(low: boolean, alreadySent: boolean) {
  return low && !alreadySent;
}

const lowBalanceWhatsappReliableAfter = Date.parse("2026-10-09T00:00:00.000Z");

export function lowBalanceAlertStamp(now = Date.now()) {
  return new Date(Math.max(now, lowBalanceWhatsappReliableAfter)).toISOString();
}

export function lowBalanceAlreadyDelivered(sentAt: string | null | undefined) {
  if (!sentAt) return false;
  const at = Date.parse(sentAt);
  return Number.isFinite(at) && at >= lowBalanceWhatsappReliableAfter;
}

export function whatsappNumber(phone: string) {
  const digits = phone.replace(/\D/g, "");
  const local =
    digits.startsWith("55") && (digits.length === 12 || digits.length === 13)
      ? digits.slice(2)
      : digits;
  if (local.length !== 10 && local.length !== 11) return null;
  const area = local.slice(0, 2);
  const subscriber = local.slice(2);
  const mobile =
    subscriber.length === 8 && /^[6-9]/.test(subscriber) ? `9${subscriber}` : subscriber;
  if (mobile.length !== 8 && mobile.length !== 9) return null;
  return `55${area}${mobile}`;
}

const senderPhone = "5197979224";

export function evolutionInstanceName(payload: unknown, preferred: string) {
  const wanted = whatsappNumber(senderPhone);
  const matches = instanceHits(payload).filter((hit) => whatsappNumber(hit.number) === wanted);
  const open = matches.find((hit) => hit.open);
  if (open) return open.name;
  if (matches[0]) return matches[0].name;
  const named = preferred.trim();
  return named || null;
}

function instanceHits(payload: unknown) {
  const rows = Array.isArray(payload) ? payload : [];
  return rows.flatMap((row) => {
    const record = asRecord(row);
    if (!record) return [];
    const nested = asRecord(record["instance"]) ?? record;
    const name = textField(nested, "instanceName") || textField(nested, "name");
    const number =
      textField(nested, "number") ||
      textField(nested, "ownerJid") ||
      textField(nested, "owner") ||
      textField(nested, "wuid");
    const status =
      textField(nested, "connectionStatus") ||
      textField(nested, "status") ||
      textField(nested, "state");
    if (!name) return [];
    return [{ name, number, open: status === "open" }];
  });
}

function asRecord(value: unknown) {
  return value !== null && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function textField(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "string" ? value : "";
}

export function lowBalanceWhatsappText(name: string) {
  const who = name.trim() || "cliente";
  return `Olá ${who} o saldo de anúncio da plataforma META (Facebook e Instagram) está baixo.\nPara adicionar saldo e manter seus anúncios em veiculação, adicione saldo através do link a baixo`;
}

export function isGhostButtonResponse(raw: unknown) {
  try {
    const serialized = JSON.stringify(raw ?? "");
    if (!serialized.includes("viewOnceMessage")) return false;
    return !(
      serialized.includes("nativeFlowMessage") ||
      serialized.includes("interactiveMessage") ||
      serialized.includes("cta_url")
    );
  } catch {
    return false;
  }
}
