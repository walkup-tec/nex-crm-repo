CREATE TABLE IF NOT EXISTS public.contract_signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.chatbot_contacts (id) ON DELETE CASCADE,
  autentique_document_id text NOT NULL,
  client_name text NOT NULL,
  client_email text NOT NULL,
  witness_name text NOT NULL,
  witness_email text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  notified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (autentique_document_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS contract_signatures_contact_pending_idx
  ON public.contract_signatures (contact_id)
  WHERE status = 'pending';

ALTER TABLE public.contract_signatures ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.contract_signatures TO service_role;
