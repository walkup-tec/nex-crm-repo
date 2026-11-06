import type {
  MetaAiCalibrationFeedback,
  MetaAiExecutionDetail,
  MetaAiExecutionStatus,
  MetaAiExecutionSummary,
} from "@/lib/meta-ai-calibration";
import type { NexMetaAnalysisV1 } from "@/lib/meta-export";
import {
  inferPipelineProgress,
  readPipelineProgress,
} from "@/lib/nex-intelligence/pipeline/progress";

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
  const summary = toMetaAiExecutionSummary(row);
  const outputJson = (row.output_json as Record<string, unknown>) ?? {};
  const analysisMarkdown = String(row.analysis_markdown ?? "");
  const errorMessage = String(row.error_message ?? "");
  const publicationStatus = row.publication_status ? String(row.publication_status) : null;
  const pipelineProgress =
    readPipelineProgress(outputJson) ??
    inferPipelineProgress({
      status: summary.status,
      errorMessage,
      accountId: summary.accountId,
      model: summary.model,
      analysisMarkdown,
      publicationStatus,
    });
  return {
    ...summary,
    periodTimezone: String(row.period_timezone ?? "America/Sao_Paulo"),
    analysisMarkdown,
    warnings: Array.isArray(row.warnings) ? row.warnings.map(String) : [],
    errorMessage,
    inputJson: (row.input_json as NexMetaAnalysisV1) ?? {},
    outputJson,
    calibrationFeedback: (row.calibration_feedback as MetaAiCalibrationFeedback) ?? {},
    pipelineProgress,
    executionStatusAxis: row.execution_status ? String(row.execution_status) : null,
    analyticalStatus: row.analytical_status ? String(row.analytical_status) : null,
    publicationStatus,
  };
}
