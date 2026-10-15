ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS chatbot_access_profiles jsonb;
