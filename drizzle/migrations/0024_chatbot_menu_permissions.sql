ALTER TABLE public.user_permissions
  ADD COLUMN IF NOT EXISTS chatbot_menus jsonb;
