ALTER TABLE public.chatbot_messages
  ADD COLUMN IF NOT EXISTS internal boolean NOT NULL DEFAULT false;
