/**
 * Contrato de persistência analítica v1.3.0 (output_json + colunas espelho).
 * Compat: campos v1.2.0 preservados; novos campos aditivos.
 *
 * ChatGPT NÃO revalida: apenas lê artefato com publication_status=published.
 */

export type PersistedAnalyticalOutputV120 = {
  analysis_markdown: string;
  model: string;
  protocol_version: string;
  engine_version: string;
  prompt_hash: string;
  data_quality_status: string;
  analytical_status: string | null;
  ai_original: {
    raw_text_present: boolean;
    structured: Record<string, unknown> | null;
    parse_ok: boolean;
    parse_error?: string;
  };
  validation: {
    observations: unknown[];
    recommendations: unknown[];
    executive_points: unknown[];
    schema_errors: unknown[];
  };
  rejected: {
    recommendations: unknown[];
    observations: unknown[];
    executive_points: unknown[];
    needs_review: unknown[];
  };
  recovery: Record<string, unknown>;
  metric_traceability: Record<string, unknown>;
  report: {
    markdown: string;
    published_recommendation_ids: string[];
  };
  recommendation_validation: Record<string, unknown>;
};

/** Extensão atômica v1.3.0 — mesma unidade transacional. */
export type PersistedAnalyticalOutputV130 = PersistedAnalyticalOutputV120 & {
  claim_ir_version: string;
  execution_status: string;
  publication_status: string;
  publication_version: number;
  computed_metrics: unknown[];
  claim_ir: {
    proposed: unknown[];
    original: unknown[];
    normalized: unknown[];
    validated: unknown[];
    recovered: unknown[];
    approved: unknown[];
    rejected: unknown[];
    recovery_audits: unknown[];
  };
  semantic_validation: {
    engine: string;
    approved_count: number;
    rejected_count: number;
  };
  publication_gate: {
    ok: boolean;
    failures: Array<{ code: string; detail: string }>;
  };
  statuses: {
    execution_status: string;
    analytical_status: string;
    data_quality_status: string;
    publication_status: string;
  };
  /** Aditivo: recomendações estratégicas consolidadas com diagnóstico quantitativo. */
  strategic_recommendations?: unknown[];
};
