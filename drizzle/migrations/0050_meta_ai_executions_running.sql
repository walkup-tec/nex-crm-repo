-- Permite status running para análise assíncrona (evita timeout do proxy).
ALTER TABLE public.meta_ai_executions
  DROP CONSTRAINT IF EXISTS meta_ai_executions_status_check;

ALTER TABLE public.meta_ai_executions
  ADD CONSTRAINT meta_ai_executions_status_check
  CHECK (status IN ('ok', 'error', 'partial', 'running'));
