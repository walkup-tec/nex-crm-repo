-- NEX Intelligence v1.3.0 — colunas aditivas de publicação/estados (compatível com histórico).
-- Rollback: DROP COLUMN das colunas abaixo.

ALTER TABLE public.meta_ai_executions
  ADD COLUMN IF NOT EXISTS execution_status text NOT NULL DEFAULT 'succeeded',
  ADD COLUMN IF NOT EXISTS analytical_status text,
  ADD COLUMN IF NOT EXISTS publication_status text NOT NULL DEFAULT 'published',
  ADD COLUMN IF NOT EXISTS publication_version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS claim_ir_version text;

COMMENT ON COLUMN public.meta_ai_executions.execution_status IS 'queued|running|succeeded|failed';
COMMENT ON COLUMN public.meta_ai_executions.analytical_status IS 'COMPLETED|PARTIAL_VALIDATED|FALLBACK_DETERMINISTIC|INSUFFICIENT_EVIDENCE|FAILED';
COMMENT ON COLUMN public.meta_ai_executions.publication_status IS 'not_ready|pending_persist|published|failed_persist';
COMMENT ON COLUMN public.meta_ai_executions.publication_version IS 'Idempotência (execution_id, publication_version)';
COMMENT ON COLUMN public.meta_ai_executions.claim_ir_version IS 'Versão do Claim IR (ex. 1.0.0)';

-- Histórico v1.1/v1.2: publication_status=published por default para não quebrar leitura ChatGPT.
