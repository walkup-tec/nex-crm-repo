import { supabase } from "@/integrations/supabase/client";
import { ensureCreativesBucketFn } from "@/lib/creatives.functions";
import {
  creativeErrorMessage,
  inspectCreativeFile,
  filesUnder,
  pathBelongsToClient,
  planClientFolder,
  planFileName,
  planFolderRename,
  planMove,
  planSubfolder,
  scopeToClient,
  storageObjectPath,
  type CreativeFile,
  type CreativeFolder,
  type CreativeGateway,
  type CreativeSnapshot,
} from "@/lib/creative-library";

const BUCKET = "nex-creatives";

function fail(error: { message?: string; code?: string } | null, fallback: string): never {
  throw new Error(creativeErrorMessage(error, fallback));
}

async function userId() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("Entre novamente para ver os criativos.");
  return data.user.id;
}

function mapFolder(row: {
  id: string;
  organization_id: string;
  parent_id: string | null;
  name: string;
}): CreativeFolder {
  return {
    id: row.id,
    organizationId: row.organization_id,
    parentId: row.parent_id,
    name: row.name,
  };
}

function mapFile(row: {
  id: string;
  organization_id: string;
  folder_id: string | null;
  name: string;
  mime_type: string;
  size_bytes: number;
  storage_path: string;
}): CreativeFile | null {
  if (!row.folder_id) return null;
  return {
    id: row.id,
    organizationId: row.organization_id,
    folderId: row.folder_id,
    name: row.name,
    mimeType: row.mime_type,
    sizeBytes: Number(row.size_bytes),
    storagePath: row.storage_path,
  };
}

async function fetchSnapshot(mode: "master" | "client"): Promise<CreativeSnapshot> {
  const id = await userId();
  const [organizations, folders, files, profile] = await Promise.all([
    supabase.from("organizations").select("id, legal_name").order("legal_name"),
    supabase.from("creative_folders").select("id, organization_id, parent_id, name").order("name"),
    supabase
      .from("creative_files")
      .select("id, organization_id, folder_id, name, mime_type, size_bytes, storage_path")
      .order("name"),
    supabase.from("profiles").select("organization_id").eq("id", id).maybeSingle(),
  ]);
  if (organizations.error) fail(organizations.error, "Não foi possível carregar os clientes.");
  if (folders.error) fail(folders.error, "Não foi possível carregar as pastas.");
  if (files.error) fail(files.error, "Não foi possível carregar os arquivos.");
  if (profile.error) fail(profile.error, "Não foi possível carregar a conta.");
  const snapshot: CreativeSnapshot = {
    clients: (organizations.data ?? []).map((client) => ({
      id: client.id,
      name: client.legal_name,
    })),
    folders: (folders.data ?? []).map(mapFolder),
    files: (files.data ?? []).flatMap((file) => {
      const mapped = mapFile(file);
      return mapped ? [mapped] : [];
    }),
  };
  if (mode === "client") return scopeToClient(snapshot, profile.data?.organization_id ?? null);
  return snapshot;
}

let bucketReady = false;

async function ensureBucket() {
  if (bucketReady) return;
  const result = await ensureCreativesBucketFn();
  if (!result.ok) throw new Error(result.message);
  bucketReady = true;
}

async function signedUrl(file: CreativeFile, download: boolean) {
  if (!pathBelongsToClient(file.storagePath, file.organizationId))
    throw new Error("O arquivo fica na pasta deste cliente.");
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(
      file.storagePath,
      download ? 120 : 600,
      download ? { download: file.name } : undefined,
    );
  if (error || !data?.signedUrl) fail(error, "Não foi possível abrir o arquivo.");
  return data.signedUrl;
}

