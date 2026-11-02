import type { NexMetaAnalysisV1 } from "@/lib/meta-export";

export type { MetaAiAnalysisResult } from "@/lib/meta-ai-calibration";

export function metaAiUserPrompt(payload: NexMetaAnalysisV1) {
  return [
    "Analise o desempenho Meta Ads deste export NEX (schema 1.0.0).",
    `Cliente: ${payload.metadata.client_name}`,
    `Conta: ${payload.account.name} (${payload.account.id})`,
    `Período: ${payload.period.since ?? "?"} a ${payload.period.until ?? "?"} (${payload.period.timezone})`,
    `Moeda: ${payload.metadata.currency}`,
    "",
    "JSON:",
    JSON.stringify(payload),
  ].join("\n");
}

export function extractOpenAiResponseText(body: unknown): string {
  if (!body || typeof body !== "object") return "";
  const root = body as Record<string, unknown>;
  if (typeof root.output_text === "string" && root.output_text.trim()) return root.output_text.trim();

  const output = Array.isArray(root.output) ? root.output : [];
  const chunks: string[] = [];
  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    if (typeof row.text === "string" && row.text.trim()) {
      chunks.push(row.text.trim());
      continue;
    }
    const content = Array.isArray(row.content) ? row.content : [];
    for (const part of content) {
      if (!part || typeof part !== "object") continue;
      const piece = part as Record<string, unknown>;
      if (typeof piece.text === "string" && piece.text.trim()) chunks.push(piece.text.trim());
    }
  }
  if (chunks.length) return chunks.join("\n\n");

  const choices = Array.isArray(root.choices) ? root.choices : [];
  for (const choice of choices) {
    if (!choice || typeof choice !== "object") continue;
    const message = (choice as { message?: { content?: unknown } }).message;
    if (typeof message?.content === "string" && message.content.trim()) return message.content.trim();
  }
  return "";
}
