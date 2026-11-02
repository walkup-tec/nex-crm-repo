import type { MetaPeriod } from "@/lib/meta-access";
import type { NexMetaAnalysisV1 } from "@/lib/meta-export";

export type MetaAiExecutionStatus = "ok" | "error" | "partial";

/** Janela para avisar execução idêntica recente (mesmo cliente/período). */
export const META_AI_RECENT_DUPLICATE_MS = 10 * 60 * 1000;

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
  /** Revisão automática enviada direto à OpenAI (sem ZIP/manual). */
  ai_review?: string;
  ai_review_model?: string;
  ai_reviewed_at?: string;
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

type RecentDuplicateCandidate = {
  organizationId: string;
  createdAt: string;
  status: MetaAiExecutionStatus;
  periodSince: string | null;
  periodUntil: string | null;
};

/** Retorna a execução recente mais próxima que conflita com cliente/período pedidos. */
export function findRecentMetaAiDuplicate<T extends RecentDuplicateCandidate>(
  executions: T[],
  input: {
    organizationId: string;
    period: MetaPeriod;
    now?: number;
    windowMs?: number;
  },
): T | null {
  const now = input.now ?? Date.now();
  const windowMs = input.windowMs ?? META_AI_RECENT_DUPLICATE_MS;
  for (const item of executions) {
    if (item.organizationId !== input.organizationId) continue;
    if (item.status === "error") continue;
    const age = now - new Date(item.createdAt).getTime();
    if (!Number.isFinite(age) || age < 0 || age > windowMs) continue;
    if (input.period.mode === "custom") {
      if (item.periodSince !== input.period.since || item.periodUntil !== input.period.until) {
        continue;
      }
    }
    return item;
  }
  return null;
}
