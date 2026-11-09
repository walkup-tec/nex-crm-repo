import { readFileSync } from "node:fs";
import { readProviderMessageId } from "@/lib/billing-notice";
import { whatsappTextPayload } from "@/lib/chatbot-evo";
import { evolutionBaseUrls, gatewayFromProcRoute } from "@/lib/evolution-route";
import {
  inviteAccessLink,
  invitePasswordButton,
  inviteSubject,
  inviteWhatsappDescription,
} from "@/lib/invite-message";
import {
  evolutionInstanceName,
  isGhostButtonResponse,
  lowBalanceCreditUrl,
  lowBalanceWhatsappText,
  lowBalanceWhatsappTitle,
  whatsappNumber,
} from "@/lib/low-balance";

const closedSenderInstance = "walkup-v2";
const hostEvolutionUrl = "http://172.17.0.1:30181";
const publicEvolutionUrl = "http://72.60.51.127:30181";
const draxEvolutionKey = "429683C4C977415CAAFCCE10F7D57E11";

export function evolutionRuntime() {
  const base = (envValue("EVO_API_URL", "EVOLUTION_API_URL") || hostEvolutionUrl).replace(
    /\/$/,
    "",
  );
  const key =
    envValue("EVO_API_KEY", "EVOLUTION_API_KEY", "AUTHENTICATION_API_KEY") || draxEvolutionKey;
  return { base, key };
}

export async function sendLowBalanceWhatsapp(phone: string, name: string) {
  const number = whatsappNumber(phone);
  if (!number) {
    console.error("evo_low_balance", "invalid_phone");
    return false;
  }
  const target = await openEvolutionTarget("evo_low_balance");
  if (!target) {
    console.error("evo_low_balance", "no_open_instance");
    return false;
  }
  const { base, headers, instance } = target;
  const description = lowBalanceWhatsappText(name);
  const button = await evoPost(
    `${base}/message/sendButtons/${encodeURIComponent(instance)}`,
    headers,
    {
      number,
      title: lowBalanceWhatsappTitle,
      description,
      footer: "",
      buttons: [{ type: "url", displayText: "Adicionar Saldo", url: lowBalanceCreditUrl }],
    },
  );
  if (button.ok && !isGhostButtonResponse(button.body)) return true;
  const text = await evoPost(`${base}/message/sendText/${encodeURIComponent(instance)}`, headers, {
    number,
    text: `*${lowBalanceWhatsappTitle}*\n\n${description}\n${lowBalanceCreditUrl}`,
  });
  return text.ok;
}

export async function sendInviteWhatsapp(phone: string, name: string, email: string) {
  const number = whatsappNumber(phone);
  if (!number || !email.trim()) return false;
  const target = await openEvolutionTarget("evo_invite");
  if (!target) {
    console.error("evo_invite", "no_open_instance");
    return false;
  }
  const { base, headers, instance } = target;
  const link = inviteAccessLink(inviteAppUrl(), email);
  const description = inviteWhatsappDescription(name, email);
  const button = await evoPost(
    `${base}/message/sendButtons/${encodeURIComponent(instance)}`,
    headers,
    {
      number,
      title: inviteSubject,
      description,
      footer: "",
      buttons: [{ type: "url", displayText: invitePasswordButton, url: link }],
    },
    20000,
    "evo_invite",
  );
  if (button.ok && !isGhostButtonResponse(button.body)) return true;
  const text = await evoPost(
    `${base}/message/sendText/${encodeURIComponent(instance)}`,
    headers,
    {
      number,
      text: `*${inviteSubject}*\n\n${description}\n\n${invitePasswordButton}\n${link}`,
    },
    20000,
    "evo_invite",
  );
  return text.ok;
}

/** Texto simples via Evolution (NEX Intelligence → cliente). */
export async function sendPlainWhatsapp(input: { phone: string; text: string }) {
  const number = whatsappNumber(input.phone);
  if (!number) return { ok: false as const, messageId: "", error: "Telefone WhatsApp do cliente inválido." };
  const clean = input.text.trim();
  if (!clean) return { ok: false as const, messageId: "", error: "Mensagem vazia." };
  const target = await openEvolutionTarget("evo_intelligence");
  if (!target) {
    console.error("evo_intelligence", "no_open_instance");
    return {
      ok: false as const,
      messageId: "",
      error: "Nenhuma instância do WhatsApp está conectada.",
    };
  }
  const { base, headers, instance } = target;
  const text = await evoPost(
    `${base}/message/sendText/${encodeURIComponent(instance)}`,
    headers,
    whatsappTextPayload(number, clean),
    20000,
    "evo_intelligence",
  );
  const messageId = readProviderMessageId(text.body);
  if (!text.ok) {
    return {
      ok: false as const,
      messageId,
      error: evolutionFailureMessage(text.body, "O WhatsApp não confirmou a mensagem."),
    };
  }
  return { ok: true as const, messageId, error: "" };
}

