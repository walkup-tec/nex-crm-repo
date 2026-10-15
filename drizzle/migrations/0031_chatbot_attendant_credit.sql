ALTER TABLE public.chatbot_conversations
  ADD COLUMN IF NOT EXISTS assumed_by uuid;

ALTER TABLE public.chatbot_contacts
  ADD COLUMN IF NOT EXISTS stage_set_by uuid;

UPDATE public.chatbot_conversations
SET assumed_by = assignee_id
WHERE assumed_by IS NULL
  AND assignee_id IS NOT NULL;

UPDATE public.chatbot_contacts AS contact
SET stage_set_by = credit.attendant_id
FROM (
  SELECT contact_id, min(attendant_id) AS attendant_id
  FROM (
    SELECT contact_id, coalesce(assumed_by, assignee_id) AS attendant_id
    FROM public.chatbot_conversations
    WHERE coalesce(assumed_by, assignee_id) IS NOT NULL
  ) AS linked
  GROUP BY contact_id
  HAVING count(DISTINCT attendant_id) = 1
) AS credit
WHERE contact.id = credit.contact_id
  AND contact.stage_set_by IS NULL
  AND lower(btrim(contact.stage_name)) = 'sucesso';
