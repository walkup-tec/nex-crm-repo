import { readProviderMessageId } from "@/lib/billing-notice";
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

const senderInstance = "walkup-v2";
const hostEvolutionUrl = "http://172.17.0.1:30181";
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
  const { base, key } = evolutionRuntime();
  const number = whatsappNumber(phone);
  if (!number) {
    console.error("evo_low_balance", "invalid_phone");
    return false;
  }
  const headers = { "content-type": "application/json", apikey: key };
  const preferred = envValue("EVO_INSTANCE", "EVOLUTION_INSTANCE");
  const listed = await evoGet(`${base}/instance/fetchInstances`, headers);
  const instance =
    (listed ? evolutionInstanceName(listed, preferred) : null) || preferred || senderInstance;
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
  const { base, key } = evolutionRuntime();
  const headers = { "content-type": "application/json", apikey: key };
  const preferred = envValue("EVO_INSTANCE", "EVOLUTION_INSTANCE");
  const listed = await evoGet(`${base}/instance/fetchInstances`, headers, "evo_invite");
  const instance = (listed ? evolutionInstanceName(listed, preferred) : null) || preferred || senderInstance;
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

export async function sendFinanceWhatsapp(input: { phone: string; text: string; imagePng: Uint8Array }) {
  const number = whatsappNumber(input.phone);
  if (!number) return { ok: false, messageId: "", error: "Telefone financeiro inválido." };
  if (input.imagePng.byteLength === 0) return { ok: false, messageId: "", error: "A imagem da fatura não foi gerada." };
  const { base, key } = evolutionRuntime();
  const headers = { "content-type": "application/json", apikey: key };
  const preferred = envValue("EVO_INSTANCE", "EVOLUTION_INSTANCE");
  const listed = await evoGet(`${base}/instance/fetchInstances`, headers, "evo_finance");
  const instance = (listed ? evolutionInstanceName(listed, preferred) : null) || preferred || senderInstance;
  const text = await evoPost(
    `${base}/message/sendText/${encodeURIComponent(instance)}`,
    headers,
    {
      number,
      text: input.text,
    },
    20000,
    "evo_finance",
  );
  const messageId = readProviderMessageId(text.body);
  if (!text.ok) return { ok: false, messageId, error: "O WhatsApp não confirmou a mensagem." };
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

async function evoGet(url: string, headers: Record<string, string>, tag = "evo_low_balance") {
  try {
    const response = await fetch(url, { headers, signal: AbortSignal.timeout(20000) });
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
      console.error(tag, response.status);
      return { ok: false, body };
    }
    return { ok: true, body };
  } catch (error) {
    console.error(tag, error instanceof Error ? error.name : "error");
    return { ok: false, body: null };
  }
}
