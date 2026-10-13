ALTER TABLE public.chatbot_contacts
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS avatar_checked_at timestamptz;
