ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS profiles_owner_id_idx ON public.profiles (owner_id);
