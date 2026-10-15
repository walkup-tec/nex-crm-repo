ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS chatbot_reactivation_minutes integer NOT NULL DEFAULT 15;

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS chatbot_offline_message_enabled boolean NOT NULL DEFAULT false;

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS chatbot_offline_message text;

ALTER TABLE public.chatbot_conversations
  ADD COLUMN IF NOT EXISTS closed_at timestamptz;

ALTER TABLE public.chatbot_conversations
  ADD COLUMN IF NOT EXISTS offline_notified_at timestamptz;
