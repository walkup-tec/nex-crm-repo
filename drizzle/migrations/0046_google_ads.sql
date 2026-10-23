CREATE TABLE IF NOT EXISTS public.google_ads_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  customer_id text NOT NULL,
  login_customer_id text NOT NULL,
  name text NOT NULL DEFAULT '',
  currency text NOT NULL DEFAULT 'BRL',
  account_status text,
  selected boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, customer_id)
);

REVOKE ALL ON public.google_ads_accounts FROM anon, authenticated;
GRANT ALL ON public.google_ads_accounts TO service_role;
ALTER TABLE public.google_ads_accounts ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS google_ads_accounts_org_idx ON public.google_ads_accounts (organization_id);
