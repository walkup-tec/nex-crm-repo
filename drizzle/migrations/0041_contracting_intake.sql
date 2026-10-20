CREATE TABLE IF NOT EXISTS public.contracting_intakes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  protocol text NOT NULL,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.chatbot_contacts(id) ON DELETE CASCADE,
  cnpj text NOT NULL,
  legal_name text NOT NULL,
  postal_code text NOT NULL,
  street text NOT NULL,
  address_number text NOT NULL,
  address_complement text NOT NULL DEFAULT '',
  district text NOT NULL,
  city text NOT NULL,
  state text NOT NULL,
  representative_name text NOT NULL,
  representative_document text NOT NULL DEFAULT '',
  representative_email text NOT NULL,
  witness_name text NOT NULL,
  witness_document text NOT NULL,
  witness_email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.contracting_intake_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  intake_id uuid NOT NULL REFERENCES public.contracting_intakes (id) ON DELETE CASCADE,
  kind text NOT NULL,
  file_name text NOT NULL,
  content_type text NOT NULL,
  storage_path text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (intake_id, kind)
);

CREATE UNIQUE INDEX IF NOT EXISTS contracting_intakes_protocol_idx ON public.contracting_intakes (protocol);
CREATE INDEX IF NOT EXISTS contracting_intakes_contact_idx ON public.contracting_intakes (organization_id, contact_id, created_at DESC);

ALTER TABLE public.contracting_intakes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contracting_intake_files ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.contracting_intakes TO service_role;
GRANT ALL ON public.contracting_intake_files TO service_role;
