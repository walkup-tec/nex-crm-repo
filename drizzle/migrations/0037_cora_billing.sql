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
