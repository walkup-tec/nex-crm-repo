ALTER TABLE public.user_permissions
  ADD COLUMN IF NOT EXISTS chatbot_default_applied boolean NOT NULL DEFAULT false;

UPDATE public.user_permissions AS permissions
SET
  can_use_chatbot = true,
  can_view_campaigns = false,
  can_view_meta_balance = false,
  can_add_meta_credit = false,
  can_manage_users = false,
  chatbot_default_applied = true,
  updated_at = now()
WHERE permissions.chatbot_default_applied = false
  AND permissions.can_use_chatbot = false
  AND permissions.can_view_campaigns = true
  AND permissions.can_view_meta_balance = false
  AND permissions.can_add_meta_credit = false
  AND permissions.can_manage_users = false
  AND permissions.user_id IN (SELECT user_id FROM public.chatbot_team_members);
