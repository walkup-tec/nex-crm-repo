CREATE TABLE public.chatbot_conversation_pins (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES public.chatbot_conversations(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, conversation_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chatbot_conversation_pins TO authenticated;
GRANT ALL ON public.chatbot_conversation_pins TO service_role;
ALTER TABLE public.chatbot_conversation_pins ENABLE ROW LEVEL SECURITY;
CREATE INDEX chatbot_conversation_pins_org_idx ON public.chatbot_conversation_pins (organization_id, user_id);
CREATE POLICY "tenant reads chatbot conversation pins" ON public.chatbot_conversation_pins FOR SELECT TO authenticated USING (organization_id = public.current_organization_id() OR public.is_master());

CREATE TABLE public.chatbot_conversation_reads (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES public.chatbot_conversations(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, conversation_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chatbot_conversation_reads TO authenticated;
GRANT ALL ON public.chatbot_conversation_reads TO service_role;
ALTER TABLE public.chatbot_conversation_reads ENABLE ROW LEVEL SECURITY;
CREATE INDEX chatbot_conversation_reads_org_idx ON public.chatbot_conversation_reads (organization_id, user_id);
CREATE POLICY "tenant reads chatbot conversation reads" ON public.chatbot_conversation_reads FOR SELECT TO authenticated USING (organization_id = public.current_organization_id() OR public.is_master());
