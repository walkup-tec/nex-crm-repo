ALTER TABLE public.billing_notices
  ADD COLUMN IF NOT EXISTS invoice_id uuid,
  ADD COLUMN IF NOT EXISTS channel text,
  ADD COLUMN IF NOT EXISTS provider_message_id text,
  ADD COLUMN IF NOT EXISTS error text,
  ADD COLUMN IF NOT EXISTS sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS claimed_at timestamptz;

DO $$
DECLARE
  constraint_name text;
BEGIN
  FOR constraint_name IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'billing_notices'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE public.billing_notices DROP CONSTRAINT %I', constraint_name);
  END LOOP;
END $$;

ALTER TABLE public.billing_notices
  ADD CONSTRAINT billing_notices_status_check
  CHECK (status IN ('pending', 'sending', 'sent', 'failed', 'skipped'));

CREATE INDEX IF NOT EXISTS billing_notices_pending_send_idx
  ON public.billing_notices (send_on)
  WHERE status = 'pending';
