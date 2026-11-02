import type { NexMetaAnalysisV1 } from "@/lib/meta-export";

export type MetaAiExecutionStatus = "ok" | "error" | "partial";

export type MetaAiCalibrationScores = {
  precision: number | null;
  consistency: number | null;
  foundation: number | null;
  limitations: number | null;
  applicability: number | null;
};

export type MetaAiCalibrationFeedback = {
  scores?: MetaAiCalibrationScores;
  notes?: string;
  approved_changes?: string[];
  rejected_changes?: string[];
  reviewed_at?: string;
  reviewer?: string;
};

export type MetaAiExecutionSummary = {
  id: string;
  createdAt: string;
  status: MetaAiExecutionStatus;
  organizationId: string;
  clientName: string;
  accountId: string;
  accountName: string;
  periodSince: string | null;
  periodUntil: string | null;
  protocolVersion: string;
  dataContractVersion: string;
  model: string;
  promptHash: string;
  warningCount: number;
};

export type MetaAiExecutionDetail = MetaAiExecutionSummary & {
  periodTimezone: string;
  analysisMarkdown: string;
  warnings: string[];
  errorMessage: string;
  inputJson: NexMetaAnalysisV1 | Record<string, unknown>;
  outputJson: Record<string, unknown>;
  calibrationFeedback: MetaAiCalibrationFeedback;
};

export type MetaAiAnalysisResult = {
  executionId: string;
  analysis: string;
  model: string;
  clientName: string;
  accountId: string;
  accountName: string;
  period: { since: string | null; until: string | null; timezone: string };
  campaignCount: number;
  adsetCount: number;
  adCount: number;
  warnings: string[];
  dataStatus: "live" | "partial";
  protocolVersion: string;
  dataContractVersion: string;
  promptHash: string;
};

export function clampScore(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(5, Math.round(n)));
}
