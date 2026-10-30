-- Cora billing stack for production Supabase.
-- Run once in SQL Editor: https://supabase.com/dashboard/project/djskqztincstkwvvjhsb/sql
-- Order: 0037_cora_billing + 0039_client_promotions + 0040_billing_notice_delivery

ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS billing_provider text,
  ADD COLUMN IF NOT EXISTS promo_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS promo_starts_on date,
  ADD COLUMN IF NOT EXISTS promo_ends_on date,
  ADD COLUMN IF NOT EXISTS after_promo_cents bigint,
  ADD COLUMN IF NOT EXISTS delinquency_mode text,
  ADD COLUMN IF NOT EXISTS delinquency_amount_cents bigint;

ALTER TABLE public.contracts DROP CONSTRAINT IF EXISTS contracts_billing_provider_check;
ALTER TABLE public.contracts
  ADD CONSTRAINT contracts_billing_provider_check
  CHECK (billing_provider IS NULL OR billing_provider IN ('asaas', 'cora'));

ALTER TABLE public.contracts DROP CONSTRAINT IF EXISTS contracts_delinquency_mode_check;
ALTER TABLE public.contracts
  ADD CONSTRAINT contracts_delinquency_mode_check
  CHECK (delinquency_mode IS NULL OR delinquency_mode IN ('rate', 'amount'));

CREATE TABLE IF NOT EXISTS public.billing_notices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  due_date date NOT NULL,
  kind text NOT NULL CHECK (kind IN ('before_7', 'before_3', 'due', 'after_1', 'after_3', 'after_5')),
  send_on date NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'skipped')),
  body text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, due_date, kind)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.billing_notices TO authenticated;
GRANT ALL ON public.billing_notices TO service_role;
ALTER TABLE public.billing_notices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "masters manage billing notices" ON public.billing_notices;
CREATE POLICY "masters manage billing notices" ON public.billing_notices
  FOR ALL TO authenticated
  USING (public.is_master())
  WITH CHECK (public.is_master());

CREATE TABLE IF NOT EXISTS public.client_promotions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  starts_on date NOT NULL,
  ends_on date NOT NULL,
  amount_cents bigint NOT NULL,
  nominal_cents bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_on >= starts_on),
  CHECK (amount_cents >= 500),
  CHECK (nominal_cents >= 500)
);

CREATE INDEX IF NOT EXISTS client_promotions_organization_idx
  ON public.client_promotions (organization_id, starts_on);

INSERT INTO public.client_promotions (organization_id, starts_on, ends_on, amount_cents, nominal_cents)
SELECT organization_id, promo_starts_on, promo_ends_on, monthly_fee_cents, after_promo_cents
FROM public.contracts
WHERE promo_enabled
  AND promo_starts_on IS NOT NULL
  AND promo_ends_on IS NOT NULL
  AND after_promo_cents IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.client_promotions AS promo
    WHERE promo.organization_id = contracts.organization_id
      AND promo.starts_on = contracts.promo_starts_on
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_promotions TO authenticated;
GRANT ALL ON public.client_promotions TO service_role;
ALTER TABLE public.client_promotions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "masters manage client promotions" ON public.client_promotions;
CREATE POLICY "masters manage client promotions" ON public.client_promotions
  FOR ALL TO authenticated
  USING (public.is_master())
  WITH CHECK (public.is_master());

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
