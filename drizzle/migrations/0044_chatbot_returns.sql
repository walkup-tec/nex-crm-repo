CREATE TABLE IF NOT EXISTS public.chatbot_returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES public.chatbot_conversations(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.chatbot_contacts(id) ON DELETE CASCADE,
  flow_id uuid NOT NULL REFERENCES public.chatbot_flows(id) ON DELETE CASCADE,
  run_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sending', 'sent', 'failed')),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chatbot_returns TO authenticated;
GRANT ALL ON public.chatbot_returns TO service_role;
ALTER TABLE public.chatbot_returns ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS chatbot_returns_due_idx ON public.chatbot_returns (status, run_at);
CREATE UNIQUE INDEX IF NOT EXISTS chatbot_returns_one_pending ON public.chatbot_returns (conversation_id) WHERE status = 'pending';
DROP POLICY IF EXISTS "tenant reads chatbot returns" ON public.chatbot_returns;
CREATE POLICY "tenant reads chatbot returns" ON public.chatbot_returns
  FOR SELECT TO authenticated
  USING (organization_id = public.current_organization_id() OR public.is_master());
