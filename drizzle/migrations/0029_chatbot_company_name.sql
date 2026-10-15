ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS chatbot_company_name text;
