-- NEX Career Intelligence v0.3.0 — enriquecimento multicanal (não destrutivo).
-- Preserva kinds legados e dados existentes; amplia CHECK e colunas.

-- Empresas: status de enriquecimento
ALTER TABLE public.career_companies
  ADD COLUMN IF NOT EXISTS enrichment_status text NOT NULL DEFAULT 'none';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'career_companies_enrichment_status_check'
  ) THEN
    ALTER TABLE public.career_companies
      ADD CONSTRAINT career_companies_enrichment_status_check
      CHECK (enrichment_status IN ('none', 'partial', 'complete', 'researching'));
  END IF;
END $$;

-- Contatos: campos de rastreabilidade e telefone estruturado
ALTER TABLE public.career_contacts
  ADD COLUMN IF NOT EXISTS label text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS source_url text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS suitability_for_application text NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS phone_ddi text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS phone_ddd text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS phone_number text NOT NULL DEFAULT '';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'career_contacts_suitability_check'
  ) THEN
    ALTER TABLE public.career_contacts
      ADD CONSTRAINT career_contacts_suitability_check
      CHECK (suitability_for_application IN ('suitable', 'unsuitable', 'unknown'));
  END IF;
END $$;

-- Ampliar kinds (legado + canônicos v0.3.0)
ALTER TABLE public.career_contacts DROP CONSTRAINT IF EXISTS career_contacts_kind_check;
ALTER TABLE public.career_contacts
  ADD CONSTRAINT career_contacts_kind_check CHECK (
    kind IN (
      -- canônicos v0.3.0
      'hr_email',
      'corporate_email',
      'whatsapp',
      'phone',
      'website',
      'recruiter_linkedin',
      'instagram',
      'facebook',
      -- legado (compatibilidade)
      'recruiting_email',
      'business_whatsapp',
      'company_linkedin',
      'marketing_manager_linkedin',
      'person',
      'other'
    )
  );

-- Vagas: modo de pesquisa (monitor LinkedIn vs prospecção multicanal)
ALTER TABLE public.career_jobs
  ADD COLUMN IF NOT EXISTS research_mode text NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS external_id text NOT NULL DEFAULT '';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'career_jobs_research_mode_check'
  ) THEN
    ALTER TABLE public.career_jobs
      ADD CONSTRAINT career_jobs_research_mode_check
      CHECK (research_mode IN ('linkedin_monitor', 'company_prospect', 'unknown'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS career_jobs_external_id_uidx
  ON public.career_jobs (platform, external_id)
  WHERE external_id <> '';

CREATE INDEX IF NOT EXISTS career_contacts_kind_idx
  ON public.career_contacts (kind, verification_status, updated_at DESC);

CREATE INDEX IF NOT EXISTS career_jobs_platform_idx
  ON public.career_jobs (platform, research_mode, updated_at DESC);
