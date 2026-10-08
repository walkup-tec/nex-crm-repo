export const CREATIVE_ACCEPT = ".jpg,.jpeg,.png,.webp,.pdf,.mp4,.mov";
export const CREATIVE_MAX_BYTES = 200 * 1024 * 1024;

const MIME_BY_EXTENSION = new Map<string, string>([
  ["jpg", "image/jpeg"],
  ["jpeg", "image/jpeg"],
  ["png", "image/png"],
  ["webp", "image/webp"],
  ["pdf", "application/pdf"],
  ["mp4", "video/mp4"],
  ["mov", "video/quicktime"],
]);

export type CreativeClient = { id: string; name: string };

export type CreativeFolder = {
  id: string;
  organizationId: string;
  parentId: string | null;
  name: string;
};

export type CreativeFile = {
  id: string;
  organizationId: string;
  folderId: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  storagePath: string;
};

export type CreativeSnapshot = {
  clients: CreativeClient[];
  folders: CreativeFolder[];
  files: CreativeFile[];
};

export type CreativeGateway = {
  load: () => Promise<CreativeSnapshot>;
  createClientFolder: (organizationId: string) => Promise<CreativeFolder>;
  createSubfolder: (parentId: string, name: string) => Promise<CreativeFolder>;
  upload: (folderId: string, file: File) => Promise<CreativeFile>;
  renameFolder: (id: string, name: string) => Promise<void>;
  renameFile: (id: string, name: string) => Promise<void>;
  deleteFolder: (id: string) => Promise<void>;
  deleteFile: (id: string) => Promise<void>;
  moveFile: (id: string, folderId: string) => Promise<void>;
  downloadUrl: (file: CreativeFile) => Promise<string>;
  previewUrl: (file: CreativeFile) => Promise<string | null>;
};

export type NamedResult = { ok: true; name: string } | { ok: false; message: string };

function sameName(left: string, right: string) {
  return left.localeCompare(right, "pt-BR", { sensitivity: "accent" }) === 0;
}

export function extensionOf(name: string) {
  const base = name.split(/[/\\]/).pop() ?? "";
  const dot = base.lastIndexOf(".");
  if (dot <= 0) return "";
  return base.slice(dot + 1).toLowerCase();
}

