ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS commercial_name text NOT NULL DEFAULT '';