export function supabaseCreativeGateway(mode: "master" | "client"): CreativeGateway {
  const master = () => {
    if (mode !== "master") throw new Error("Só o Master organiza os criativos.");
  };

  return {
    load: () => fetchSnapshot(mode),
    async createClientFolder(organizationId) {
      master();
      const snapshot = await fetchSnapshot("master");
      const plan = planClientFolder(snapshot.clients, snapshot.folders, organizationId);
      if (!plan.ok) throw new Error(plan.message);
      const { data, error } = await supabase
        .from("creative_folders")
        .insert({
          organization_id: organizationId,
          parent_id: null,
          name: plan.name,
          created_by: await userId(),
        })
        .select("id, organization_id, parent_id, name")
        .single();
      if (error || !data) fail(error, "Não foi possível criar a pasta do cliente.");
      return mapFolder(data);
    },
    async createSubfolder(parentId, name) {
      master();
      const snapshot = await fetchSnapshot("master");
      const plan = planSubfolder(snapshot.folders, snapshot.files, parentId, name);
      if (!plan.ok) throw new Error(plan.message);
      const { data, error } = await supabase
        .from("creative_folders")
        .insert({
          organization_id: plan.organizationId,
          parent_id: parentId,
          name: plan.name,
          created_by: await userId(),
        })
        .select("id, organization_id, parent_id, name")
        .single();
      if (error || !data) fail(error, "Não foi possível criar a pasta.");
      return mapFolder(data);
    },
    async upload(folderId, file) {
      master();
      const snapshot = await fetchSnapshot("master");
      const folder = snapshot.folders.find((item) => item.id === folderId);
      if (!folder) throw new Error("Abra a pasta do cliente antes de enviar o arquivo.");
      const inspected = inspectCreativeFile(file);
      if (!inspected.ok || !inspected.mimeType)
        throw new Error(inspected.ok ? "Use JPG, PNG, WEBP, PDF, MP4 ou MOV." : inspected.message);
      const named = planFileName(snapshot.files, snapshot.folders, folderId, inspected.name);
      if (!named.ok) throw new Error(named.message);
      await ensureBucket();
      const id = crypto.randomUUID();
      const storagePath = storageObjectPath(folder.organizationId, id, inspected.name);
      if (!pathBelongsToClient(storagePath, folder.organizationId))
        throw new Error("O arquivo fica na pasta deste cliente.");
      const uploaded = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, file, { contentType: inspected.mimeType, upsert: false });
      if (uploaded.error) fail(uploaded.error, "Não foi possível enviar o arquivo.");
      const inserted = await supabase
        .from("creative_files")
        .insert({
          id,
          organization_id: folder.organizationId,
          folder_id: folderId,
          storage_path: storagePath,
          name: inspected.name,
          mime_type: inspected.mimeType,
          size_bytes: file.size,
          created_by: await userId(),
        })
        .select("id, organization_id, folder_id, name, mime_type, size_bytes, storage_path")
        .single();
      if (inserted.error || !inserted.data) {
        await supabase.storage.from(BUCKET).remove([storagePath]);
        fail(inserted.error, "Não foi possível registrar o arquivo.");
      }
      const mapped = mapFile(inserted.data);
      if (!mapped) throw new Error("Não foi possível registrar o arquivo.");
      return mapped;
    },
    async renameFolder(id, name) {
      master();
      const snapshot = await fetchSnapshot("master");
      const plan = planFolderRename(snapshot.folders, snapshot.files, id, name);
      if (!plan.ok) throw new Error(plan.message);
      const { error } = await supabase
        .from("creative_folders")
        .update({ name: plan.name })
        .eq("id", id);
      if (error) fail(error, "Não foi possível renomear a pasta.");
    },
    async renameFile(id, name) {
      master();
      const snapshot = await fetchSnapshot("master");
      const current = snapshot.files.find((file) => file.id === id);
      if (!current) throw new Error("Arquivo não encontrado.");
      const plan = planFileName(snapshot.files, snapshot.folders, current.folderId, name, id);
      if (!plan.ok) throw new Error(plan.message);
      const { error } = await supabase
        .from("creative_files")
        .update({ name: plan.name })
        .eq("id", id);
      if (error) fail(error, "Não foi possível renomear o arquivo.");
    },
    async deleteFolder(id) {
      master();
      const snapshot = await fetchSnapshot("master");
      const paths = filesUnder(snapshot.folders, snapshot.files, id).map(
        (file) => file.storagePath,
      );
      for (let index = 0; index < paths.length; index += 100) {
        const removed = await supabase.storage.from(BUCKET).remove(paths.slice(index, index + 100));
        if (removed.error) fail(removed.error, "Não foi possível excluir os arquivos da pasta.");
      }
      const { error } = await supabase.from("creative_folders").delete().eq("id", id);
      if (error) fail(error, "Não foi possível excluir a pasta.");
    },
    async deleteFile(id) {
      master();
      const snapshot = await fetchSnapshot("master");
      const current = snapshot.files.find((file) => file.id === id);
      if (!current) return;
      const removed = await supabase.storage.from(BUCKET).remove([current.storagePath]);
      if (removed.error) fail(removed.error, "Não foi possível excluir o arquivo.");
      const { error } = await supabase.from("creative_files").delete().eq("id", id);
      if (error) fail(error, "Não foi possível excluir o arquivo.");
    },
    async moveFile(id, folderId) {
      master();
      const snapshot = await fetchSnapshot("master");
      const plan = planMove(snapshot.folders, snapshot.files, id, folderId);
      if (!plan.ok) throw new Error(plan.message);
      const target = snapshot.folders.find((folder) => folder.id === folderId);
      const current = snapshot.files.find((file) => file.id === id);
      if (!target || !current || target.organizationId !== current.organizationId)
        throw new Error("O arquivo fica na pasta deste cliente.");
      const { error } = await supabase
        .from("creative_files")
        .update({ folder_id: folderId })
        .eq("id", id)
        .eq("organization_id", current.organizationId);
      if (error) fail(error, "Não foi possível mover o arquivo.");
    },
    downloadUrl: (file) => signedUrl(file, true),
    async previewUrl(file) {
      return signedUrl(file, false);
    },
  };
}
