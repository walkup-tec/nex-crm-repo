ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS meta_low_balance_alerted_at timestamptz;
