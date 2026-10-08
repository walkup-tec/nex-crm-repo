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

export function whatsappNumber(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) return digits;
  return null;
}

export function lowBalanceWhatsappText(name: string) {
  const who = name.trim() || "cliente";
  return `Olá ${who} o saldo de anúncio da plataforma META (Facebook e Instagram) está baixo.\nPara adicionar saldo e manter seus anúncios em veiculação, adicione saldo através do link a baixo`;
}
