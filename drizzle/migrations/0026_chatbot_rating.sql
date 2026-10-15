ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS chatbot_rating_enabled boolean NOT NULL DEFAULT false;

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS chatbot_rating_prompt text NOT NULL DEFAULT 'Seu atendimento foi encerrado. Como você avalia?';

ALTER TABLE public.chatbot_conversations
  ADD COLUMN IF NOT EXISTS rating_pending boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.chatbot_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES public.chatbot_conversations(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.chatbot_contacts(id) ON DELETE CASCADE,
  score smallint NOT NULL CHECK (score BETWEEN 1 AND 5),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.chatbot_ratings TO authenticated;
GRANT ALL ON public.chatbot_ratings TO service_role;
ALTER TABLE public.chatbot_ratings ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS chatbot_ratings_org_idx ON public.chatbot_ratings (organization_id, created_at DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'chatbot_ratings' AND policyname = 'tenant reads chatbot ratings'
  ) THEN
    CREATE POLICY "tenant reads chatbot ratings" ON public.chatbot_ratings
      FOR SELECT TO authenticated
      USING (organization_id = public.current_organization_id() OR public.is_master());
  END IF;
END $$;
