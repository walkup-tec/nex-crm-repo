ALTER TABLE public.meta_accounts
  ADD COLUMN IF NOT EXISTS prepaid_ledger jsonb;
