ALTER TABLE public.chatbot_messages
  ADD COLUMN IF NOT EXISTS media_kind text,
  ADD COLUMN IF NOT EXISTS media_mime text;

CREATE TABLE public.chatbot_contact_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.chatbot_contacts(id) ON DELETE CASCADE,
  message_id uuid REFERENCES public.chatbot_messages(id) ON DELETE SET NULL,
  name text NOT NULL,
  mime_type text NOT NULL,
  storage_path text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chatbot_contact_files TO authenticated;
GRANT ALL ON public.chatbot_contact_files TO service_role;
ALTER TABLE public.chatbot_contact_files ENABLE ROW LEVEL SECURITY;
CREATE INDEX chatbot_contact_files_contact_idx ON public.chatbot_contact_files (organization_id, contact_id);
CREATE UNIQUE INDEX chatbot_contact_files_message_idx ON public.chatbot_contact_files (message_id) WHERE message_id IS NOT NULL;
CREATE POLICY "tenant reads chatbot contact files" ON public.chatbot_contact_files FOR SELECT TO authenticated USING (organization_id = public.current_organization_id() OR public.is_master());
