CREATE TABLE public.chatbot_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  instance_name text NOT NULL UNIQUE,
  display_name text NOT NULL,
  phone text,
  status text NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'qr', 'connecting', 'connected', 'disconnected', 'error')),
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chatbot_connections TO authenticated;
GRANT ALL ON public.chatbot_connections TO service_role;
ALTER TABLE public.chatbot_connections ENABLE ROW LEVEL SECURITY;
CREATE INDEX chatbot_connections_org_idx ON public.chatbot_connections (organization_id);

CREATE TABLE public.chatbot_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, phone)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chatbot_contacts TO authenticated;
GRANT ALL ON public.chatbot_contacts TO service_role;
ALTER TABLE public.chatbot_contacts ENABLE ROW LEVEL SECURITY;
CREATE INDEX chatbot_contacts_org_idx ON public.chatbot_contacts (organization_id);

CREATE TABLE public.chatbot_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.chatbot_contacts(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES public.chatbot_connections(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'queue' CHECK (status IN ('queue', 'active', 'closed')),
  assignee_id uuid,
  bot_paused boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (connection_id, contact_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chatbot_conversations TO authenticated;
GRANT ALL ON public.chatbot_conversations TO service_role;
ALTER TABLE public.chatbot_conversations ENABLE ROW LEVEL SECURITY;
CREATE INDEX chatbot_conversations_org_idx ON public.chatbot_conversations (organization_id, updated_at DESC);

CREATE TABLE public.chatbot_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES public.chatbot_conversations(id) ON DELETE CASCADE,
  text text NOT NULL,
  direction text NOT NULL CHECK (direction IN ('in', 'out')),
  status text NOT NULL DEFAULT 'sent' CHECK (status IN ('pending', 'sent', 'failed')),
  external_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chatbot_messages TO authenticated;
GRANT ALL ON public.chatbot_messages TO service_role;
ALTER TABLE public.chatbot_messages ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX chatbot_messages_external_idx ON public.chatbot_messages (conversation_id, external_id) WHERE external_id IS NOT NULL;
CREATE INDEX chatbot_messages_conversation_idx ON public.chatbot_messages (conversation_id, created_at);

CREATE POLICY "tenant reads chatbot connections" ON public.chatbot_connections FOR SELECT TO authenticated USING (organization_id = public.current_organization_id() OR public.is_master());
CREATE POLICY "tenant reads chatbot contacts" ON public.chatbot_contacts FOR SELECT TO authenticated USING (organization_id = public.current_organization_id() OR public.is_master());
CREATE POLICY "tenant reads chatbot conversations" ON public.chatbot_conversations FOR SELECT TO authenticated USING (organization_id = public.current_organization_id() OR public.is_master());
CREATE POLICY "tenant reads chatbot messages" ON public.chatbot_messages FOR SELECT TO authenticated USING (organization_id = public.current_organization_id() OR public.is_master());
