ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS whatsapp text,
  ADD COLUMN IF NOT EXISTS finance_email text,
  ADD COLUMN IF NOT EXISTS finance_email_same boolean NOT NULL DEFAULT false;
