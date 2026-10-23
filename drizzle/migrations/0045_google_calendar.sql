CREATE TABLE IF NOT EXISTS public.google_calendar_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  google_account_email text,
  calendar_id text NOT NULL DEFAULT 'primary',
  encrypted_refresh_token text,
  access_token_encrypted text,
  token_expires_at timestamptz,
  scopes text NOT NULL DEFAULT '',
  connection_status text NOT NULL DEFAULT 'pending' CHECK (connection_status IN ('pending', 'connected', 'error', 'disconnected')),
  sync_token text,
  last_sync_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);

REVOKE ALL ON public.google_calendar_connections FROM anon, authenticated;
GRANT ALL ON public.google_calendar_connections TO service_role;
ALTER TABLE public.google_calendar_connections ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS google_calendar_connections_org_idx ON public.google_calendar_connections (organization_id);

CREATE TABLE IF NOT EXISTS public.google_oauth_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  state text NOT NULL UNIQUE,
  user_id uuid NOT NULL,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

REVOKE ALL ON public.google_oauth_states FROM anon, authenticated;
GRANT ALL ON public.google_oauth_states TO service_role;
ALTER TABLE public.google_oauth_states ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.lead_meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES public.chatbot_contacts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  google_connection_id uuid REFERENCES public.google_calendar_connections(id) ON DELETE SET NULL,
  google_event_id text,
  request_id text NOT NULL,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  attendee_email text NOT NULL DEFAULT '',
  attendees jsonb NOT NULL DEFAULT '[]'::jsonb,
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  timezone text NOT NULL DEFAULT 'America/Sao_Paulo',
  meet_url text,
  calendar_url text,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'cancelled', 'failed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, request_id)
);

REVOKE ALL ON public.lead_meetings FROM anon, authenticated;
GRANT ALL ON public.lead_meetings TO service_role;
ALTER TABLE public.lead_meetings ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS lead_meetings_org_start_idx ON public.lead_meetings (organization_id, start_at);
CREATE INDEX IF NOT EXISTS lead_meetings_lead_idx ON public.lead_meetings (lead_id, start_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS lead_meetings_google_event_idx ON public.lead_meetings (organization_id, google_event_id) WHERE google_event_id IS NOT NULL;
