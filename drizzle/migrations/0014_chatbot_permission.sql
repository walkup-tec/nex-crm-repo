ALTER TABLE public.user_permissions
  ADD COLUMN IF NOT EXISTS can_use_chatbot boolean NOT NULL DEFAULT false;
