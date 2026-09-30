CREATE TYPE public.app_role AS ENUM ('master', 'client_admin', 'client_user');
CREATE TYPE public.client_status AS ENUM ('active', 'overdue', 'blocked', 'contract_ended', 'disabled');
CREATE TYPE public.invoice_status AS ENUM ('pending', 'overdue', 'paid', 'cancelled');

CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legal_name text NOT NULL,
  document text NOT NULL UNIQUE,
  responsible_name text NOT NULL,
  responsible_email text NOT NULL,
  responsible_phone text NOT NULL,
  finance_phone text NOT NULL,
  status public.client_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organizations TO authenticated;
GRANT ALL ON public.organizations TO service_role;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  email text NOT NULL,
  avatar_url text,
  theme text NOT NULL DEFAULT 'light' CHECK (theme IN ('light', 'dark')),
  is_blocked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_permissions (
  user_id uuid PRIMARY KEY,
  can_view_campaigns boolean NOT NULL DEFAULT true,
  can_view_meta_balance boolean NOT NULL DEFAULT false,
  can_add_meta_credit boolean NOT NULL DEFAULT false,
  can_manage_users boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_permissions TO authenticated;
GRANT ALL ON public.user_permissions TO service_role;
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.meta_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  external_account_id text NOT NULL,
  name text NOT NULL,
  portfolio_id text,
  balance_cents bigint NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'BRL',
  last_synced_at timestamptz,
  sync_status text NOT NULL DEFAULT 'pending',
  UNIQUE (organization_id, external_account_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meta_accounts TO authenticated;
GRANT ALL ON public.meta_accounts TO service_role;
ALTER TABLE public.meta_accounts ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  meta_account_id uuid NOT NULL REFERENCES public.meta_accounts(id) ON DELETE CASCADE,
  external_campaign_id text NOT NULL,
  name text NOT NULL,
  delivery_status text NOT NULL,
  result_type text NOT NULL,
  reach bigint NOT NULL DEFAULT 0,
  impressions bigint NOT NULL DEFAULT 0,
  results numeric(14,2) NOT NULL DEFAULT 0,
  cost_per_result_cents bigint,
  budget_cents bigint,
  spent_cents bigint,
  starts_on date,
  ends_on date,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (meta_account_id, external_campaign_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaigns TO authenticated;
GRANT ALL ON public.campaigns TO service_role;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
  monthly_fee_cents bigint NOT NULL CHECK (monthly_fee_cents >= 0),
  starts_on date NOT NULL,
  ends_on date,
  due_day smallint NOT NULL CHECK (due_day BETWEEN 1 AND 28),
  fine_percent numeric(7,4) NOT NULL DEFAULT 0,
  interest_percent_monthly numeric(7,4) NOT NULL DEFAULT 0,
  external_subscription_id text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contracts TO authenticated;
GRANT ALL ON public.contracts TO service_role;
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  competence date NOT NULL,
  due_date date NOT NULL,
  base_amount_cents bigint NOT NULL,
  total_amount_cents bigint NOT NULL,
  status public.invoice_status NOT NULL DEFAULT 'pending',
  paid_at timestamptz,
  external_charge_id text UNIQUE,
  invoice_url text,
  pix_code text,
  penalties_waived boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, competence)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoices TO authenticated;
GRANT ALL ON public.invoices TO service_role;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.creative_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.creative_folders(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, parent_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.creative_folders TO authenticated;
GRANT ALL ON public.creative_folders TO service_role;
ALTER TABLE public.creative_folders ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.creative_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  folder_id uuid REFERENCES public.creative_folders(id) ON DELETE CASCADE,
  storage_path text NOT NULL UNIQUE,
  name text NOT NULL,
  mime_type text NOT NULL,
  size_bytes bigint NOT NULL CHECK (size_bytes >= 0),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.creative_files TO authenticated;
GRANT ALL ON public.creative_files TO service_role;
ALTER TABLE public.creative_files ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.alert_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  type text NOT NULL,
  cycle_key text NOT NULL,
  recipient text NOT NULL,
  status text NOT NULL,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, type, cycle_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.alert_events TO authenticated;
GRANT ALL ON public.alert_events TO service_role;
ALTER TABLE public.alert_events ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  actor_id uuid NOT NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

CREATE OR REPLACE FUNCTION public.current_organization_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT organization_id FROM public.profiles WHERE id = auth.uid()
$$;
GRANT EXECUTE ON FUNCTION public.current_organization_id() TO authenticated;

CREATE OR REPLACE FUNCTION public.is_master()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(), 'master')
$$;
GRANT EXECUTE ON FUNCTION public.is_master() TO authenticated;

CREATE POLICY "members read organization" ON public.organizations FOR SELECT TO authenticated USING (id = public.current_organization_id() OR public.is_master());
CREATE POLICY "masters manage organizations" ON public.organizations FOR ALL TO authenticated USING (public.is_master()) WITH CHECK (public.is_master());

CREATE POLICY "users read own organization profiles" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid() OR organization_id = public.current_organization_id() OR public.is_master());
CREATE POLICY "users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid() AND organization_id IS NOT DISTINCT FROM public.current_organization_id());
CREATE POLICY "masters manage profiles" ON public.profiles FOR ALL TO authenticated USING (public.is_master()) WITH CHECK (public.is_master());

CREATE POLICY "users read own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_master());
CREATE POLICY "masters manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.is_master()) WITH CHECK (public.is_master());

CREATE POLICY "members read organization permissions" ON public.user_permissions FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_master() OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = user_permissions.user_id AND p.organization_id = public.current_organization_id() AND public.has_role(auth.uid(), 'client_admin')));
CREATE POLICY "admins manage organization permissions" ON public.user_permissions FOR ALL TO authenticated USING (public.is_master() OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = user_permissions.user_id AND p.organization_id = public.current_organization_id() AND public.has_role(auth.uid(), 'client_admin'))) WITH CHECK (public.is_master() OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = user_permissions.user_id AND p.organization_id = public.current_organization_id() AND public.has_role(auth.uid(), 'client_admin')));

