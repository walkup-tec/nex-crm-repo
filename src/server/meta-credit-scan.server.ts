import { extractBearerToken, secretsMatch } from "@/lib/chatgpt-integration";
import { scanMetaCreditBalancesAndAlert } from "@/server/meta-credit.server";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function cronSecrets() {
  const dedicated = process.env["META_LOW_BALANCE_CRON_SECRET"]?.trim() ?? "";
  const shared = process.env["CHATGPT_INTEGRATION_SECRET"]?.trim() ?? "";
  const previous = process.env["CHATGPT_INTEGRATION_SECRET_PREVIOUS"]?.trim() ?? "";
  return [dedicated, shared, previous].filter(Boolean);
}

export async function handleMetaLowBalanceScanRequest(request: Request): Promise<Response> {
  const secrets = cronSecrets();
  if (!secrets.length) {
    return json(500, {
      error: "cron_unconfigured",
      message: "Defina META_LOW_BALANCE_CRON_SECRET ou CHATGPT_INTEGRATION_SECRET no servidor.",
    });
  }

  const header = request.headers.get("authorization");
  const apiKey = request.headers.get("x-api-key") ?? request.headers.get("apikey") ?? "";
  const token = extractBearerToken(header) || apiKey;
  if (!token) {
    return json(401, { error: "unauthorized", message: "Bearer token obrigatório." });
  }
  const ok = secrets.some((secret) => secretsMatch(token, secret));
  if (!ok) {
    return json(401, { error: "unauthorized", message: "Credencial inválida." });
  }

  try {
    const result = await scanMetaCreditBalancesAndAlert();
    console.info("meta_low_balance_scan", JSON.stringify(result));
    return json(200, { ok: true, ...result });
  } catch (error) {
    console.error("meta_low_balance_scan", error instanceof Error ? error.message : "error");
    return json(500, {
      error: "scan_failed",
      message: "Não foi possível varrer os saldos Meta.",
    });
  }
}
