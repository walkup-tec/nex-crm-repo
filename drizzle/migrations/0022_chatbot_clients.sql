ALTER TABLE public.chatbot_contacts
  ADD COLUMN IF NOT EXISTS negotiated_cents bigint,
  ADD COLUMN IF NOT EXISTS client_owner_id uuid,
  ADD COLUMN IF NOT EXISTS client_registered_at timestamptz;
