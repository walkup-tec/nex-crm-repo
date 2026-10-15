ALTER TABLE public.chatbot_contacts
  ADD COLUMN IF NOT EXISTS document text,
  ADD COLUMN IF NOT EXISTS rg text;

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS chatbot_client_document boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS chatbot_client_rg boolean NOT NULL DEFAULT false;
