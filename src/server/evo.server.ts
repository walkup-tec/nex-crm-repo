import { lowBalanceCreditUrl, lowBalanceWhatsappText, whatsappNumber } from "@/lib/low-balance";

const instancePhone = "5197979224";

export async function sendLowBalanceWhatsapp(phone: string, name: string) {
  const base = process.env["EVO_API_URL"]?.trim().replace(/\/$/, "");
  const key = process.env["EVO_API_KEY"]?.trim();
  const instance = process.env["EVO_INSTANCE"]?.trim() || instancePhone;
  const number = whatsappNumber(phone);
  if (!base || !key || !number) {
    console.error("evo_low_balance", !base || !key ? "missing_env" : "invalid_phone");
    return false;
  }
  const description = lowBalanceWhatsappText(name);
  const headers = { "content-type": "application/json", apikey: key };
  const button = await evoPost(
    `${base}/message/sendButtons/${encodeURIComponent(instance)}`,
    headers,
    {
      number,
      title: "Saldo Meta baixo",
      description,
      footer: "NEX Ads",
      buttons: [{ type: "url", displayText: "Adicionar Saldo", url: lowBalanceCreditUrl }],
    },
  );
  if (button) return true;
  return evoPost(`${base}/message/sendText/${encodeURIComponent(instance)}`, headers, {
    number,
    text: `${description}\n${lowBalanceCreditUrl}`,
  });
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
