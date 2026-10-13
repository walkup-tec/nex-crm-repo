CREATE TABLE public.chatbot_teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  connection_id uuid NOT NULL REFERENCES public.chatbot_connections(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chatbot_teams TO authenticated;
GRANT ALL ON public.chatbot_teams TO service_role;
ALTER TABLE public.chatbot_teams ENABLE ROW LEVEL SECURITY;
CREATE INDEX chatbot_teams_org_idx ON public.chatbot_teams (organization_id);
CREATE INDEX chatbot_teams_connection_idx ON public.chatbot_teams (connection_id);
CREATE POLICY "tenant reads chatbot teams" ON public.chatbot_teams FOR SELECT TO authenticated USING (organization_id = public.current_organization_id() OR public.is_master());

CREATE TABLE public.chatbot_team_members (
  team_id uuid NOT NULL REFERENCES public.chatbot_teams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (team_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chatbot_team_members TO authenticated;
GRANT ALL ON public.chatbot_team_members TO service_role;
ALTER TABLE public.chatbot_team_members ENABLE ROW LEVEL SECURITY;
CREATE INDEX chatbot_team_members_org_idx ON public.chatbot_team_members (organization_id, user_id);
CREATE POLICY "tenant reads chatbot team members" ON public.chatbot_team_members FOR SELECT TO authenticated USING (organization_id = public.current_organization_id() OR public.is_master());
