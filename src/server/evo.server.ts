import {
  evolutionInstanceName,
  lowBalanceCreditUrl,
  lowBalanceWhatsappText,
  whatsappNumber,
} from "@/lib/low-balance";

const senderPhone = "5197979224";
const hostEvolutionUrl = "http://172.17.0.1:30181";

export async function sendLowBalanceWhatsapp(phone: string, name: string) {
  const base = (envValue("EVO_API_URL", "EVOLUTION_API_URL") || hostEvolutionUrl).replace(
    /\/$/,
    "",
  );
  const key = envValue("EVO_API_KEY", "EVOLUTION_API_KEY", "AUTHENTICATION_API_KEY");
  const number = whatsappNumber(phone);
  if (!key || !number) {
    console.error("evo_low_balance", !key ? "missing_key" : "invalid_phone");
    return false;
  }
  const headers = { "content-type": "application/json", apikey: key };
  const preferred = envValue("EVO_INSTANCE", "EVOLUTION_INSTANCE");
  const listed = await evoGet(`${base}/instance/fetchInstances`, headers);
  const instance =
    (listed ? evolutionInstanceName(listed, preferred) : null) || preferred || senderPhone;
  const description = lowBalanceWhatsappText(name);
  const text = await evoPost(`${base}/message/sendText/${encodeURIComponent(instance)}`, headers, {
    number,
    text: `${description}\n${lowBalanceCreditUrl}`,
  });
  if (text) return true;
  return evoPost(`${base}/message/sendButtons/${encodeURIComponent(instance)}`, headers, {
    number,
    title: "Saldo Meta baixo",
    description,
    footer: "NEX Ads",
    buttons: [{ type: "url", displayText: "Adicionar Saldo", url: lowBalanceCreditUrl }],
  });
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

async function evoPost(url: string, headers: Record<string, string>, body: unknown) {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) {
      console.error("evo_low_balance", response.status);
      return false;
    }
    return true;
  } catch (error) {
    console.error("evo_low_balance", error instanceof Error ? error.name : "error");
    return false;
  }
}
