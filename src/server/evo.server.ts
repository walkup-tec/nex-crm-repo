import {
  evolutionInstanceName,
  isGhostButtonResponse,
  lowBalanceCreditUrl,
  lowBalanceWhatsappText,
  whatsappNumber,
} from "@/lib/low-balance";

const senderInstance = "walkup-v2";
const hostEvolutionUrl = "http://172.17.0.1:30181";
const draxEvolutionKey = "429683C4C977415CAAFCCE10F7D57E11";

export async function sendLowBalanceWhatsapp(phone: string, name: string) {
  const base = (envValue("EVO_API_URL", "EVOLUTION_API_URL") || hostEvolutionUrl).replace(
    /\/$/,
    "",
  );
  const key =
    envValue("EVO_API_KEY", "EVOLUTION_API_KEY", "AUTHENTICATION_API_KEY") || draxEvolutionKey;
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
      title: "\u00A0",
      description,
      footer: "",
      buttons: [{ type: "url", displayText: "Adicionar Saldo", url: lowBalanceCreditUrl }],
    },
  );
  if (button.ok && !isGhostButtonResponse(button.body)) return true;
  const text = await evoPost(`${base}/message/sendText/${encodeURIComponent(instance)}`, headers, {
    number,
    text: `${description}\n${lowBalanceCreditUrl}`,
  });
  return text.ok;
}

function envValue(...names: string[]) {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  return "";
}

async function evoGet(url: string, headers: Record<string, string>) {
  try {
    const response = await fetch(url, { headers, signal: AbortSignal.timeout(20000) });
    if (!response.ok) {
      console.error("evo_low_balance", response.status);
      return null;
    }
    return (await response.json()) as unknown;
  } catch (error) {
    console.error("evo_low_balance", error instanceof Error ? error.name : "error");
    return null;
  }
}

async function evoPost(url: string, headers: Record<string, string>, payload: unknown) {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(20000),
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
      console.error("evo_low_balance", response.status);
      return { ok: false, body };
    }
    return { ok: true, body };
  } catch (error) {
    console.error("evo_low_balance", error instanceof Error ? error.name : "error");
    return { ok: false, body: null };
  }
}
