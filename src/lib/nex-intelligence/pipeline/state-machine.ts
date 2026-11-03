/** Máquina de estados explícita — 4 eixos (contrato v1.3.0). */

export type ExecutionStatus = "queued" | "running" | "succeeded" | "failed";

export type AnalyticalStatusV130 =
  | "COMPLETED"
  | "PARTIAL_VALIDATED"
  | "FALLBACK_DETERMINISTIC"
  | "INSUFFICIENT_EVIDENCE"
  | "FAILED";

export type DataQualityStatusAxis = "PASS" | "WARNING" | "FAIL" | "NOT_VERIFIABLE";

export type PublicationStatus = "not_ready" | "pending_persist" | "published" | "failed_persist";

export type PipelineStatuses = {
  execution_status: ExecutionStatus;
  analytical_status: AnalyticalStatusV130;
  data_quality_status: DataQualityStatusAxis;
  publication_status: PublicationStatus;
};

const EXECUTION_TRANSITIONS: Record<ExecutionStatus, ExecutionStatus[]> = {
  queued: ["running", "failed"],
  running: ["succeeded", "failed"],
  succeeded: [],
  failed: ["queued"], // retry explícito
};

const PUBLICATION_TRANSITIONS: Record<PublicationStatus, PublicationStatus[]> = {
  not_ready: ["pending_persist", "failed_persist"],
  pending_persist: ["published", "failed_persist"],
  published: [],
  failed_persist: [],
};

export function canTransitionExecution(from: ExecutionStatus, to: ExecutionStatus): boolean {
  return EXECUTION_TRANSITIONS[from].includes(to);
}

export function canTransitionPublication(from: PublicationStatus, to: PublicationStatus): boolean {
  return PUBLICATION_TRANSITIONS[from].includes(to);
}

export function transitionExecution(
  current: ExecutionStatus,
  next: ExecutionStatus,
): ExecutionStatus {
  if (!canTransitionExecution(current, next)) {
    throw new Error(`illegal_execution_transition:${current}->${next}`);
  }
  return next;
}

export function transitionPublication(
  current: PublicationStatus,
  next: PublicationStatus,
): PublicationStatus {
  if (!canTransitionPublication(current, next)) {
    throw new Error(`illegal_publication_transition:${current}->${next}`);
  }
  return next;
}

/** Invariantes: falha técnica nunca vira COMPLETED/publicado. */
export function assertPublishable(statuses: PipelineStatuses): void {
  if (statuses.analytical_status === "FAILED") {
    throw new Error("cannot_publish_failed_analytical");
  }
  if (statuses.execution_status === "failed") {
    throw new Error("cannot_publish_failed_execution");
  }
  if (statuses.publication_status === "failed_persist") {
    throw new Error("cannot_publish_after_failed_persist");
  }
}

export function deriveAnalyticalStatus(input: {
  approvedCount: number;
  discardedOrRejected: number;
  usedAiConclusions: boolean;
  usedFallbackOnly: boolean;
  technicalFailure: boolean;
}): AnalyticalStatusV130 {
  if (input.technicalFailure) return "FAILED";
  if (input.approvedCount === 0) return "INSUFFICIENT_EVIDENCE";
  if (input.usedFallbackOnly || !input.usedAiConclusions) return "FALLBACK_DETERMINISTIC";
  if (input.discardedOrRejected > 0) return "PARTIAL_VALIDATED";
  return "COMPLETED";
}

export function initialStatuses(dataQuality: DataQualityStatusAxis): PipelineStatuses {
  return {
    execution_status: "queued",
    analytical_status: "INSUFFICIENT_EVIDENCE",
    data_quality_status: dataQuality,
    publication_status: "not_ready",
  };
}
