ALTER TABLE public.chatbot_conversations
  ADD COLUMN IF NOT EXISTS finished_count integer NOT NULL DEFAULT 0;
