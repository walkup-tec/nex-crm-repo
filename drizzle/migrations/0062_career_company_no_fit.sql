-- Status de empresa: sem perfil adequado para o candidato (painel Master).
ALTER TABLE public.career_companies DROP CONSTRAINT IF EXISTS career_companies_prospect_status_check;
ALTER TABLE public.career_companies
  ADD CONSTRAINT career_companies_prospect_status_check CHECK (
    prospect_status IN ('new', 'researching', 'contacted', 'qualified', 'archived', 'no_fit')
  );
