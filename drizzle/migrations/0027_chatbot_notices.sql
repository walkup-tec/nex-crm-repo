ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS chatbot_sound_enabled boolean NOT NULL DEFAULT true;

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS chatbot_offline_alert boolean NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS public.chatbot_presence (
  user_id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  seen_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.chatbot_presence TO authenticated;
GRANT ALL ON public.chatbot_presence TO service_role;
ALTER TABLE public.chatbot_presence ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS chatbot_presence_org_idx ON public.chatbot_presence (organization_id, seen_at DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'chatbot_presence' AND policyname = 'tenant reads chatbot presence'
  ) THEN
    CREATE POLICY "tenant reads chatbot presence" ON public.chatbot_presence
      FOR SELECT TO authenticated
      USING (organization_id = public.current_organization_id() OR public.is_master());
  END IF;
END $$;
