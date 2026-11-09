-- Produto Hospedagem + cobrança Manual (Pix pessoal) sem Cora/Asaas.

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS product_hosting boolean NOT NULL DEFAULT false;

ALTER TABLE public.organizations DROP CONSTRAINT IF EXISTS organizations_ads_platform_check;
ALTER TABLE public.organizations
  ADD CONSTRAINT organizations_ads_platform_check
  CHECK (ads_meta OR ads_google OR product_hosting);

ALTER TABLE public.contracts DROP CONSTRAINT IF EXISTS contracts_billing_provider_check;
ALTER TABLE public.contracts
  ADD CONSTRAINT contracts_billing_provider_check
  CHECK (billing_provider IS NULL OR billing_provider IN ('asaas', 'cora', 'manual'));
