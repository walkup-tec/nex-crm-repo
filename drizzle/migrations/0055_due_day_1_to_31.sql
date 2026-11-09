-- Dia de vencimento mensal: permitir 1–31 (meses curtos usam o último dia no app).

DO $$
DECLARE
  cname text;
BEGIN
  SELECT con.conname INTO cname
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
  WHERE nsp.nspname = 'public'
    AND rel.relname = 'contracts'
    AND con.contype = 'c'
    AND pg_get_constraintdef(con.oid) ILIKE '%due_day%'
  LIMIT 1;
  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.contracts DROP CONSTRAINT %I', cname);
  END IF;
END $$;

ALTER TABLE public.contracts
  ADD CONSTRAINT contracts_due_day_check CHECK (due_day BETWEEN 1 AND 31);
