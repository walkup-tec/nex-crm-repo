ALTER TABLE public.chatbot_messages
  ADD COLUMN IF NOT EXISTS reply_to_external_id text,
  ADD COLUMN IF NOT EXISTS reply_preview text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS reactions jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS chatbot_messages_reply_external_idx
  ON public.chatbot_messages (conversation_id, reply_to_external_id)
  WHERE reply_to_external_id IS NOT NULL;
