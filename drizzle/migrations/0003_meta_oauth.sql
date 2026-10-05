CREATE TABLE public.meta_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
  connected_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  meta_user_id text,
  access_token_encrypted text,
  token_expires_at timestamptz,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'connected', 'error', 'disconnected')),
  connected_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_sync_at timestamptz,
  last_error text
);

REVOKE ALL ON public.meta_connections FROM anon, authenticated;
GRANT ALL ON public.meta_connections TO service_role;
ALTER TABLE public.meta_connections ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.meta_oauth_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  state text NOT NULL UNIQUE,
  user_id uuid NOT NULL,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

REVOKE ALL ON public.meta_oauth_states FROM anon, authenticated;
GRANT ALL ON public.meta_oauth_states TO service_role;
ALTER TABLE public.meta_oauth_states ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.meta_accounts
  ADD COLUMN IF NOT EXISTS account_status text,
  ADD COLUMN IF NOT EXISTS selected boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS connection_id uuid REFERENCES public.meta_connections(id) ON DELETE SET NULL;
