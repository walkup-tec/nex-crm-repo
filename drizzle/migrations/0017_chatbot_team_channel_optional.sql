ALTER TABLE public.chatbot_teams ALTER COLUMN connection_id DROP NOT NULL;

DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT con.conname INTO constraint_name
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
  WHERE nsp.nspname = 'public'
    AND rel.relname = 'chatbot_teams'
    AND con.contype = 'f'
    AND pg_get_constraintdef(con.oid) ILIKE '%chatbot_connections%';
  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.chatbot_teams DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

ALTER TABLE public.chatbot_teams
  ADD CONSTRAINT chatbot_teams_connection_id_fkey
  FOREIGN KEY (connection_id) REFERENCES public.chatbot_connections(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.chatbot_team_channels (
  team_id uuid NOT NULL REFERENCES public.chatbot_teams(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES public.chatbot_connections(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (team_id, connection_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chatbot_team_channels TO authenticated;
GRANT ALL ON public.chatbot_team_channels TO service_role;
ALTER TABLE public.chatbot_team_channels ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS chatbot_team_channels_connection_idx ON public.chatbot_team_channels (connection_id);
CREATE INDEX IF NOT EXISTS chatbot_team_channels_org_idx ON public.chatbot_team_channels (organization_id);
DROP POLICY IF EXISTS "tenant reads chatbot team channels" ON public.chatbot_team_channels;
CREATE POLICY "tenant reads chatbot team channels" ON public.chatbot_team_channels FOR SELECT TO authenticated USING (organization_id = public.current_organization_id() OR public.is_master());

INSERT INTO public.chatbot_team_channels (team_id, connection_id, organization_id)
SELECT id, connection_id, organization_id
FROM public.chatbot_teams
WHERE connection_id IS NOT NULL
ON CONFLICT DO NOTHING;
