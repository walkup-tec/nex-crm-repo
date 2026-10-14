ALTER TABLE public.chatbot_contacts
  ADD COLUMN IF NOT EXISTS stage_name text;
