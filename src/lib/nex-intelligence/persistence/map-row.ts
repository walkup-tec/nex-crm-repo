import type {
  MetaAiCalibrationFeedback,
  MetaAiExecutionDetail,
  MetaAiExecutionStatus,
  MetaAiExecutionSummary,
} from "@/lib/meta-ai-calibration";
import type { NexMetaAnalysisV1 } from "@/lib/meta-export";

export function toMetaAiExecutionSummary(row: Record<string, unknown>): MetaAiExecutionSummary {
  const warnings = Array.isArray(row.warnings) ? row.warnings : [];
  return {
    id: String(row.id),
    createdAt: String(row.created_at),
    status: (row.status as MetaAiExecutionStatus) || "ok",
    organizationId: String(row.organization_id),
    clientName: String(row.client_name ?? ""),
    accountId: String(row.account_id ?? ""),
    accountName: String(row.account_name ?? ""),
    periodSince: row.period_since ? String(row.period_since).slice(0, 10) : null,
    periodUntil: row.period_until ? String(row.period_until).slice(0, 10) : null,
    protocolVersion: String(row.protocol_version ?? ""),
    dataContractVersion: String(row.data_contract_version ?? ""),
    model: String(row.model ?? ""),
    promptHash: String(row.prompt_hash ?? ""),
    warningCount: warnings.length,
  };
}

export function toMetaAiExecutionDetail(row: Record<string, unknown>): MetaAiExecutionDetail {
  return {
    ...toMetaAiExecutionSummary(row),
    periodTimezone: String(row.period_timezone ?? "America/Sao_Paulo"),
    analysisMarkdown: String(row.analysis_markdown ?? ""),
    warnings: Array.isArray(row.warnings) ? row.warnings.map(String) : [],
    errorMessage: String(row.error_message ?? ""),
    inputJson: (row.input_json as NexMetaAnalysisV1) ?? {},
    outputJson: (row.output_json as Record<string, unknown>) ?? {},
    calibrationFeedback: (row.calibration_feedback as MetaAiCalibrationFeedback) ?? {},
  };
}
