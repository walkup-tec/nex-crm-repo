ALTER TABLE public.chatbot_contacts
  ADD COLUMN IF NOT EXISTS contract_term_days integer;

COMMENT ON COLUMN public.chatbot_contacts.contract_term_days IS
  'Vigência inicial do contrato em dias (ex.: 30 ou 90), definida ao enviar a assinatura.';
