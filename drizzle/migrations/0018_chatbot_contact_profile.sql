ALTER TABLE public.chatbot_contacts
  ADD COLUMN IF NOT EXISTS name_edited boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.chatbot_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chatbot_tags TO authenticated;
GRANT ALL ON public.chatbot_tags TO service_role;
ALTER TABLE public.chatbot_tags ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS chatbot_tags_org_idx ON public.chatbot_tags (organization_id);
DROP POLICY IF EXISTS "tenant reads chatbot tags" ON public.chatbot_tags;
CREATE POLICY "tenant reads chatbot tags" ON public.chatbot_tags FOR SELECT TO authenticated USING (organization_id = public.current_organization_id() OR public.is_master());

CREATE TABLE IF NOT EXISTS public.chatbot_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chatbot_products TO authenticated;
GRANT ALL ON public.chatbot_products TO service_role;
ALTER TABLE public.chatbot_products ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS chatbot_products_org_idx ON public.chatbot_products (organization_id);
DROP POLICY IF EXISTS "tenant reads chatbot products" ON public.chatbot_products;
CREATE POLICY "tenant reads chatbot products" ON public.chatbot_products FOR SELECT TO authenticated USING (organization_id = public.current_organization_id() OR public.is_master());

CREATE TABLE IF NOT EXISTS public.chatbot_contact_tags (
  contact_id uuid NOT NULL REFERENCES public.chatbot_contacts(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES public.chatbot_tags(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  PRIMARY KEY (contact_id, tag_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chatbot_contact_tags TO authenticated;
GRANT ALL ON public.chatbot_contact_tags TO service_role;
ALTER TABLE public.chatbot_contact_tags ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS chatbot_contact_tags_org_idx ON public.chatbot_contact_tags (organization_id);
DROP POLICY IF EXISTS "tenant reads chatbot contact tags" ON public.chatbot_contact_tags;
CREATE POLICY "tenant reads chatbot contact tags" ON public.chatbot_contact_tags FOR SELECT TO authenticated USING (organization_id = public.current_organization_id() OR public.is_master());

CREATE TABLE IF NOT EXISTS public.chatbot_contact_products (
  contact_id uuid NOT NULL REFERENCES public.chatbot_contacts(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.chatbot_products(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  PRIMARY KEY (contact_id, product_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chatbot_contact_products TO authenticated;
GRANT ALL ON public.chatbot_contact_products TO service_role;
ALTER TABLE public.chatbot_contact_products ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS chatbot_contact_products_org_idx ON public.chatbot_contact_products (organization_id);
DROP POLICY IF EXISTS "tenant reads chatbot contact products" ON public.chatbot_contact_products;
CREATE POLICY "tenant reads chatbot contact products" ON public.chatbot_contact_products FOR SELECT TO authenticated USING (organization_id = public.current_organization_id() OR public.is_master());
