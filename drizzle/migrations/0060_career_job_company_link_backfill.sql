-- Backfill idempotente: vincula as 3 vagas reais do lote 2026-11-18 às empresas descobertas.
-- Não recria registros; só preenche company_id/company_name quando divergente.

UPDATE public.career_jobs
SET
  company_id = '4ce0c890-1e96-42a9-a67c-85169aeef8fe'::uuid,
  company_name = COALESCE(NULLIF(BTRIM(company_name), ''), 'Photon Company'),
  updated_at = now()
WHERE id = 'd993082f-1093-4f51-be49-7b544a1f0925'::uuid
  AND company_id IS DISTINCT FROM '4ce0c890-1e96-42a9-a67c-85169aeef8fe'::uuid;

UPDATE public.career_jobs
SET
  company_id = '1142bc5e-745d-45c3-9297-0236db759003'::uuid,
  company_name = COALESCE(NULLIF(BTRIM(company_name), ''), 'Stark Business'),
  updated_at = now()
WHERE id = '5ff1e98d-5c64-43df-92f1-25f7c5c617e7'::uuid
  AND company_id IS DISTINCT FROM '1142bc5e-745d-45c3-9297-0236db759003'::uuid;

UPDATE public.career_jobs
SET
  company_id = '9d367af6-d7e4-4726-ba37-987e23167881'::uuid,
  company_name = COALESCE(NULLIF(BTRIM(company_name), ''), 'Biosanté'),
  updated_at = now()
WHERE id = '9fa5828c-d58d-4258-95b7-a8f84d9345eb'::uuid
  AND company_id IS DISTINCT FROM '9d367af6-d7e4-4726-ba37-987e23167881'::uuid;
