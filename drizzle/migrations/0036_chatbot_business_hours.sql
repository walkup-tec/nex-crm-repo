ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS chatbot_business_hours jsonb;
