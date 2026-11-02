/**
 * Contrato de persistência analítica v1.2.0 (output_json + colunas espelho).
 *
 * Obrigatório gravar para consulta ChatGPT read-only:
 * - dados originais da IA (structured / raw snapshot)
 * - resultados de validação por seção (observations / recommendations / executive_points)
 * - itens rejeitados e needs_review
 * - decisões de recuperação (CMS-E1 + regen audit)
 * - metric_traceability (Camada C / recompute)
 * - relatório publicado (markdown = analysis_markdown)
 *
 * ChatGPT NÃO revalida: apenas lê o artefato persistido.
 */

export type PersistedAnalyticalOutputV120 = {
  analysis_markdown: string;
  model: string;
  protocol_version: string;
  engine_version: string;
  prompt_hash: string;
  data_quality_status: string;
  analytical_status: string | null;
  /** Snapshot estruturado original (pós-parse) e/ou raw quando parse falha. */
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
  /** Compat legado com consumidores 1.1.x */
  recommendation_validation: Record<string, unknown>;
};
