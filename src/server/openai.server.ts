import { extractOpenAiResponseText } from "@/lib/meta-ai-prompt";

function fail(message: string): never {
  throw new Error(message);
}

export function openaiConfigured() {
  return Boolean(process.env["OPENAI_API_KEY"]?.trim());
}

function openaiConfig() {
  const key = process.env["OPENAI_API_KEY"]?.trim() ?? "";
  if (!key) fail("A OpenAI ainda não está configurada no servidor (OPENAI_API_KEY).");
  const model = process.env["OPENAI_MODEL"]?.trim() || "gpt-4o-mini";
  const base = (process.env["OPENAI_API_URL"]?.trim() || "https://api.openai.com/v1/responses").replace(
    /\/$/,
    "",
  );
  return { key, model, url: base };
}

function openaiPublicError(status: number, text: string) {
  if (status === 401 || status === 403) return "A chave da OpenAI foi recusada.";
  if (status === 429) return "A OpenAI está limitando as requisições. Tente de novo em instantes.";
  try {
    const body = JSON.parse(text) as { error?: { message?: string } };
    const message = body.error?.message?.trim() ?? "";
    if (message && !/sk-|api[_-]?key|authorization/i.test(message)) return message.slice(0, 220);
  } catch {
    /* ignore */
  }
  return "Não foi possível obter a análise da OpenAI agora.";
}

export async function requestOpenAiAnalysis(input: {
  system: string;
  user: string;
}): Promise<{ model: string; text: string }> {
  const { key, model, url } = openaiConfig();
  const usesResponses = /\/responses$/i.test(url);
  const body = usesResponses
    ? {
        model,
        input: [
          { role: "system", content: input.system },
          { role: "user", content: input.user },
        ],
      }
    : {
        model,
        messages: [
          { role: "system", content: input.system },
          { role: "user", content: input.user },
        ],
      };

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        authorization: `Bearer ${key}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120000),
    });
  } catch (error) {
    console.error("openai_network", error instanceof Error ? error.name : "error");
    fail("Não foi possível falar com a OpenAI. Tente de novo.");
  }

  const text = await response.text();
  if (!response.ok) fail(openaiPublicError(response.status, text));

  let parsed: unknown = {};
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    fail("A OpenAI devolveu uma resposta inválida.");
  }

  const analysis = extractOpenAiResponseText(parsed);
  if (!analysis) fail("A OpenAI não devolveu texto de análise.");
  return { model, text: analysis };
}
