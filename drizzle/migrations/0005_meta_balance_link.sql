ALTER TABLE public.meta_accounts
  ADD COLUMN IF NOT EXISTS balance_url text;
