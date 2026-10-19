import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import https from "node:https";
import { resolveCoraSettings, type CoraSettings } from "@/lib/cora-connection";

function idempotencyKey(code: string) {
  const hash = createHash("sha256").update(code).digest();
  const bytes = Uint8Array.from(hash.subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Buffer.from(bytes).toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

type CoraInvoiceResult = {
  id: string;
  url: string;
  pixCode: string;
};

function fail(message: string): never {
  throw new Error(message);
}

function pemEnv(valueName: string, pathName: string) {
  const inline = process.env[valueName] ?? "";
  if (inline.trim()) return inline;
  const path = process.env[pathName]?.trim() ?? "";
  if (!path) return "";
  try {
    return readFileSync(path, "utf8");
  } catch {
    return "";
  }
}

function coraRuntime() {
  return resolveCoraSettings({
    id: process.env["CORA_CLIENT_ID"],
    secret: process.env["CORA_CLIENT_SECRET"],
    base: process.env["CORA_API_URL"],
    cert: pemEnv("CORA_CERT", "CORA_CERT_PATH"),
    key: pemEnv("CORA_KEY", "CORA_KEY_PATH"),
  });
}

function coraRequest(
  settings: CoraSettings,
  path: string,
  method: "GET" | "POST" | "DELETE",
  headers: Record<string, string>,
  body?: string,
) {
  const target = new URL(`${settings.base}${path}`);
  return new Promise<{ status: number; text: string }>((resolve, reject) => {
    const request = https.request(
      {
        hostname: target.hostname,
        path: `${target.pathname}${target.search}`,
        method,
        headers,
        cert: settings.cert || undefined,
        key: settings.key || undefined,
        timeout: 20000,
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer) => chunks.push(chunk));
        response.on("end", () => {
          resolve({ status: response.statusCode ?? 0, text: Buffer.concat(chunks).toString("utf8") });
        });
      },
    );
    request.on("timeout", () => {
      request.destroy();
      reject(new Error("A Cora não respondeu."));
    });
    request.on("error", () => reject(new Error("Não foi possível falar com a Cora.")));
    if (body) request.write(body);
    request.end();
  });
}

function coraMessage(text: string) {
  try {
    const body = JSON.parse(text) as { message?: string; errors?: { message?: string }[] };
    const detail = (body.errors ?? []).map((item) => item.message ?? "").filter(Boolean).join(" ");
    const message = [body.message, detail].filter(Boolean).join(" ");
    if (!message || /secret|token|authorization|client_id/i.test(message)) return "";
    return message.slice(0, 240);
  } catch {
    return "";
  }
}

let cachedToken = { value: "", expiresAt: 0 };

