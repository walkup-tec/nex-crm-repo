CREATE TABLE IF NOT EXISTS public.chatbot_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  position integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chatbot_stages TO authenticated;
GRANT ALL ON public.chatbot_stages TO service_role;
ALTER TABLE public.chatbot_stages ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS chatbot_stages_org_idx ON public.chatbot_stages (organization_id, position);
DROP POLICY IF EXISTS "tenant reads chatbot stages" ON public.chatbot_stages;
CREATE POLICY "tenant reads chatbot stages" ON public.chatbot_stages FOR SELECT TO authenticated USING (organization_id = public.current_organization_id() OR public.is_master());
