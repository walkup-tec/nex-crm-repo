import type { MetaAiExecutionDetail } from "@/lib/meta-ai-calibration";
import type { NexMetaAnalysisV1 } from "@/lib/meta-export";

export type { MetaAiAnalysisResult } from "@/lib/meta-ai-calibration";

export function metaAiUserPrompt(payload: NexMetaAnalysisV1) {
  const quality = (payload as { data_quality?: { status?: string; compromised_metrics?: string[] } })
    .data_quality;
  const computed = (payload as { computed_metrics?: { spend_total?: number | null } }).computed_metrics;
  return [
    "Analise o desempenho Meta Ads deste export NEX (schema 1.0.0, motor 1.1.6). Responda em JSON estruturado v1.1.6 com observations[], recommendations[] (action_kind/confidence nos enums oficiais), executive_points[] e metric_traceability (entity_id do trace = entity_id da conclusão).",
    `Cliente: ${payload.metadata.client_name}`,
    `Conta: ${payload.account.name} (${payload.account.id})`,
    `Período: ${payload.period.since ?? "?"} a ${payload.period.until ?? "?"} (${payload.period.timezone})`,
    `Moeda: ${payload.metadata.currency}`,
    quality?.status
      ? `data_quality.status: ${quality.status}; métricas comprometidas: ${(quality.compromised_metrics ?? []).join(", ") || "nenhuma"}`
      : "data_quality.status: (ausente — trate totais com cautela)",
    computed?.spend_total != null
      ? `computed_metrics.spend_total: ${computed.spend_total}`
      : "computed_metrics.spend_total: (ausente)",
    "",
    "JSON:",
    JSON.stringify(payload),
  ].join("\n");
}

/** Monta o mesmo conteúdo do antigo pacote ZIP, já formatado para a OpenAI. */
export function metaAiCalibrationReviewUserPrompt(detail: MetaAiExecutionDetail) {
  const executionMetadata = {
    execution_id: detail.id,
    created_at: detail.createdAt,
    status: detail.status,
    organization_id: detail.organizationId,
    client_name: detail.clientName,
    account_id: detail.accountId,
    account_name: detail.accountName,
    period: {
      since: detail.periodSince,
      until: detail.periodUntil,
      timezone: detail.periodTimezone,
    },
    data_contract_version: detail.dataContractVersion,
    protocol_version: detail.protocolVersion,
    prompt_hash: detail.promptHash,
    model: detail.model,
    warnings: detail.warnings,
    error_message: detail.errorMessage || null,
  };

  return [
    "Revise a calibração desta execução NEX Intelligence.",
    "",
    "## execution_metadata.json",
    JSON.stringify(executionMetadata, null, 2),
    "",
    "## analysis.md",
    detail.analysisMarkdown || "_Sem análise._",
    "",
    "## output.json",
    JSON.stringify(detail.outputJson ?? {}, null, 2),
    "",
    "## input.json",
    JSON.stringify(detail.inputJson ?? {}, null, 2),
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
