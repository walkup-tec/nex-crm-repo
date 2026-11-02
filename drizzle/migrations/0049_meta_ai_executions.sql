-- Laboratório de calibração NEX Intelligence (Meta Leads).
CREATE TABLE IF NOT EXISTS public.meta_ai_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  actor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'ok' CHECK (status IN ('ok', 'error', 'partial')),
  data_contract_version text NOT NULL,
  protocol_version text NOT NULL,
  prompt_hash text NOT NULL,
  model text NOT NULL,
  account_id text NOT NULL DEFAULT '',
  account_name text NOT NULL DEFAULT '',
  client_name text NOT NULL DEFAULT '',
  period_since date,
  period_until date,
  period_timezone text NOT NULL DEFAULT 'America/Sao_Paulo',
  input_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  output_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  analysis_markdown text NOT NULL DEFAULT '',
  warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
  error_message text NOT NULL DEFAULT '',
  calibration_feedback jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS meta_ai_executions_org_created_idx
  ON public.meta_ai_executions (organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS meta_ai_executions_created_idx
  ON public.meta_ai_executions (created_at DESC);

ALTER TABLE public.meta_ai_executions ENABLE ROW LEVEL SECURITY;
