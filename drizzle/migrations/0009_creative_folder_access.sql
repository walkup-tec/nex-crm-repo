DROP INDEX IF EXISTS public.creative_folders_one_root_per_org;

CREATE UNIQUE INDEX IF NOT EXISTS creative_folders_root_name_per_org
  ON public.creative_folders (organization_id, name)
  WHERE parent_id IS NULL;