export async function sendFinanceWhatsapp(input: { phone: string; text: string; imagePng: Uint8Array }) {
  const number = whatsappNumber(input.phone);
  if (!number) return { ok: false, messageId: "", error: "Telefone financeiro inválido." };
  if (input.imagePng.byteLength === 0) return { ok: false, messageId: "", error: "A imagem da fatura não foi gerada." };
  const target = await openEvolutionTarget("evo_finance");
  if (!target) {
    console.error("evo_finance", "no_open_instance");
    return {
      ok: false,
      messageId: "",
      error: "Nenhuma instância do WhatsApp financeiro está conectada.",
    };
  }
  const { base, headers, instance } = target;
  const registered = await whatsappNumberExists(base, headers, instance, number, "evo_finance");
  if (registered === false) {
    return {
      ok: false,
      messageId: "",
      error: "O telefone financeiro não está no WhatsApp ou está inválido.",
    };
  }
  // Pix EMV parece URL; linkPreview ativo faz a Evolution falhar/timeout no sendText.
  const text = await evoPost(
    `${base}/message/sendText/${encodeURIComponent(instance)}`,
    headers,
    whatsappTextPayload(number, input.text),
    20000,
    "evo_finance",
  );
  const messageId = readProviderMessageId(text.body);
  if (!text.ok) {
    return {
      ok: false,
      messageId,
      error: evolutionFailureMessage(text.body, "O WhatsApp não confirmou a mensagem."),
    };
  }
  const image = await evoPost(
    `${base}/message/sendMedia/${encodeURIComponent(instance)}`,
    headers,
    {
      number,
      mediatype: "image",
      mimetype: "image/png",
      caption: "Fatura para pagamento",
      media: Buffer.from(input.imagePng).toString("base64"),
      fileName: "cobranca.png",
    },
    60000,
    "evo_finance",
  );
  if (!image.ok) {
    return {
      ok: true,
      messageId: messageId || readProviderMessageId(image.body),
      error: "A mensagem foi enviada, mas a imagem da fatura não foi confirmada.",
    };
  }
  return { ok: true, messageId: messageId || readProviderMessageId(image.body), error: "" };
}

async function openEvolutionTarget(tag: string) {
  const runtime = evolutionRuntime();
  const keys = runtime.key === draxEvolutionKey ? [runtime.key] : [runtime.key, draxEvolutionKey];
  const bases = evolutionBaseUrls({
    configured: runtime.base,
    gateway: hostGateway(),
    hostUrl: hostEvolutionUrl,
    publicUrl: publicEvolutionUrl,
  });
  const preferred = envValue("EVO_INSTANCE", "EVOLUTION_INSTANCE");
  const attempts: string[] = [];
  for (const key of keys) {
    const headers = { "content-type": "application/json", apikey: key };
    for (const base of bases) {
      const listed = await evoGet(`${base}/instance/fetchInstances`, headers, tag, 8000);
      const instance = listed ? evolutionInstanceName(listed, preferred === closedSenderInstance ? "" : preferred) : null;
      attempts.push(`${reachLabel(base)}=${listed ? (instance && instance !== closedSenderInstance ? "open" : "closed") : "down"}`);
      if (!listed || !instance || instance === closedSenderInstance) continue;
      rememberEvolutionReach(attempts.join(" "));
      console.error(tag, "instance", instance);
      return { base, headers, instance };
    }
  }
  rememberEvolutionReach(attempts.join(" "));
  return null;
}

export async function probeFinanceEvolution() {
  await openEvolutionTarget("evo_finance");
}

function reachLabel(base: string) {
  if (base.includes("127.0.0.1")) return "local";
  if (base.includes("host.docker.internal")) return "internal";
  if (base.includes("172.17.0.1")) return "bridge";
  if (base.includes("72.60.51.127")) return "public";
  if (/^http:\/\/172\.(1[6-9]|2\d|3[0-1])\./.test(base)) return "gateway";
  return "configured";
}

function rememberEvolutionReach(value: string) {
  (globalThis as typeof globalThis & { __NEX_EVO_REACH?: string }).__NEX_EVO_REACH = value.slice(0, 180);
}

function hostGateway() {
  try {
    return gatewayFromProcRoute(readFileSync("/proc/net/route", "utf8"));
  } catch {
    return "";
  }
}

function inviteAppUrl() {
  return (process.env["APP_URL"] || "https://app.nexmeta.com.br").replace(/\/$/, "");
}

function envValue(...names: string[]) {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  return "";
}