CREATE POLICY "tenant read meta accounts" ON public.meta_accounts FOR SELECT TO authenticated USING (organization_id = public.current_organization_id() OR public.is_master());
CREATE POLICY "masters manage meta accounts" ON public.meta_accounts FOR ALL TO authenticated USING (public.is_master()) WITH CHECK (public.is_master());
CREATE POLICY "tenant read campaigns" ON public.campaigns FOR SELECT TO authenticated USING ((organization_id = public.current_organization_id() AND COALESCE((SELECT can_view_campaigns FROM public.user_permissions WHERE user_id = auth.uid()), true)) OR public.is_master());
CREATE POLICY "masters manage campaigns" ON public.campaigns FOR ALL TO authenticated USING (public.is_master()) WITH CHECK (public.is_master());
CREATE POLICY "tenant read contracts" ON public.contracts FOR SELECT TO authenticated USING (organization_id = public.current_organization_id() OR public.is_master());
CREATE POLICY "masters manage contracts" ON public.contracts FOR ALL TO authenticated USING (public.is_master()) WITH CHECK (public.is_master());
CREATE POLICY "tenant read invoices" ON public.invoices FOR SELECT TO authenticated USING (organization_id = public.current_organization_id() OR public.is_master());
CREATE POLICY "masters manage invoices" ON public.invoices FOR ALL TO authenticated USING (public.is_master()) WITH CHECK (public.is_master());
CREATE POLICY "tenant read folders" ON public.creative_folders FOR SELECT TO authenticated USING (organization_id = public.current_organization_id() OR public.is_master());
CREATE POLICY "masters manage folders" ON public.creative_folders FOR ALL TO authenticated USING (public.is_master()) WITH CHECK (public.is_master());
CREATE POLICY "tenant read files" ON public.creative_files FOR SELECT TO authenticated USING (organization_id = public.current_organization_id() OR public.is_master());
CREATE POLICY "masters manage files" ON public.creative_files FOR ALL TO authenticated USING (public.is_master()) WITH CHECK (public.is_master());
CREATE POLICY "tenant read alerts" ON public.alert_events FOR SELECT TO authenticated USING (organization_id = public.current_organization_id() OR public.is_master());
CREATE POLICY "masters manage alerts" ON public.alert_events FOR ALL TO authenticated USING (public.is_master()) WITH CHECK (public.is_master());
CREATE POLICY "tenant read audit" ON public.audit_logs FOR SELECT TO authenticated USING (organization_id = public.current_organization_id() OR public.is_master());
CREATE POLICY "authenticated insert audit" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (actor_id = auth.uid() AND (organization_id = public.current_organization_id() OR public.is_master()));

CREATE INDEX campaigns_org_account_idx ON public.campaigns (organization_id, meta_account_id);
CREATE INDEX invoices_org_due_idx ON public.invoices (organization_id, due_date DESC);
CREATE INDEX creative_files_org_folder_idx ON public.creative_files (organization_id, folder_id);
CREATE INDEX audit_logs_org_created_idx ON public.audit_logs (organization_id, created_at DESC);