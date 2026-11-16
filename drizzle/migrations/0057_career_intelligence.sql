-- NEX Career Intelligence — persistência de empresas, vagas, contatos e candidaturas.
-- Acesso de painel restrito a walkup@walkuptec.com.br (aplicado no backend).

CREATE TABLE IF NOT EXISTS public.career_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN (
    'companies_discover',
    'companies_enrich',
    'jobs_search',
    'application_prepare',
    'import'
  )),
  status text NOT NULL DEFAULT 'completed' CHECK (status IN ('running', 'completed', 'partial', 'error')),
  actor_source text NOT NULL DEFAULT 'plugin' CHECK (actor_source IN ('plugin', 'panel')),
  actor_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  idempotency_key text,
  request_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  summary_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_message text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS career_executions_idempotency_uidx
  ON public.career_executions (idempotency_key)
  WHERE idempotency_key IS NOT NULL AND idempotency_key <> '';

CREATE INDEX IF NOT EXISTS career_executions_created_idx
  ON public.career_executions (created_at DESC);

CREATE TABLE IF NOT EXISTS public.career_companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  name_normalized text NOT NULL DEFAULT '',
  cnpj text,
  website text NOT NULL DEFAULT '',
  domain_normalized text NOT NULL DEFAULT '',
  linkedin_url text NOT NULL DEFAULT '',
  linkedin_normalized text NOT NULL DEFAULT '',
  segment text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT '' CHECK (
    category = '' OR category IN (
      'agency',
      'enterprise',
      'inhouse_marketing',
      'other'
    )
  ),
  city text NOT NULL DEFAULT '',
  state text NOT NULL DEFAULT '',
  corporate_email text NOT NULL DEFAULT '',
  hr_email text NOT NULL DEFAULT '',
  business_whatsapp text NOT NULL DEFAULT '',
  recruiter_names text NOT NULL DEFAULT '',
  source text NOT NULL DEFAULT '',
  prospect_status text NOT NULL DEFAULT 'new' CHECK (
    prospect_status IN ('new', 'researching', 'contacted', 'qualified', 'archived')
  ),
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  last_enriched_at timestamptz,
  sources_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  research_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  change_log jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS career_companies_cnpj_uidx
  ON public.career_companies (cnpj)
  WHERE cnpj IS NOT NULL AND cnpj <> '';

CREATE UNIQUE INDEX IF NOT EXISTS career_companies_domain_uidx
  ON public.career_companies (domain_normalized)
  WHERE domain_normalized <> '';

CREATE UNIQUE INDEX IF NOT EXISTS career_companies_linkedin_uidx
  ON public.career_companies (linkedin_normalized)
  WHERE linkedin_normalized <> '';

CREATE UNIQUE INDEX IF NOT EXISTS career_companies_name_loc_uidx
  ON public.career_companies (name_normalized, city, state)
  WHERE name_normalized <> '';

CREATE INDEX IF NOT EXISTS career_companies_updated_idx
  ON public.career_companies (updated_at DESC);

CREATE TABLE IF NOT EXISTS public.career_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.career_companies(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'other' CHECK (
    kind IN ('hr_email', 'recruiting_email', 'business_whatsapp', 'company_linkedin', 'recruiter_linkedin', 'marketing_manager_linkedin', 'person', 'other')
  ),
  full_name text NOT NULL DEFAULT '',
  title text NOT NULL DEFAULT '',
  value text NOT NULL DEFAULT '',
  value_normalized text NOT NULL DEFAULT '',
  verification_status text NOT NULL DEFAULT 'unverified' CHECK (
    verification_status IN ('confirmed', 'unverified', 'not_found')
  ),
  source text NOT NULL DEFAULT '',
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS career_contacts_company_value_uidx
  ON public.career_contacts (company_id, kind, value_normalized)
  WHERE value_normalized <> '';

CREATE INDEX IF NOT EXISTS career_contacts_company_idx
  ON public.career_contacts (company_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.career_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.career_companies(id) ON DELETE SET NULL,
  company_name text NOT NULL DEFAULT '',
  title text NOT NULL,
  title_normalized text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  url text NOT NULL DEFAULT '',
  url_normalized text NOT NULL DEFAULT '',
  platform text NOT NULL DEFAULT '',
  location text NOT NULL DEFAULT '',
  work_mode text NOT NULL DEFAULT '' CHECK (
    work_mode = '' OR work_mode IN ('remote', 'hybrid', 'onsite', 'unknown')
  ),
  contract_type text NOT NULL DEFAULT '' CHECK (
    contract_type = '' OR contract_type IN ('pj', 'clt', 'freelancer', 'internship', 'unknown')
  ),
  salary_range text NOT NULL DEFAULT '',
  requirements text NOT NULL DEFAULT '',
  published_at date,
  researched_at timestamptz NOT NULL DEFAULT now(),
  application_channel text NOT NULL DEFAULT '' CHECK (
    application_channel = '' OR application_channel IN ('linkedin', 'external_form', 'direct_contact', 'unknown')
  ),
  compatibility_score numeric(5,2),
  compatibility_notes text NOT NULL DEFAULT '',
  opportunity_status text NOT NULL DEFAULT 'new' CHECK (
    opportunity_status IN ('new', 'reviewing', 'prepared', 'applied', 'rejected', 'archived')
  ),
  source text NOT NULL DEFAULT '',
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  research_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  change_log jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS career_jobs_url_uidx
  ON public.career_jobs (url_normalized)
  WHERE url_normalized <> '';

CREATE UNIQUE INDEX IF NOT EXISTS career_jobs_company_title_uidx
  ON public.career_jobs (company_id, title_normalized, platform)
  WHERE company_id IS NOT NULL AND title_normalized <> '';

CREATE INDEX IF NOT EXISTS career_jobs_updated_idx
  ON public.career_jobs (updated_at DESC);

CREATE TABLE IF NOT EXISTS public.career_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.career_jobs(id) ON DELETE CASCADE,
  company_id uuid REFERENCES public.career_companies(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (
    status IN ('draft', 'ready', 'approved', 'sent', 'archived')
  ),
  compatibility_analysis text NOT NULL DEFAULT '',
  recommended_resume text NOT NULL DEFAULT '',
  intro_message text NOT NULL DEFAULT '',
  email_body text NOT NULL DEFAULT '',
  linkedin_message text NOT NULL DEFAULT '',
  whatsapp_message text NOT NULL DEFAULT '',
  guidance text NOT NULL DEFAULT '',
  approved_at timestamptz,
  approved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS career_applications_job_idx
  ON public.career_applications (job_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS career_applications_status_idx
  ON public.career_applications (status, updated_at DESC);

ALTER TABLE public.career_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.career_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.career_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.career_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.career_applications ENABLE ROW LEVEL SECURITY;
