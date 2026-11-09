-- Preserva histórico de conversas/contatos ao excluir um canal WhatsApp.
-- connection_id passa a ser opcional (órfão até reconectar) e SET NULL no delete.

ALTER TABLE public.chatbot_conversations
  DROP CONSTRAINT IF EXISTS chatbot_conversations_connection_id_fkey;

ALTER TABLE public.chatbot_conversations
  ALTER COLUMN connection_id DROP NOT NULL;

ALTER TABLE public.chatbot_conversations
  ADD CONSTRAINT chatbot_conversations_connection_id_fkey
  FOREIGN KEY (connection_id)
  REFERENCES public.chatbot_connections(id)
  ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS chatbot_conversations_orphan_org_idx
  ON public.chatbot_conversations (organization_id)
  WHERE connection_id IS NULL;