async function coraToken() {
  if (cachedToken.value && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;
  const settings = coraRuntime();
  const headers: Record<string, string> = { "content-type": "application/x-www-form-urlencoded" };
  let form = "grant_type=client_credentials";
  if (settings.direct) form += `&client_id=${encodeURIComponent(settings.id)}`;
  else headers.authorization = `Basic ${Buffer.from(`${settings.id}:${settings.secret}`).toString("base64")}`;
  const response = await coraRequest(settings, settings.direct ? "/token" : "/oauth/token", "POST", headers, form);
  const text = response.text;
  if (response.status < 200 || response.status >= 300) fail(coraMessage(text) || "A Cora recusou as credenciais.");
  const body = JSON.parse(text) as { access_token?: string; expires_in?: number };
  if (!body.access_token) fail("A Cora não devolveu o acesso.");
  cachedToken = {
    value: body.access_token,
    expiresAt: Date.now() + Math.max(60, body.expires_in ?? 3600) * 1000,
  };
  return body.access_token;
}

function textOf(value: unknown) {
  return typeof value === "string" ? value : "";
}

export async function createCoraInvoice(input: {
  code: string;
  name: string;
  email: string;
  document: string;
  amountCents: number;
  paymentTerms: { due_date: string; fine?: { amount: number } | { rate: number }; interest?: { rate: number } };
}): Promise<CoraInvoiceResult> {
  const settings = coraRuntime();
  const token = await coraToken();
  const response = await coraRequest(
    settings,
    "/v2/invoices",
    "POST",
    {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      "idempotency-key": idempotencyKey(input.code),
    },
    JSON.stringify({
      code: input.code.slice(0, 64),
      customer: {
        name: input.name.slice(0, 60),
        email: input.email.slice(0, 60),
        document: {
          identity: input.document,
          type: input.document.length === 14 ? "CNPJ" : "CPF",
        },
      },
      services: [
        {
          name: "Mensalidade Nex",
          description: "Mensalidade do contrato Nex",
          amount: input.amountCents,
        },
      ],
      payment_terms: input.paymentTerms,
      payment_forms: ["PIX"],
    }),
  );
  const text = response.text;
  if (response.status === 401 || response.status === 403) fail("A Cora recusou o acesso para emitir a cobrança.");
  if (response.status < 200 || response.status >= 300) fail(coraMessage(text) || "Não foi possível gerar a cobrança na Cora.");
  const body = JSON.parse(text) as Record<string, unknown>;
  const id = textOf(body["id"]);
  if (!id) fail("A Cora não devolveu a cobrança.");
  const options = body["payment_options"];
  const slip = options && typeof options === "object" ? (options as Record<string, unknown>)["bank_slip"] : null;
  const slipRecord = slip && typeof slip === "object" ? (slip as Record<string, unknown>) : {};
  if (textOf(slipRecord["barcode"]) || textOf(slipRecord["digitable"])) {
    fail("A Cora devolveu um boleto. A cobrança precisa ser somente Pix.");
  }
  const pix = body["pix"];
  const pixRecord = pix && typeof pix === "object" ? (pix as Record<string, unknown>) : {};
  const pixCode = textOf(pixRecord["emv"]);
  if (!pixCode) fail("A Cora não devolveu o código Pix.");
  return {
    id,
    url: textOf(slipRecord["url"]),
    pixCode,
  };
}

function invoicePath(id: string) {
  const invoiceId = id.trim();
  if (!invoiceId) fail("A cobrança da Cora não tem identificador.");
  return `/v2/invoices/${encodeURIComponent(invoiceId)}`;
}

export async function readCoraInvoice(id: string) {
  const settings = coraRuntime();
  const token = await coraToken();
  const response = await coraRequest(settings, invoicePath(id), "GET", { authorization: `Bearer ${token}` });
  if (response.status === 404) return { status: "CANCELLED", paidAt: null };
  if (response.status === 401 || response.status === 403) fail("A Cora recusou o acesso para consultar a cobrança.");
  if (response.status < 200 || response.status >= 300) fail(coraMessage(response.text) || "Não foi possível consultar a cobrança na Cora.");
  const body = JSON.parse(response.text) as { status?: string; occurrence_date?: string | null };
  const paidAt = textOf(body.occurrence_date);
  return { status: textOf(body.status).toUpperCase(), paidAt: paidAt || null };
}

export async function cancelCoraInvoice(id: string) {
  const current = await readCoraInvoice(id);
  if (current.status === "PAID") fail("Esta cobrança já foi paga na Cora.");
  if (current.status === "CANCELLED") return;
  const settings = coraRuntime();
  const token = await coraToken();
  const response = await coraRequest(settings, invoicePath(id), "DELETE", { authorization: `Bearer ${token}` });
  if (response.status === 204 || response.status === 200 || response.status === 404) return;
  if (response.status === 422 && /pago|paid|REC-0006/i.test(response.text)) fail("Esta cobrança já foi paga na Cora.");
  if (response.status === 401 || response.status === 403) fail("A Cora recusou o acesso para cancelar a cobrança.");
  fail(coraMessage(response.text) || "Não foi possível cancelar a cobrança na Cora.");
}

let paidWebhookReady = false;

export async function ensureCoraPaidWebhook() {
  if (paidWebhookReady) return;
  const base = (process.env["APP_URL"] || "https://app.nexmeta.com.br").replace(/\/$/, "");
  const url = `${base}/api/cora/webhook`;
  const settings = coraRuntime();
  const token = await coraToken();
  const headers = { authorization: `Bearer ${token}`, "content-type": "application/json" };
  const created = await coraRequest(
    settings,
    "/v2/webhooks",
    "POST",
    { ...headers, "idempotency-key": idempotencyKey(`cora-paid-webhook:${url}`) },
    JSON.stringify({ url, resource: "invoice", trigger: "paid" }),
  );
  if ((created.status >= 200 && created.status < 300) || created.status === 409) {
    paidWebhookReady = true;
    return;
  }
  console.error("cora_webhook_register", created.status, coraMessage(created.text) || "falha");
}