async function evoGet(url: string, headers: Record<string, string>, tag = "evo_low_balance", timeoutMs = 20000) {
  try {
    const response = await fetch(url, { headers, signal: AbortSignal.timeout(timeoutMs) });
    if (!response.ok) {
      console.error(tag, response.status);
      return null;
    }
    return (await response.json()) as unknown;
  } catch (error) {
    console.error(tag, error instanceof Error ? error.name : "error");
    return null;
  }
}

async function evoPost(
  url: string,
  headers: Record<string, string>,
  payload: unknown,
  timeoutMs = 20000,
  tag = "evo_low_balance",
) {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const raw = await response.text();
    let body: unknown = raw;
    if (raw) {
      try {
        body = JSON.parse(raw) as unknown;
      } catch {
        body = raw;
      }
    }
    if (!response.ok) {
      console.error(tag, response.status, summarizeEvoBody(body));
      return { ok: false, body };
    }
    return { ok: true, body };
  } catch (error) {
    const name = error instanceof Error ? error.name : "error";
    console.error(tag, name);
    return {
      ok: false,
      body: name === "TimeoutError" || name === "AbortError" ? { message: "Tempo esgotado ao falar com o WhatsApp." } : null,
    };
  }
}

async function whatsappNumberExists(
  base: string,
  headers: Record<string, string>,
  instance: string,
  number: string,
  tag: string,
) {
  const checked = await evoPost(
    `${base}/chat/whatsappNumbers/${encodeURIComponent(instance)}`,
    headers,
    { numbers: [number] },
    12000,
    tag,
  );
  if (!checked.ok || checked.body == null) return null;
  const rows = evolutionNumberRows(checked.body);
  const hit = rows.find((row) => {
    const candidate = String(row["number"] ?? "").replace(/\D/g, "");
    return candidate === number || candidate.endsWith(number.slice(-11));
  });
  if (!hit) return null;
  return hit["exists"] === true;
}

function evolutionNumberRows(body: unknown) {
  const lists = Array.isArray(body)
    ? [body]
    : body && typeof body === "object"
      ? Object.values(body as Record<string, unknown>).filter(Array.isArray)
      : [];
  const rows = (lists[0] as unknown[] | undefined) ?? [];
  return rows.flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    return [row as Record<string, unknown>];
  });
}

function evolutionFailureMessage(body: unknown, fallback: string) {
  const detail = summarizeEvoBody(body).trim();
  if (!detail) return fallback;
  if (/tempo esgotado|timeout/i.test(detail)) {
    return "O WhatsApp demorou demais para confirmar a mensagem. Tente de novo em instantes.";
  }
  if (/not.*(in|on).*whatsapp|exists\s*[:=]\s*false|número.*(inválido|inexistente)|invalid.*(number|jid)/i.test(detail)) {
    return "O telefone financeiro não está no WhatsApp ou está inválido.";
  }
  if (/connect|closed|logout|session/i.test(detail)) {
    return "A instância do WhatsApp financeiro desconectou. Reconecte e tente de novo.";
  }
  if (/^bad request$/i.test(detail)) return fallback;
  return detail.length <= 160 ? detail : fallback;
}

function summarizeEvoBody(body: unknown) {
  if (body == null) return "";
  if (typeof body === "string") return body.slice(0, 240);
  if (typeof body !== "object") return String(body).slice(0, 240);
  const record = body as Record<string, unknown>;
  const response = record["response"];
  const fromResponse =
    response && typeof response === "object"
      ? flattenEvoMessages((response as Record<string, unknown>)["message"] ?? response)
      : "";
  if (fromResponse) return fromResponse;
  const fromMessage = flattenEvoMessages(record["message"]);
  if (fromMessage) return fromMessage;
  for (const key of ["error", "msg"]) {
    const value = record[key];
    if (typeof value === "string" && value.trim() && !/^bad request|internal server error|unauthorized|forbidden|not found$/i.test(value.trim())) {
      return value.trim().slice(0, 240);
    }
  }
  try {
    return JSON.stringify(body).slice(0, 240);
  } catch {
    return "";
  }
}

function flattenEvoMessages(value: unknown): string {
  if (typeof value === "string" && value.trim()) return value.trim().slice(0, 240);
  if (Array.isArray(value)) {
    return value
      .map((item) => flattenEvoMessages(item))
      .filter(Boolean)
      .join("; ")
      .slice(0, 240);
  }
  if (!value || typeof value !== "object") return "";
  const record = value as Record<string, unknown>;
  if (record["exists"] === false) {
    const number = typeof record["number"] === "string" ? record["number"] : "";
    return number ? `exists:false number=${number}` : "exists:false";
  }
  const nested = record["message"] ?? record["error"] ?? record["msg"];
  if (nested !== undefined) return flattenEvoMessages(nested);
  return "";
}
