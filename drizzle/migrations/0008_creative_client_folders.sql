INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'nex-creatives',
  'nex-creatives',
  false,
  209715200,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'video/mp4', 'video/quicktime']
)
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE UNIQUE INDEX IF NOT EXISTS creative_folders_one_root_per_org
  ON public.creative_folders (organization_id)
  WHERE parent_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS creative_files_folder_name_idx
  ON public.creative_files (folder_id, name);

CREATE OR REPLACE FUNCTION public.creative_folder_same_client()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.parent_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.creative_folders parent
    WHERE parent.id = NEW.parent_id AND parent.organization_id = NEW.organization_id
  ) THEN
    RAISE EXCEPTION 'A subpasta precisa ficar na pasta deste cliente';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS creative_folder_same_client ON public.creative_folders;
CREATE TRIGGER creative_folder_same_client
  BEFORE INSERT OR UPDATE ON public.creative_folders
  FOR EACH ROW EXECUTE FUNCTION public.creative_folder_same_client();

CREATE OR REPLACE FUNCTION public.creative_file_same_client()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  folder_org uuid;
BEGIN
  IF NEW.folder_id IS NULL THEN
    RAISE EXCEPTION 'O arquivo precisa ficar dentro da pasta do cliente';
  END IF;
  SELECT organization_id INTO folder_org FROM public.creative_folders WHERE id = NEW.folder_id;
  IF folder_org IS NULL OR folder_org IS DISTINCT FROM NEW.organization_id THEN
    RAISE EXCEPTION 'O arquivo precisa ficar na pasta deste cliente';
  END IF;
  IF split_part(NEW.storage_path, '/', 1) IS DISTINCT FROM NEW.organization_id::text THEN
    RAISE EXCEPTION 'O arquivo precisa ficar na pasta deste cliente';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS creative_file_same_client ON public.creative_files;
CREATE TRIGGER creative_file_same_client
  BEFORE INSERT OR UPDATE ON public.creative_files
  FOR EACH ROW EXECUTE FUNCTION public.creative_file_same_client();

DROP POLICY IF EXISTS "tenant reads creative objects" ON storage.objects;
DROP POLICY IF EXISTS "masters upload creative objects" ON storage.objects;
DROP POLICY IF EXISTS "masters update creative objects" ON storage.objects;
DROP POLICY IF EXISTS "masters delete creative objects" ON storage.objects;

CREATE POLICY "tenant reads creative objects" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'nex-creatives' AND ((storage.foldername(name))[1] = public.current_organization_id()::text OR public.is_master()));
CREATE POLICY "masters upload creative objects" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'nex-creatives' AND public.is_master() AND (storage.foldername(name))[1] <> '');
CREATE POLICY "masters update creative objects" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'nex-creatives' AND public.is_master()) WITH CHECK (bucket_id = 'nex-creatives' AND public.is_master());
CREATE POLICY "masters delete creative objects" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'nex-creatives' AND public.is_master());
