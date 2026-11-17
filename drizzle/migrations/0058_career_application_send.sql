-- Permite registrar execuções de envio de candidatura por e-mail.
ALTER TABLE public.career_executions
  DROP CONSTRAINT IF EXISTS career_executions_kind_check;

ALTER TABLE public.career_executions
  ADD CONSTRAINT career_executions_kind_check CHECK (kind IN (
    'companies_discover',
    'companies_enrich',
    'companies_import',
    'jobs_search',
    'application_prepare',
    'application_send',
    'import'
  ));