export function creativeKind(
  file: Pick<CreativeFile, "mimeType" | "name">,
): "Imagem" | "Vídeo" | "PDF" | "Arquivo" {
  const mime = file.mimeType || MIME_BY_EXTENSION.get(extensionOf(file.name)) || "";
  if (mime.startsWith("image/")) return "Imagem";
  if (mime.startsWith("video/")) return "Vídeo";
  if (mime === "application/pdf") return "PDF";
  return "Arquivo";
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB`;
}

export function inspectCreativeFile(file: {
  name: string;
  size: number;
}): NamedResult & { mimeType?: string } {
  const name = file.name.split(/[/\\]/).pop()?.trim() ?? "";
  if (!name || name === "." || name === "..")
    return { ok: false, message: "O arquivo não tem um nome válido." };
  const mimeType = MIME_BY_EXTENSION.get(extensionOf(name));
  if (!mimeType) return { ok: false, message: "Use JPG, PNG, WEBP, PDF, MP4 ou MOV." };
  if (file.size <= 0) return { ok: false, message: "O arquivo está vazio." };
  if (file.size > CREATIVE_MAX_BYTES) return { ok: false, message: "O arquivo passa de 200 MB." };
  return { ok: true, name, mimeType };
}

export function storageObjectPath(organizationId: string, fileId: string, fileName: string) {
  const safe = fileName
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "_")
    .replace(/^\.+/, "")
    .slice(0, 120);
  return `${organizationId}/${fileId}/${safe || "arquivo"}`;
}

export function pathBelongsToClient(path: string, organizationId: string) {
  return path.split("/")[0] === organizationId && organizationId.length > 0;
}

export function rootFolderOf(folders: CreativeFolder[], organizationId: string) {
  return (
    folders.find(
      (folder) => folder.organizationId === organizationId && folder.parentId === null,
    ) ?? null
  );
}

export function clientsAwaitingFolder(clients: CreativeClient[], folders: CreativeFolder[]) {
  return clients
    .filter((client) => !rootFolderOf(folders, client.id))
    .sort((left, right) => left.name.localeCompare(right.name, "pt-BR"));
}

export function planClientFolder(
  clients: CreativeClient[],
  folders: CreativeFolder[],
  organizationId: string,
): NamedResult {
  const client = clients.find((item) => item.id === organizationId);
  if (!client) return { ok: false, message: "Selecione um cliente." };
  const name = client.name.trim();
  if (!name) return { ok: false, message: "Este cliente não tem nome." };
  if (rootFolderOf(folders, organizationId))
    return { ok: false, message: "Este cliente já tem uma pasta." };
  return { ok: true, name };
}

function folderName(raw: string): NamedResult {
  const name = raw.trim().replace(/\s+/g, " ");
  if (!name) return { ok: false, message: "Informe o nome da pasta." };
  if (name.length > 80)
    return { ok: false, message: "O nome da pasta pode ter no máximo 80 caracteres." };
  if (/[\\/]/.test(name) || name === "." || name === "..")
    return { ok: false, message: "O nome da pasta não pode conter barras." };
  return { ok: true, name };
}

export function childFolder(folders: CreativeFolder[], parentId: string, name: string) {
  return (
    folders.find((folder) => folder.parentId === parentId && sameName(folder.name, name.trim())) ??
    null
  );
}

function nameUsed(
  folders: CreativeFolder[],
  files: CreativeFile[],
  parentId: string,
  name: string,
  ignore?: { kind: "folder" | "file"; id: string },
) {
  const folderTaken = folders.some(
    (folder) =>
      folder.parentId === parentId &&
      sameName(folder.name, name) &&
      !(ignore?.kind === "folder" && ignore.id === folder.id),
  );
  const fileTaken = files.some(
    (file) =>
      file.folderId === parentId &&
      sameName(file.name, name) &&
      !(ignore?.kind === "file" && ignore.id === file.id),
  );
  return folderTaken || fileTaken;
}

export function planSubfolder(
  folders: CreativeFolder[],
  files: CreativeFile[],
  parentId: string,
  rawName: string,
): { ok: true; name: string; organizationId: string } | { ok: false; message: string } {
  const parent = folders.find((folder) => folder.id === parentId);
  if (!parent)
    return { ok: false, message: "Abra a pasta do cliente antes de criar uma subpasta." };
  const named = folderName(rawName);
  if (!named.ok) return named;
  if (nameUsed(folders, files, parentId, named.name))
    return { ok: false, message: "Já existe um item com esse nome aqui." };
  return { ok: true, name: named.name, organizationId: parent.organizationId };
}

export function planFolderRename(
  folders: CreativeFolder[],
  files: CreativeFile[],
  folderId: string,
  rawName: string,
): NamedResult {
  const folder = folders.find((item) => item.id === folderId);
  if (!folder) return { ok: false, message: "Pasta não encontrada." };
  const named = folderName(rawName);
  if (!named.ok) return named;
  const parentId = folder.parentId ?? "";
  const siblings =
    folder.parentId === null
      ? folders.filter(
          (item) => item.parentId === null && item.organizationId === folder.organizationId,
        )
      : folders;
  const taken =
    folder.parentId === null
      ? false
      : nameUsed(siblings, files, parentId, named.name, { kind: "folder", id: folderId });
  if (taken) return { ok: false, message: "Já existe um item com esse nome aqui." };
  return { ok: true, name: named.name };
}

export function planFileName(
  files: CreativeFile[],
  folders: CreativeFolder[],
  folderId: string,
  rawName: string,
  ignoreId?: string,
): NamedResult & { mimeType?: string } {
  const folder = folders.find((item) => item.id === folderId);
  if (!folder) return { ok: false, message: "Abra a pasta do cliente antes de enviar o arquivo." };
  const inspected = inspectCreativeFile({ name: rawName, size: 1 });
  if (!inspected.ok) return inspected;
  if (
    nameUsed(
      folders,
      files,
      folderId,
      inspected.name,
      ignoreId ? { kind: "file", id: ignoreId } : undefined,
    )
  ) {
    return { ok: false, message: "Já existe um item com esse nome nesta pasta." };
  }
  return inspected;
}

export function planMove(
  folders: CreativeFolder[],
  files: CreativeFile[],
  fileId: string,
  targetFolderId: string,
): { ok: true } | { ok: false; message: string } {
  const file = files.find((item) => item.id === fileId);
  const target = folders.find((item) => item.id === targetFolderId);
  if (!file || !target) return { ok: false, message: "Escolha a pasta de destino." };
  if (target.organizationId !== file.organizationId)
    return { ok: false, message: "O arquivo fica na pasta deste cliente." };
  if (target.id === file.folderId) return { ok: false, message: "O arquivo já está nesta pasta." };
  if (!pathBelongsToClient(file.storagePath, file.organizationId))
    return { ok: false, message: "O arquivo fica na pasta deste cliente." };
  if (nameUsed(folders, files, target.id, file.name, { kind: "file", id: file.id })) {
    return { ok: false, message: "Já existe um item com esse nome na pasta de destino." };
  }
  return { ok: true };
}

export function foldersIn(folders: CreativeFolder[], parentId: string | null) {
  return folders
    .filter((folder) => folder.parentId === parentId)
    .sort((left, right) => left.name.localeCompare(right.name, "pt-BR"));
}

export function filesIn(files: CreativeFile[], folderId: string) {
  return files
    .filter((file) => file.folderId === folderId)
    .sort((left, right) => left.name.localeCompare(right.name, "pt-BR"));
}

export function descendantFolderIds(folders: CreativeFolder[], rootId: string) {
  const ids = [rootId];
  for (let index = 0; index < ids.length; index += 1) {
    const current = ids[index];
    for (const folder of folders) {
      if (folder.parentId === current) ids.push(folder.id);
    }
  }
  return ids;
}

export function filesUnder(folders: CreativeFolder[], files: CreativeFile[], folderId: string) {
  const ids = new Set(descendantFolderIds(folders, folderId));
  return files.filter((file) => ids.has(file.folderId));
}

export function breadcrumb(folders: CreativeFolder[], folderId: string | null) {
  const trail: CreativeFolder[] = [];
  let current = folderId ? (folders.find((folder) => folder.id === folderId) ?? null) : null;
  const seen = new Set<string>();
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    trail.unshift(current);
    current = current.parentId
      ? (folders.find((folder) => folder.id === current?.parentId) ?? null)
      : null;
  }
  return trail;
}

export function openingFolder(master: boolean, folders: CreativeFolder[]) {
  if (master) return null;
  const roots = folders.filter((folder) => folder.parentId === null);
  return roots.length === 1 ? (roots[0]?.id ?? null) : null;
}

export function scopeToClient(
  snapshot: CreativeSnapshot,
  organizationId: string | null,
): CreativeSnapshot {
  if (!organizationId) return { clients: [], folders: [], files: [] };
  return {
    clients: snapshot.clients.filter((client) => client.id === organizationId),
    folders: snapshot.folders.filter((folder) => folder.organizationId === organizationId),
    files: snapshot.files.filter((file) => file.organizationId === organizationId),
  };
}

export type DropPlacement = { folders: string[]; fileName: string };

export function placementFromRelativePath(
  relativePath: string,
): DropPlacement | { message: string } {
  const parts = relativePath
    .split(/[/\\]/)
    .map((part) => part.trim())
    .filter((part) => part && part !== ".");
  if (parts.some((part) => part === ".."))
    return { message: "O caminho do arquivo não é permitido." };
  const fileName = parts[parts.length - 1];
  if (!fileName) return { message: "O arquivo não tem um nome válido." };
  return { folders: parts.slice(0, -1), fileName };
}

export type FolderChoice = { id: string; label: string; depth: number };

export function folderChoices(folders: CreativeFolder[], organizationId: string): FolderChoice[] {
  const result: FolderChoice[] = [];
  const walk = (folder: CreativeFolder, depth: number) => {
    result.push({ id: folder.id, label: `${" ".repeat(depth)}${folder.name}`.trimStart(), depth });
    for (const child of foldersIn(folders, folder.id)) walk(child, depth + 1);
  };
  for (const root of folders.filter(
    (folder) => folder.organizationId === organizationId && folder.parentId === null,
  ))
    walk(root, 0);
  return result;
}

export function creativeErrorMessage(
  error: { message?: string; code?: string } | null,
  fallback: string,
) {
  const message = error?.message ?? "";
  const code = error?.code ?? "";
  if (code === "23505" || /duplicate key|already exists/i.test(message))
    return "Já existe uma pasta ou arquivo com esse nome.";
  if (/Bucket not found|bucket/i.test(message) && /not found|não encontr/i.test(message))
    return "O espaço de arquivos ainda não está pronto.";
  if (/row-level security|permission denied|42501|não tem permissão/i.test(message))
    return "Você não tem permissão para alterar estes criativos.";
  if (/maximum allowed size|payload too large|entity too large/i.test(message))
    return "O arquivo passa de 200 MB.";
  if (/mime type|invalid mime/i.test(message)) return "Use JPG, PNG, WEBP, PDF, MP4 ou MOV.";
  if (/pasta deste cliente|pasta do cliente/i.test(message))
    return "O arquivo fica na pasta deste cliente.";
  if (!message || /postgres|PGRST|JWT|fetch failed|violates/i.test(message)) return fallback;
  return message;
}

const MASTER_ONLY = "Só o Master organiza os criativos.";

export function createMemoryGateway(seed: CreativeSnapshot) {
  let state: CreativeSnapshot = {
    clients: seed.clients.map((client) => ({ ...client })),
    folders: seed.folders.map((folder) => ({ ...folder })),
    files: seed.files.map((file) => ({ ...file })),
  };
  let viewer: string | null = null;
  const blobs = new Map<string, string>();

  function visible() {
    return viewer ? scopeToClient(state, viewer) : state;
  }

  function requireMaster() {
    if (viewer) throw new Error(MASTER_ONLY);
  }

  return {
    setViewer(organizationId: string | null) {
      viewer = organizationId;
    },
    async load() {
      return visible();
    },
    async createClientFolder(organizationId: string) {
      requireMaster();
      const plan = planClientFolder(state.clients, state.folders, organizationId);
      if (!plan.ok) throw new Error(plan.message);
      const folder: CreativeFolder = {
        id: crypto.randomUUID(),
        organizationId,
        parentId: null,
        name: plan.name,
      };
      state = { ...state, folders: [...state.folders, folder] };
      return folder;
    },
    async createSubfolder(parentId: string, name: string) {
      requireMaster();
      const plan = planSubfolder(state.folders, state.files, parentId, name);
      if (!plan.ok) throw new Error(plan.message);
      const folder: CreativeFolder = {
        id: crypto.randomUUID(),
        organizationId: plan.organizationId,
        parentId,
        name: plan.name,
      };
      state = { ...state, folders: [...state.folders, folder] };
      return folder;
    },
    async upload(folderId: string, file: File) {
      requireMaster();
      const folder = state.folders.find((item) => item.id === folderId);
      if (!folder) throw new Error("Abra a pasta do cliente antes de enviar o arquivo.");
      const inspected = inspectCreativeFile(file);
      if (!inspected.ok || !inspected.mimeType)
        throw new Error(inspected.ok ? "Use JPG, PNG, WEBP, PDF, MP4 ou MOV." : inspected.message);
      const named = planFileName(state.files, state.folders, folderId, inspected.name);
      if (!named.ok) throw new Error(named.message);
      const id = crypto.randomUUID();
      const storagePath = storageObjectPath(folder.organizationId, id, inspected.name);
      if (!pathBelongsToClient(storagePath, folder.organizationId))
        throw new Error("O arquivo fica na pasta deste cliente.");
      const stored: CreativeFile = {
        id,
        organizationId: folder.organizationId,
        folderId,
        name: inspected.name,
        mimeType: inspected.mimeType,
        sizeBytes: file.size,
        storagePath,
      };
      state = { ...state, files: [...state.files, stored] };
      if (typeof URL !== "undefined" && typeof URL.createObjectURL === "function")
        blobs.set(id, URL.createObjectURL(file));
      return stored;
    },
    async renameFolder(id: string, name: string) {
      requireMaster();
      const plan = planFolderRename(state.folders, state.files, id, name);
      if (!plan.ok) throw new Error(plan.message);
      state = {
        ...state,
        folders: state.folders.map((folder) =>
          folder.id === id ? { ...folder, name: plan.name } : folder,
        ),
      };
    },
    async renameFile(id: string, name: string) {
      requireMaster();
      const current = state.files.find((file) => file.id === id);
      if (!current) throw new Error("Arquivo não encontrado.");
      const plan = planFileName(state.files, state.folders, current.folderId, name, id);
      if (!plan.ok) throw new Error(plan.message);
      state = {
        ...state,
        files: state.files.map((file) => (file.id === id ? { ...file, name: plan.name } : file)),
      };
    },
    async deleteFolder(id: string) {
      requireMaster();
      const ids = new Set(descendantFolderIds(state.folders, id));
      const removed = state.files.filter((file) => ids.has(file.folderId));
      for (const file of removed) blobs.delete(file.id);
      state = {
        ...state,
        folders: state.folders.filter((folder) => !ids.has(folder.id)),
        files: state.files.filter((file) => !ids.has(file.folderId)),
      };
    },
    async deleteFile(id: string) {
      requireMaster();
      blobs.delete(id);
      state = { ...state, files: state.files.filter((file) => file.id !== id) };
    },
    async moveFile(id: string, folderId: string) {
      requireMaster();
      const plan = planMove(state.folders, state.files, id, folderId);
      if (!plan.ok) throw new Error(plan.message);
      state = {
        ...state,
        files: state.files.map((file) => (file.id === id ? { ...file, folderId } : file)),
      };
    },
    async downloadUrl(file: CreativeFile) {
      const visibleFile = visible().files.find((item) => item.id === file.id);
      if (!visibleFile) throw new Error("Você não tem permissão para baixar este arquivo.");
      return blobs.get(file.id) ?? "";
    },
    async previewUrl(file: CreativeFile) {
      const visibleFile = visible().files.find((item) => item.id === file.id);
      if (!visibleFile) return null;
      return blobs.get(file.id) ?? null;
    },
  };
}
