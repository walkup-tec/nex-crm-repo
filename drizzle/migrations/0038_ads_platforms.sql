ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS ads_meta boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS ads_google boolean NOT NULL DEFAULT false;

ALTER TABLE public.organizations DROP CONSTRAINT IF EXISTS organizations_ads_platform_check;
ALTER TABLE public.organizations
  ADD CONSTRAINT organizations_ads_platform_check
  CHECK (ads_meta OR ads_google);
