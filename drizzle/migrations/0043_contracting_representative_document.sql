ALTER TABLE public.contracting_intakes
  ADD COLUMN IF NOT EXISTS representative_document text NOT NULL DEFAULT '';
