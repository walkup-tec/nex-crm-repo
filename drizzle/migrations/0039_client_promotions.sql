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
