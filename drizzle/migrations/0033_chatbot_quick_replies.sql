CREATE TABLE IF NOT EXISTS public.chatbot_quick_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, title)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chatbot_quick_replies TO authenticated;
GRANT ALL ON public.chatbot_quick_replies TO service_role;
ALTER TABLE public.chatbot_quick_replies ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS chatbot_quick_replies_org_idx ON public.chatbot_quick_replies (organization_id);
DROP POLICY IF EXISTS "tenant reads chatbot quick replies" ON public.chatbot_quick_replies;
CREATE POLICY "tenant reads chatbot quick replies" ON public.chatbot_quick_replies
  FOR SELECT TO authenticated
  USING (organization_id = public.current_organization_id() OR public.is_master());
