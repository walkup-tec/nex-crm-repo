ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS chatbot_queue_minutes integer NOT NULL DEFAULT 15;

ALTER TABLE public.chatbot_conversations
  ADD COLUMN IF NOT EXISTS queued_at timestamptz;

UPDATE public.chatbot_conversations
SET queued_at = created_at
WHERE queued_at IS NULL;

ALTER TABLE public.chatbot_conversations
  ALTER COLUMN queued_at SET DEFAULT now();
