ALTER TABLE public.chatbot_contacts
  ADD COLUMN IF NOT EXISTS origin_campaign_id text,
  ADD COLUMN IF NOT EXISTS origin_campaign_platform text,
  ADD COLUMN IF NOT EXISTS origin_campaign_name text;
