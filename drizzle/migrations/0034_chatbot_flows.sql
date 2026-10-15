CREATE TABLE IF NOT EXISTS public.chatbot_flows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  active boolean NOT NULL DEFAULT false,
  graph jsonb NOT NULL DEFAULT '{"nodes":[],"edges":[]}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chatbot_flows TO authenticated;
GRANT ALL ON public.chatbot_flows TO service_role;
ALTER TABLE public.chatbot_flows ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS chatbot_flows_org_idx ON public.chatbot_flows (organization_id);
DROP POLICY IF EXISTS "tenant reads chatbot flows" ON public.chatbot_flows;
CREATE POLICY "tenant reads chatbot flows" ON public.chatbot_flows
  FOR SELECT TO authenticated
  USING (organization_id = public.current_organization_id() OR public.is_master());

CREATE TABLE IF NOT EXISTS public.chatbot_flow_runs (
  conversation_id uuid PRIMARY KEY REFERENCES public.chatbot_conversations(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  flow_id uuid NOT NULL REFERENCES public.chatbot_flows(id) ON DELETE CASCADE,
  node_id text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'done',
  wait_until timestamptz,
  last_answer text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chatbot_flow_runs TO authenticated;
GRANT ALL ON public.chatbot_flow_runs TO service_role;
ALTER TABLE public.chatbot_flow_runs ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS chatbot_flow_runs_due_idx ON public.chatbot_flow_runs (organization_id, status, wait_until);
DROP POLICY IF EXISTS "tenant reads chatbot flow runs" ON public.chatbot_flow_runs;
CREATE POLICY "tenant reads chatbot flow runs" ON public.chatbot_flow_runs
  FOR SELECT TO authenticated
  USING (organization_id = public.current_organization_id() OR public.is_master());

ALTER TABLE public.chatbot_contacts ADD COLUMN IF NOT EXISTS bot_note text;
