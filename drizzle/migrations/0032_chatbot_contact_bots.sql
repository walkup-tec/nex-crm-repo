ALTER TABLE public.chatbot_contacts
  ADD COLUMN IF NOT EXISTS bots_disabled boolean NOT NULL DEFAULT false;
