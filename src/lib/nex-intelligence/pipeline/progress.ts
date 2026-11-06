/** Progresso das etapas do pipeline Meta IA (v1.3) — UI + persistência em output_json. */

export const PIPELINE_STEPS = [
  { id: "meta_export", label: "Coleta Meta" },
  { id: "data_quality", label: "Qualidade dos dados" },
  { id: "ai_analysis", label: "Análise IA" },
  { id: "publication", label: "Publicação" },
] as const;

export type PipelineStepId = (typeof PIPELINE_STEPS)[number]["id"];
export type PipelineStepStatus = "pending" | "running" | "completed" | "error";

export type PipelineStepState = {
  id: PipelineStepId;
  label: string;
  status: PipelineStepStatus;
  error?: string;
  updatedAt: string;
};

export type PipelineProgress = {
  version: 1;
  steps: PipelineStepState[];
};

const STEP_IDS = new Set<string>(PIPELINE_STEPS.map((step) => step.id));

function nowIso() {
  return new Date().toISOString();
}

export function createInitialPipelineProgress(): PipelineProgress {
  const updatedAt = nowIso();
  return {
    version: 1,
    steps: PIPELINE_STEPS.map((step) => ({
      id: step.id,
      label: step.label,
      status: "pending" as const,
      updatedAt,
    })),
  };
}

export function markPipelineStep(
  progress: PipelineProgress,
  stepId: PipelineStepId,
  status: PipelineStepStatus,
  error?: string,
): PipelineProgress {
  const updatedAt = nowIso();
  return {
    version: 1,
    steps: progress.steps.map((step) => {
      if (step.id !== stepId) return step;
      const next: PipelineStepState = { ...step, status, updatedAt };
      if (error) next.error = error.slice(0, 400);
      else delete next.error;
      return next;
    }),
  };
}

/** Completa etapas anteriores e marca a atual como running. */
export function advancePipelineTo(
  progress: PipelineProgress,
  stepId: PipelineStepId,
): PipelineProgress {
  const index = PIPELINE_STEPS.findIndex((step) => step.id === stepId);
  if (index < 0) return progress;
  const updatedAt = nowIso();
  return {
    version: 1,
    steps: progress.steps.map((step) => {
      const stepIndex = PIPELINE_STEPS.findIndex((item) => item.id === step.id);
      if (stepIndex < index && step.status !== "error") {
        return { ...step, status: "completed", updatedAt, error: undefined };
      }
      if (stepIndex === index) {
        return { ...step, status: "running", updatedAt, error: undefined };
      }
      return step;
    }),
  };
}

export function completeAllPipelineSteps(progress: PipelineProgress): PipelineProgress {
  const updatedAt = nowIso();
  return {
    version: 1,
    steps: progress.steps.map((step) => ({
      ...step,
      status: step.status === "error" ? "error" : "completed",
      updatedAt,
      error: step.status === "error" ? step.error : undefined,
    })),
  };
}

export function readPipelineProgress(source: unknown): PipelineProgress | null {
  if (!source || typeof source !== "object") return null;
  const root = source as Record<string, unknown>;
  const raw =
    root.pipeline_progress && typeof root.pipeline_progress === "object"
      ? (root.pipeline_progress as Record<string, unknown>)
      : root.version === 1 && Array.isArray(root.steps)
        ? root
        : null;
  if (!raw || !Array.isArray(raw.steps)) return null;
  const steps: PipelineStepState[] = [];
  for (const entry of raw.steps) {
    if (!entry || typeof entry !== "object") continue;
    const row = entry as Record<string, unknown>;
    const id = String(row.id ?? "");
    if (!STEP_IDS.has(id)) continue;
    const status = String(row.status ?? "pending") as PipelineStepStatus;
    if (!["pending", "running", "completed", "error"].includes(status)) continue;
    const label =
      String(row.label ?? "").trim() ||
      PIPELINE_STEPS.find((step) => step.id === id)?.label ||
      id;
    const step: PipelineStepState = {
      id: id as PipelineStepId,
      label,
      status,
      updatedAt: String(row.updatedAt ?? row.updated_at ?? nowIso()),
    };
    if (typeof row.error === "string" && row.error.trim()) step.error = row.error.trim();
    steps.push(step);
  }
  if (steps.length !== PIPELINE_STEPS.length) return null;
  return { version: 1, steps };
}

/** Histórico sem progresso gravado: reconstrói a partir do status final. */
export function inferPipelineProgress(input: {
  status: string;
  errorMessage?: string;
  accountId?: string;
  model?: string;
  analysisMarkdown?: string;
  publicationStatus?: string | null;
}): PipelineProgress {
  const base = createInitialPipelineProgress();
  const err = (input.errorMessage ?? "").trim();
  if (input.status === "running") {
    return advancePipelineTo(base, "meta_export");
  }
  if (input.status === "error") {
    const failedId: PipelineStepId = !input.accountId
      ? "meta_export"
      : !input.model
        ? "ai_analysis"
        : !input.analysisMarkdown?.trim() && input.publicationStatus !== "published"
          ? "publication"
          : "ai_analysis";
    let progress = base;
    for (const step of PIPELINE_STEPS) {
      if (step.id === failedId) {
        progress = markPipelineStep(progress, step.id, "error", err || "Falha nesta etapa.");
        break;
      }
      progress = markPipelineStep(progress, step.id, "completed");
    }
    return progress;
  }
  // ok / partial
  return completeAllPipelineSteps(base);
}

export function withPipelineProgress<T extends Record<string, unknown>>(
  output: T,
  progress: PipelineProgress,
): T & { pipeline_progress: PipelineProgress } {
  return { ...output, pipeline_progress: progress };
}
