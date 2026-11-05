-- Marcos e decisões operacionais do NEX Intelligence (tarefas / eventos / comunicação).
-- Aplicar no Supabase antes de ligar persistência de Aplicar/Rejeitar/Envio.

CREATE TABLE IF NOT EXISTS public.nex_optimization_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id uuid NOT NULL REFERENCES public.meta_ai_executions(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  ad_account_id text NOT NULL DEFAULT '',
  entity_level text NOT NULL DEFAULT 'campaign',
  entity_id text,
  claim_id text NOT NULL,
  title text NOT NULL,
  justification text NOT NULL DEFAULT '',
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
  evidence_level text,
  kind text NOT NULL DEFAULT 'action' CHECK (kind IN ('action', 'test', 'hypothesis', 'monitor')),
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPLIED', 'REJECTED', 'IN_PROGRESS')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (execution_id, claim_id)
);

CREATE TABLE IF NOT EXISTS public.nex_optimization_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  ad_account_id text NOT NULL DEFAULT '',
  campaign_id text,
  adset_id text,
  ad_id text,
  task_id uuid REFERENCES public.nex_optimization_tasks(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  description text NOT NULL DEFAULT '',
  effective_at timestamptz NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  responsible_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  source text NOT NULL DEFAULT 'ai_task' CHECK (source IN ('ai_task', 'manual')),
  audit_json jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.nex_optimization_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.nex_optimization_tasks(id) ON DELETE CASCADE,
  decision text NOT NULL CHECK (decision IN ('APPLIED', 'REJECTED')),
  decided_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  decided_at timestamptz NOT NULL DEFAULT now(),
  note text NOT NULL DEFAULT '',
  effective_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.nex_client_communications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  event_ids uuid[] NOT NULL DEFAULT '{}',
  channel text NOT NULL CHECK (channel IN ('whatsapp', 'platform')),
  body text NOT NULL,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'awaiting_approval', 'approved', 'queued', 'sent', 'delivered', 'failed', 'cancelled')),
  idempotency_key text NOT NULL,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  provider_ref text,
  error_message text NOT NULL DEFAULT '',
  UNIQUE (organization_id, channel, idempotency_key)
);

CREATE INDEX IF NOT EXISTS nex_optimization_tasks_org_idx
  ON public.nex_optimization_tasks (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS nex_optimization_events_org_effective_idx
  ON public.nex_optimization_events (organization_id, effective_at DESC);
CREATE INDEX IF NOT EXISTS nex_client_communications_org_idx
  ON public.nex_client_communications (organization_id, created_at DESC);

ALTER TABLE public.nex_optimization_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nex_optimization_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nex_optimization_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nex_client_communications ENABLE ROW LEVEL SECURITY;
