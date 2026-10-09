import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import {
  ChevronRight,
  Download,
  FileImage,
  FileText,
  Folder,
  FolderPlus,
  MoreHorizontal,
  Move,
  Pencil,
  Trash2,
  Upload,
  Users,
  Video,
} from "lucide-react";
import { supabaseCreativeGateway } from "@/lib/creatives-store";
import {
  CREATIVE_ACCEPT,
  breadcrumb,
  childFolder,
  creativeKind,
  descendantFolderIds,
  filesIn,
  filesUnder,
  folderChoices,
  foldersIn,
  formatBytes,
  placementFromRelativePath,
  planFolderMove,
  planMove,
  planRemoval,
  relocatedStoragePath,
  removalSummary,
  rootFoldersForClient,
  type CreativeFile,
  type CreativeFolder,
  type CreativeGateway,
  type CreativeSnapshot,
} from "@/lib/creative-library";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const emptySnapshot: CreativeSnapshot = { clients: [], folders: [], files: [] };

function messageOf(error: unknown) {
  return error instanceof Error && error.message
    ? error.message
    : "Não foi possível concluir. Tente de novo.";
}

function fileOf(entry: FileSystemFileEntry) {
  return new Promise<File>((resolve, reject) => entry.file(resolve, reject));
}

function readEntries(reader: FileSystemDirectoryReader) {
  return new Promise<FileSystemEntry[]>((resolve, reject) => {
    const all: FileSystemEntry[] = [];
    const read = () => {
      reader.readEntries((batch) => {
        if (batch.length === 0) resolve(all);
        else {
          all.push(...batch);
          read();
        }
      }, reject);
    };
    read();
  });
}

async function walkEntry(
  entry: FileSystemEntry,
  prefix: string,
  target: { relativePath: string; file: File }[],
) {
  if (entry.name.startsWith(".")) return;
  if (entry.isFile) {
    const file = await fileOf(entry as FileSystemFileEntry);
    target.push({ relativePath: `${prefix}${file.name}`, file });
    return;
  }
  const children = await readEntries((entry as FileSystemDirectoryEntry).createReader());
  for (const child of children) await walkEntry(child, `${prefix}${entry.name}/`, target);
}

async function filesFromDrop(data: DataTransfer) {
  const entries = [...data.items]
    .map((item) => item.webkitGetAsEntry?.() ?? null)
    .filter((entry): entry is FileSystemEntry => Boolean(entry));
  if (entries.length === 0)
    return [...data.files].map((file) => ({ relativePath: file.name, file }));
  const found: { relativePath: string; file: File }[] = [];
  for (const entry of entries) await walkEntry(entry, "", found);
  return found;
}

function ItemIcon({ file }: { file?: CreativeFile }) {
  if (!file) return <Folder className="size-10 text-primary" />;
  const kind = creativeKind(file);
  if (kind === "Vídeo") return <Video className="size-10 text-primary" />;
  if (kind === "PDF") return <FileText className="size-10 text-primary" />;
  return <FileImage className="size-10 text-primary" />;
}

function StackedFoldersIcon() {
  return (
    <svg viewBox="0 0 48 48" className="size-10" aria-hidden="true">
      <path
        className="fill-primary/55"
        d="M18 6.5h9.4a2.4 2.4 0 0 1 1.9.95l1.2 1.6a2.4 2.4 0 0 0 1.9.95H42a2.5 2.5 0 0 1 2.5 2.5V26a2.5 2.5 0 0 1-2.5 2.5H18a2.5 2.5 0 0 1-2.5-2.5V9a2.5 2.5 0 0 1 2.5-2.5z"
      />
      <path
        className="fill-primary"
        d="M7 16h12.2a2.2 2.2 0 0 1 1.74.85l1.45 1.9a2.2 2.2 0 0 0 1.74.85H36a2.8 2.8 0 0 1 2.8 2.8v14.8A2.8 2.8 0 0 1 36 41H7a2.8 2.8 0 0 1-2.8-2.8V18.8A2.8 2.8 0 0 1 7 16z"
      />
    </svg>
  );
}

function creativeCountLabel(count: number) {
  return count === 1 ? "1 criativo" : `${count} criativos`;
}

const LIBRARY_DRAG = "application/x-nex-creative";
const FOLDER_DRAG = "application/x-nex-folder";
const FILE_DRAG = "application/x-nex-file";

type LibraryDrag = { kind: "folder" | "file"; id: string };

function dragKind(data: DataTransfer): "folder" | "file" | "files" | null {
  const types = new Set(data.types);
  if (types.has(FOLDER_DRAG)) return "folder";
  if (types.has(FILE_DRAG)) return "file";
  if (types.has("Files")) return "files";
  return null;
}

function readDrag(data: DataTransfer): LibraryDrag | null {
  const raw = data.getData(LIBRARY_DRAG);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { kind?: string; id?: string };
    if ((parsed.kind === "folder" || parsed.kind === "file") && typeof parsed.id === "string")
      return { kind: parsed.kind, id: parsed.id };
  } catch {
    return null;
  }
  return null;
}

function alreadyThere(message: string) {
  return /já está/.test(message);
}

export function CreativesLibrary({
  master = false,
  gateway,
}: {
  master?: boolean;
  gateway?: CreativeGateway;
}) {
  const api = useMemo(
    () => gateway ?? supabaseCreativeGateway(master ? "master" : "client"),
    [gateway, master],
  );
  const [snapshot, setSnapshot] = useState<CreativeSnapshot>(emptySnapshot);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState<{ label: string; value: number } | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [clientOpen, setClientOpen] = useState(false);
  const [clientId, setClientId] = useState("");
  const [clientFilter, setClientFilter] = useState("todos");
  const [folderTitle, setFolderTitle] = useState("");
  const [accessFolder, setAccessFolder] = useState<CreativeFolder | null>(null);
  const [accessClientId, setAccessClientId] = useState("");
  const [subOpen, setSubOpen] = useState(false);
  const [subName, setSubName] = useState("");
  const [rename, setRename] = useState<{
    kind: "folder" | "file";
    id: string;
    name: string;
  } | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [remove, setRemove] = useState<
    { kind: "folder" | "file"; id: string; name: string } | { kind: "selection" } | null
  >(null);
  const [move, setMove] = useState<CreativeFile | null>(null);
  const [moveTarget, setMoveTarget] = useState("");
  const [preview, setPreview] = useState<CreativeFile | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [dragging, setDragging] = useState<LibraryDrag | null>(null);
  const [dropHint, setDropHint] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api.load();
      setSnapshot(data);
    } catch (caught) {
      setError(messageOf(caught));
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const clear = () => {
      setDragging(null);
      setDropHint(null);
    };
    window.addEventListener("dragend", clear);
    return () => window.removeEventListener("dragend", clear);
  }, []);

  const trail = breadcrumb(snapshot.folders, currentId);
  const clientFilterId = clientFilter === "todos" ? null : clientFilter;
  const foldersHere = currentId
    ? foldersIn(snapshot.folders, currentId)
    : rootFoldersForClient(snapshot.folders, clientFilterId);
  const filesHere = currentId ? filesIn(snapshot.files, currentId) : [];
  const visibleFolderIds = new Set(foldersHere.map((folder) => folder.id));
  const dragSource = dragging
    ? dragging.kind === "folder"
      ? snapshot.folders.find((folder) => folder.id === dragging.id)
      : snapshot.files.find((file) => file.id === dragging.id)
    : null;
  const dragOrganizationId = dragSource?.organizationId;
  const blockedDropIds = new Set<string>();
  if (dragging?.kind === "folder" && dragSource && "parentId" in dragSource) {
    for (const id of descendantFolderIds(snapshot.folders, dragSource.id)) blockedDropIds.add(id);
  }
  if (dragging?.kind === "file" && dragSource && "folderId" in dragSource)
    blockedDropIds.add(dragSource.folderId);
  const liftedFolder =
    dragging?.kind === "folder" && dragSource && "parentId" in dragSource ? dragSource : null;
  if (liftedFolder?.parentId) blockedDropIds.add(liftedFolder.parentId);
  const canLift = Boolean(liftedFolder?.parentId);
  const liftParentId = liftedFolder?.parentId
    ? (snapshot.folders.find((folder) => folder.id === liftedFolder.parentId)?.parentId ?? null)
    : null;
  const liftHint = liftParentId ?? "root";
  // NEX-FORA-9F85
  const extraTargets =
    master && dragging && dragOrganizationId
      ? snapshot.folders
          .filter(
            (folder) =>
              folder.organizationId === dragOrganizationId &&
              !blockedDropIds.has(folder.id) &&
              !visibleFolderIds.has(folder.id),
          )
          .map((folder) => ({
            id: folder.id,
            label: breadcrumb(snapshot.folders, folder.id)
              .map((item) => item.name)
              .join(" / "),
          }))
      : [];
  const clientOptions = [...snapshot.clients].sort((left, right) =>
    left.name.localeCompare(right.name, "pt-BR"),
  );
  const filteredClient = clientOptions.find((client) => client.id === clientFilterId) ?? null;
  const accessRoot = trail[0] ?? null;
  const accessName =
    snapshot.clients.find((client) => client.id === accessRoot?.organizationId)?.name ?? "";

  function toggle(id: string) {
    setSelected((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  function openFolder(id: string | null) {
    setSelected([]);
    setCurrentId(id);
    setError("");
  }

  async function downloadFile(file: CreativeFile) {
    const url = await api.downloadUrl(file);
    if (!url) throw new Error("Não foi possível baixar o arquivo.");
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.rel = "noreferrer";
    anchor.target = "_blank";
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
  }

  async function downloadSelection() {
    const chosen = new Map<string, CreativeFile>();
    for (const file of snapshot.files) if (selected.includes(file.id)) chosen.set(file.id, file);
    for (const folder of snapshot.folders) {
      if (!selected.includes(folder.id)) continue;
      for (const file of filesUnder(snapshot.folders, snapshot.files, folder.id))
        chosen.set(file.id, file);
    }
    const files = [...chosen.values()];
    if (files.length === 0) {
      setError("Selecione um arquivo para baixar.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      for (const file of files) {
        await downloadFile(file);
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
    } catch (caught) {
      setError(messageOf(caught));
    } finally {
      setBusy(false);
    }
  }

  async function createRootFolder() {
    setBusy(true);
    setError("");
    try {
      const folder = await api.createFolder(folderTitle, clientId);
      setSnapshot((current) => ({ ...current, folders: [...current.folders, folder] }));
      setClientOpen(false);
      setClientId("");
      setFolderTitle("");
      openFolder(folder.id);
    } catch (caught) {
      setError(messageOf(caught));
    } finally {
      setBusy(false);
    }
  }

  async function confirmAccess() {
    if (!accessFolder) return;
    setBusy(true);
    setError("");
    try {
      await api.setFolderAccess(accessFolder.id, accessClientId);
      const ids = new Set(descendantFolderIds(snapshot.folders, accessFolder.id));
      setSnapshot((current) => ({
        ...current,
        folders: current.folders.map((folder) =>
          ids.has(folder.id) ? { ...folder, organizationId: accessClientId } : folder,
        ),
        files: current.files.map((file) =>
          ids.has(file.folderId)
            ? {
                ...file,
                organizationId: accessClientId,
                storagePath: relocatedStoragePath(file.storagePath, accessClientId),
              }
            : file,
        ),
      }));
      setAccessFolder(null);
    } catch (caught) {
      setError(messageOf(caught));
    } finally {
      setBusy(false);
    }
  }

  async function createSubfolder() {
    if (!currentId) return;
    setBusy(true);
    setError("");
    try {
      const folder = await api.createSubfolder(currentId, subName);
      setSnapshot((current) => ({ ...current, folders: [...current.folders, folder] }));
      setSubOpen(false);
      setSubName("");
    } catch (caught) {
      setError(messageOf(caught));
    } finally {
      setBusy(false);
    }
  }

  function startDrag(event: DragEvent, item: LibraryDrag) {
    event.dataTransfer.setData(LIBRARY_DRAG, JSON.stringify(item));
    event.dataTransfer.setData(item.kind === "folder" ? FOLDER_DRAG : FILE_DRAG, item.id);
    event.dataTransfer.effectAllowed = "move";
    setDragging(item);
  }

  function overFolder(event: DragEvent, folderId: string) {
    if (!master || !dragKind(event.dataTransfer)) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = dragKind(event.dataTransfer) === "files" ? "copy" : "move";
    if (dropHint !== folderId) setDropHint(folderId);
  }

  async function dropLibraryItem(item: LibraryDrag, parentId: string | null) {
    setError("");
    try {
      if (item.kind === "file") {
        if (!parentId) {
          setError("Solte o arquivo dentro de uma pasta.");
          return;
        }
        const plan = planMove(snapshot.folders, snapshot.files, item.id, parentId);
        if (!plan.ok) {
          if (!alreadyThere(plan.message)) setError(plan.message);
          return;
        }
        await api.moveFile(item.id, parentId);
        setSnapshot((current) => ({
          ...current,
          files: current.files.map((file) =>
            file.id === item.id ? { ...file, folderId: parentId } : file,
          ),
        }));
      } else {
        const plan = planFolderMove(snapshot.folders, snapshot.files, item.id, parentId);
        if (!plan.ok) {
          if (!alreadyThere(plan.message)) setError(plan.message);
          return;
        }
        await api.moveFolder(item.id, parentId);
        setSnapshot((current) => ({
          ...current,
          folders: current.folders.map((folder) =>
            folder.id === item.id ? { ...folder, parentId } : folder,
          ),
        }));
      }
      setSelected((current) => current.filter((id) => id !== item.id));
    } catch (caught) {
      setError(messageOf(caught));
    }
  }

  function onFolderDrop(event: DragEvent, folderId: string | null) {
    event.preventDefault();
    event.stopPropagation();
    setDropHint(null);
    setDragging(null);
    const item = readDrag(event.dataTransfer);
    if (item) {
      void dropLibraryItem(item, folderId);
      return;
    }
    if (dragKind(event.dataTransfer) === "files") {
      void filesFromDrop(event.dataTransfer)
        .then((items) => receive(items, folderId))
        .catch((caught) => setError(messageOf(caught)));
    }
  }

  async function receive(items: { relativePath: string; file: File }[], folderId: string | null) {
    if (!master) return;
    if (!folderId) {
      setError("Solte o arquivo sobre a pasta do cliente.");
      return;
    }
    const accepted = items.filter((item) => !item.file.name.startsWith("."));
    if (accepted.length === 0) {
      setError("Nenhum arquivo válido para enviar.");
      return;
    }
    setBusy(true);
    setError("");
    let working = snapshot;
    const failures: string[] = [];
    for (let index = 0; index < accepted.length; index += 1) {
      const item = accepted[index];
      if (!item) continue;
      setProgress({
        label: `Enviando ${index + 1} de ${accepted.length} — ${item.file.name}`,
        value: Math.round((index / accepted.length) * 100),
      });
      try {
        const placement = placementFromRelativePath(item.relativePath);
        if ("message" in placement) throw new Error(placement.message);
        let parentId = folderId;
        for (const segment of placement.folders) {
          const existing = childFolder(working.folders, parentId, segment);
          if (existing) {
            parentId = existing.id;
            continue;
          }
          const created = await api.createSubfolder(parentId, segment);
          working = { ...working, folders: [...working.folders, created] };
          parentId = created.id;
        }
        const stored = await api.upload(
          parentId,
          new File([item.file], placement.fileName, { type: item.file.type }),
        );
        working = { ...working, files: [...working.files, stored] };
      } catch (caught) {
        failures.push(`${item.file.name}: ${messageOf(caught)}`);
      }
    }
    setSnapshot(working);
    setProgress(null);
    setBusy(false);
    if (failures.length > 0) setError(failures.slice(0, 3).join(" "));
  }

  async function confirmRename() {
    if (!rename) return;
    setBusy(true);
    setError("");
    try {
      if (rename.kind === "folder") {
        await api.renameFolder(rename.id, renameValue);
        setSnapshot((current) => ({
          ...current,
          folders: current.folders.map((folder) =>
            folder.id === rename.id ? { ...folder, name: renameValue.trim() } : folder,
          ),
        }));
      } else {
        await api.renameFile(rename.id, renameValue);
        setSnapshot((current) => ({
          ...current,
          files: current.files.map((file) =>
            file.id === rename.id ? { ...file, name: renameValue.trim() } : file,
          ),
        }));
      }
      setRename(null);
    } catch (caught) {
      setError(messageOf(caught));
    } finally {
      setBusy(false);
    }
  }

  async function confirmRemove() {
    if (!plan || (plan.folders.length === 0 && plan.files.length === 0)) {
      setRemove(null);
      return;
    }
    const gone = new Set<string>();
    setBusy(true);
    setError("");
    try {
      for (const id of plan.folders) {
        await api.deleteFolder(id);
        const removedIds = new Set(descendantFolderIds(snapshot.folders, id));
        const parent = snapshot.folders.find((folder) => folder.id === id)?.parentId ?? null;
        setSnapshot((current) => ({
          ...current,
          folders: current.folders.filter((folder) => !removedIds.has(folder.id)),
          files: current.files.filter((file) => !removedIds.has(file.folderId)),
        }));
        if (currentId && removedIds.has(currentId)) setCurrentId(parent);
        for (const folderId of removedIds) gone.add(folderId);
        for (const file of snapshot.files) {
          if (removedIds.has(file.folderId)) gone.add(file.id);
        }
      }
      for (const id of plan.files) {
        await api.deleteFile(id);
        gone.add(id);
        setSnapshot((current) => ({
          ...current,
          files: current.files.filter((file) => file.id !== id),
        }));
      }
      setRemove(null);
    } catch (caught) {
      setError(messageOf(caught));
    } finally {
      if (gone.size > 0) setSelected((current) => current.filter((id) => !gone.has(id)));
      setBusy(false);
    }
  }

  async function confirmMove() {
    if (!move || !moveTarget) return;
    setBusy(true);
    setError("");
    try {
      await api.moveFile(move.id, moveTarget);
      setSnapshot((current) => ({
        ...current,
        files: current.files.map((file) =>
          file.id === move.id ? { ...file, folderId: moveTarget } : file,
        ),
      }));
      setMove(null);
      setMoveTarget("");
    } catch (caught) {
      setError(messageOf(caught));
    } finally {
      setBusy(false);
    }
  }

  async function openPreview(file: CreativeFile) {
    setPreview(file);
    setPreviewUrl("");
    try {
      setPreviewUrl((await api.previewUrl(file)) ?? "");
    } catch (caught) {
      setError(messageOf(caught));
    }
  }

  const emptyCopy = master
    ? currentId
      ? {
          title: "Pasta vazia",
          description:
            "Solte os criativos aqui. Se eles vierem dentro de uma pasta, a subpasta é criada junto.",
        }
      : snapshot.clients.length === 0
        ? {
            title: "Nenhum cliente cadastrado",
            description: "Cadastre o cliente antes de criar uma pasta.",
          }
        : filteredClient
          ? {
              title: "Nenhuma pasta deste cliente",
              description: `Crie uma pasta para ${filteredClient.name} e coloque os criativos dentro.`,
            }
          : {
              title: "Nenhuma pasta",
              description:
                "Crie uma pasta, escolha qual cliente pode acessá-la e coloque os criativos dentro.",
            }
    : {
        title: "Nenhum material disponível",
        description: "A NEX ainda não enviou pastas ou arquivos para esta conta.",
      };

  const plan = remove
    ? remove.kind === "selection"
      ? planRemoval(snapshot.folders, snapshot.files, selected)
      : remove.kind === "folder"
        ? { folders: [remove.id], files: [] }
        : { folders: [], files: [remove.id] }
    : null;
  const summary = removalSummary(
    snapshot.folders,
    snapshot.files,
    plan ?? { folders: [], files: [] },
  );

  const choices = move
    ? folderChoices(snapshot.folders, move.organizationId).filter(
        (choice) => choice.id !== move.folderId,
      )
    : [];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <nav
          className="flex min-w-0 flex-wrap items-center gap-1 text-sm text-muted-foreground"
          aria-label="Caminho da pasta"
        >
          <button
            type="button"
            className={cn(
              "rounded px-1 py-0.5",
              !currentId && "font-semibold text-foreground",
              canLift && "border border-dashed px-2 py-1",
              dropHint === "root" && "border-primary bg-primary/15 text-foreground",
            )}
            onClick={() => openFolder(null)}
            onDragEnter={(event) => {
              if (!master || dragKind(event.dataTransfer) !== "folder") return;
              event.preventDefault();
            }}
            onDragOver={(event) => {
              if (!master || dragKind(event.dataTransfer) !== "folder") return;
              event.preventDefault();
              event.stopPropagation();
              event.dataTransfer.dropEffect = "move";
              if (dropHint !== "root") setDropHint("root");
            }}
            onDrop={(event) => {
              if (dragKind(event.dataTransfer) !== "folder") return;
              onFolderDrop(event, null);
            }}
          >
            Pastas
          </button>
          {trail.map((folder) => (
            <span key={folder.id} className="flex min-w-0 items-center gap-1">
              <ChevronRight className="size-4 shrink-0" />
              <button
                type="button"
                className={cn(
                  "truncate rounded px-1 py-0.5",
                  folder.id === currentId && "font-semibold text-foreground",
                  dropHint === folder.id && "bg-primary/15 text-foreground",
                )}
                onClick={() => openFolder(folder.id)}
                onDragOver={(event) => overFolder(event, folder.id)}
                onDrop={(event) => onFolderDrop(event, folder.id)}
              >
                {folder.name}
              </button>
            </span>
          ))}
        </nav>
        {master && !currentId && (
          <Select
            value={clientFilter}
            onValueChange={(value) => {
              setClientFilter(value);
              setSelected([]);
            }}
          >
            <SelectTrigger className="w-full bg-background sm:w-72" aria-label="Cliente">
              <SelectValue placeholder="Todos os clientes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os clientes</SelectItem>
              {clientOptions.map((client) => (
                <SelectItem key={client.id} value={client.id}>
                  {client.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <div className="flex flex-wrap gap-2 lg:ml-auto">
          {master && !currentId && (
            <Button
              disabled={clientOptions.length === 0 || busy}
              onClick={() => {
                setClientId(clientFilter === "todos" ? "" : clientFilter);
                setFolderTitle("");
                setClientOpen(true);
              }}
            >
              <FolderPlus />
              Nova pasta
            </Button>
          )}
          {master && currentId && (
            <>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => {
                  setSubName("");
                  setSubOpen(true);
                }}
              >
                <FolderPlus />
                Nova pasta
              </Button>
              <Button disabled={busy} onClick={() => inputRef.current?.click()}>
                <Upload />
                Adicionar criativos
              </Button>
            </>
          )}
          <Button
            variant="outline"
            className={master ? "" : "lg:ml-0"}
            disabled={busy || selected.length === 0}
            onClick={() => void downloadSelection()}
          >
            <Download />
            Baixar {selected.length > 0 ? `(${selected.length})` : "seleção"}
          </Button>
          {master && (
            <Button
              variant="outline"
              className="text-destructive"
              disabled={busy || selected.length === 0}
              onClick={() => setRemove({ kind: "selection" })}
            >
              <Trash2 />
              Excluir {selected.length > 0 ? `(${selected.length})` : "seleção"}
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}
      {progress && (
        <div className="rounded-lg border bg-card px-4 py-3">
          <p className="text-sm">{progress.label}</p>
          <Progress className="mt-3" value={progress.value} />
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        multiple
        accept={CREATIVE_ACCEPT}
        className="hidden"
        onChange={(event) => {
          const list = [...(event.target.files ?? [])].map((file) => ({
            relativePath: file.webkitRelativePath || file.name,
            file,
          }));
          event.target.value = "";
          void receive(list, currentId);
        }}
      />

      {loading ? (
        <div className="grid min-h-48 place-items-center rounded-lg border border-dashed text-sm text-muted-foreground">
          Carregando criativos...
        </div>
      ) : (
        <div
          className={cn(
            "rounded-lg",
            master && currentId && "border border-dashed p-3",
            (dragOver || dropHint === currentId) && "border-primary bg-primary/5",
          )}
          onDragOver={(event) => {
            if (!master) return;
            const kind = dragKind(event.dataTransfer);
            if (!kind) return;
            if (!currentId && kind === "files") {
              event.preventDefault();
              return;
            }
            if (!currentId) return;
            event.preventDefault();
            event.dataTransfer.dropEffect = kind === "files" ? "copy" : "move";
            const sameParent =
              dragging?.kind === "folder" &&
              snapshot.folders.find((folder) => folder.id === dragging.id)?.parentId === currentId;
            if (kind === "files") setDragOver(true);
            else if (!sameParent && dropHint !== currentId) setDropHint(currentId);
          }}
          onDragLeave={(event) => {
            if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
            setDragOver(false);
            setDropHint(null);
          }}
          onDrop={(event) => {
            setDragOver(false);
            if (!master) return;
            if (currentId) {
              onFolderDrop(event, currentId);
              return;
            }
            if (dragKind(event.dataTransfer) === "files") {
              event.preventDefault();
              setError("Solte o arquivo sobre a pasta do cliente.");
            }
          }}
        >
          {master && (
            <p className="mb-3 text-xs text-muted-foreground">
              {currentId
                ? `Para tirar uma pasta daqui, arraste-a até Pastas. Também pode soltar arquivos do computador nesta pasta${accessName ? ` de ${accessName}` : ""}.`
                : "Arraste uma pasta para dentro de outra, ou solte arquivos do computador sobre a pasta."}
            </p>
          )}
          {master && dragging && (canLift || extraTargets.length > 0) && (
            <div className="mb-3 flex items-center gap-2 overflow-x-auto text-xs text-muted-foreground">
              <span className="shrink-0">Soltar em</span>
              {canLift && (
                <div
                  className={cn(
                    "shrink-0 rounded-full border px-2 py-1",
                    dropHint === liftHint && "border-primary bg-primary/10 text-foreground",
                  )}
                  onDragEnter={(event) => {
                    if (dragKind(event.dataTransfer) !== "folder") return;
                    event.preventDefault();
                  }}
                  onDragOver={(event) => {
                    if (dragKind(event.dataTransfer) !== "folder") return;
                    event.preventDefault();
                    event.stopPropagation();
                    event.dataTransfer.dropEffect = "move";
                    if (dropHint !== liftHint) setDropHint(liftHint);
                  }}
                  onDrop={(event) => onFolderDrop(event, liftParentId)}
                >
                  Tirar para fora
                </div>
              )}
              {extraTargets.map((target) => (
                <div
                  key={target.id}
                  className={cn(
                    "shrink-0 rounded-full border px-2 py-1",
                    dropHint === target.id && "border-primary bg-primary/10 text-foreground",
                  )}
                  onDragOver={(event) => overFolder(event, target.id)}
                  onDrop={(event) => onFolderDrop(event, target.id)}
                >
                  {target.label}
                </div>
              ))}
            </div>
          )}
          {foldersHere.length === 0 && filesHere.length === 0 ? (
            <div className="grid min-h-48 place-items-center rounded-lg border border-dashed p-8 text-center">
              <div>
                <span className="mx-auto grid size-11 place-items-center rounded-full bg-secondary">
                  <Folder className="size-5 text-muted-foreground" />
                </span>
                <p className="mt-3 font-semibold">{emptyCopy.title}</p>
                <p className="mt-1 max-w-md text-sm text-muted-foreground">
                  {emptyCopy.description}
                </p>
              </div>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {foldersHere.map((folder) => {
                const owner = snapshot.clients.find(
                  (client) => client.id === folder.organizationId,
                );
                const count = filesUnder(snapshot.folders, snapshot.files, folder.id).length;
                const filesLabel = count === 1 ? "1 arquivo" : `${count} arquivos`;
                const ownerName = owner?.name ?? "Cliente";
                return (
                  <LibraryCard
                    key={folder.id}
                    name={folder.name}
                    detail={
                      count > 0
                        ? master && !currentId
                          ? ownerName
                          : "Pasta"
                        : master && !currentId
                          ? `${ownerName} • ${filesLabel}`
                          : `Pasta • ${filesLabel}`
                    }
                    creativeCount={count}
                    selected={selected.includes(folder.id)}
                    onToggle={() => toggle(folder.id)}
                    onOpen={() => openFolder(folder.id)}
                    master={master}
                    dropActive={dropHint === folder.id}
                    {...(master
                      ? {
                          onDragItemStart: (event: DragEvent<HTMLButtonElement>) =>
                            startDrag(event, { kind: "folder", id: folder.id }),
                          onDragItemOver: (event: DragEvent<HTMLDivElement>) =>
                            overFolder(event, folder.id),
                          onDropItem: (event: DragEvent<HTMLDivElement>) =>
                            onFolderDrop(event, folder.id),
                        }
                      : {})}
                    onRename={() => {
                      setRename({ kind: "folder", id: folder.id, name: folder.name });
                      setRenameValue(folder.name);
                    }}
                    onRemove={() => setRemove({ kind: "folder", id: folder.id, name: folder.name })}
                    {...(master && !folder.parentId
                      ? {
                          onAccess: () => {
                            setAccessFolder(folder);
                            setAccessClientId(folder.organizationId);
                          },
                        }
                      : {})}
                  />
                );
              })}
              {filesHere.map((file) => (
                <LibraryCard
                  key={file.id}
                  name={file.name}
                  detail={`${creativeKind(file)} • ${formatBytes(file.sizeBytes)}`}
                  file={file}
                  selected={selected.includes(file.id)}
                  onToggle={() => toggle(file.id)}
                  onOpen={() => void openPreview(file)}
                  master={master}
                  {...(master
                    ? {
                        onDragItemStart: (event: DragEvent<HTMLButtonElement>) =>
                          startDrag(event, { kind: "file", id: file.id }),
                      }
                    : {})}
                  onDownload={() =>
                    void downloadFile(file).catch((caught) => setError(messageOf(caught)))
                  }
                  onRename={() => {
                    setRename({ kind: "file", id: file.id, name: file.name });
                    setRenameValue(file.name);
                  }}
                  onMove={() => {
                    setMove(file);
                    setMoveTarget("");
                  }}
                  onRemove={() => setRemove({ kind: "file", id: file.id, name: file.name })}
                />
              ))}
            </div>
          )}
        </div>
      )}

      <Dialog open={clientOpen} onOpenChange={setClientOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova pasta</DialogTitle>
            <DialogDescription>
              Dê um nome à pasta e escolha qual cliente pode ver os criativos que ficarem dentro
              dela.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="creative-folder-name">Nome da pasta</Label>
              <Input
                id="creative-folder-name"
                value={folderTitle}
                onChange={(event) => setFolderTitle(event.target.value)}
                placeholder="Ex.: Campanha Consignado"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="creative-client">Cliente com acesso</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger id="creative-client">
                  <SelectValue placeholder="Selecione o cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clientOptions.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setClientOpen(false)}>
              Cancelar
            </Button>
            <Button
              disabled={!clientId || !folderTitle.trim() || busy}
              onClick={() => void createRootFolder()}
            >
              Criar pasta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(accessFolder)} onOpenChange={(open) => !open && setAccessFolder(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Acesso da pasta</DialogTitle>
            <DialogDescription>
              {accessFolder?.name}. Só o cliente escolhido vê esta pasta e os criativos dentro dela.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="creative-access">Cliente com acesso</Label>
            <Select
              {...(accessClientId ? { value: accessClientId } : {})}
              onValueChange={setAccessClientId}
            >
              <SelectTrigger id="creative-access">
                <SelectValue placeholder="Selecione o cliente" />
              </SelectTrigger>
              <SelectContent>
                {clientOptions.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAccessFolder(null)}>
              Cancelar
            </Button>
            <Button disabled={!accessClientId || busy} onClick={() => void confirmAccess()}>
              Salvar acesso
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={subOpen} onOpenChange={setSubOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova subpasta</DialogTitle>
            <DialogDescription>A subpasta fica dentro da pasta deste cliente.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="creative-folder">Nome da pasta</Label>
            <Input
              id="creative-folder"
              value={subName}
              onChange={(event) => setSubName(event.target.value)}
              placeholder="Ex.: Setembro 2026"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSubOpen(false)}>
              Cancelar
            </Button>
            <Button disabled={busy || !subName.trim()} onClick={() => void createSubfolder()}>
              Criar pasta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(rename)} onOpenChange={(open) => !open && setRename(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Renomear</DialogTitle>
            <DialogDescription>{rename?.name}</DialogDescription>
          </DialogHeader>
          <Input
            value={renameValue}
            onChange={(event) => setRenameValue(event.target.value)}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRename(null)}>
              Cancelar
            </Button>
            <Button disabled={busy || !renameValue.trim()} onClick={() => void confirmRename()}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(move)} onOpenChange={(open) => !open && setMove(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mover arquivo</DialogTitle>
            <DialogDescription>
              O arquivo continua na conta de{" "}
              {snapshot.clients.find((client) => client.id === move?.organizationId)?.name ??
                "este cliente"}
              .
            </DialogDescription>
          </DialogHeader>
          <Select {...(moveTarget ? { value: moveTarget } : {})} onValueChange={setMoveTarget}>
            <SelectTrigger>
              <SelectValue placeholder="Pasta de destino" />
            </SelectTrigger>
            <SelectContent>
              {choices.map((choice) => (
                <SelectItem key={choice.id} value={choice.id}>
                  {"\u00A0".repeat(choice.depth * 2)}
                  {choice.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMove(null)}>
              Cancelar
            </Button>
            <Button disabled={busy || !moveTarget} onClick={() => void confirmMove()}>
              <Move />
              Mover
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(remove)} onOpenChange={(open) => !open && setRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{summary.title}</AlertDialogTitle>
            <AlertDialogDescription>{summary.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <Button variant="destructive" disabled={busy} onClick={() => void confirmRemove()}>
              <Trash2 />
              Excluir
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={Boolean(preview)} onOpenChange={(open) => !open && setPreview(null)}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{preview?.name}</DialogTitle>
            <DialogDescription>
              {preview ? `${creativeKind(preview)} • ${formatBytes(preview.sizeBytes)}` : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="grid min-h-48 place-items-center overflow-hidden rounded-lg bg-muted">
            {preview && previewUrl && creativeKind(preview) === "Imagem" && (
              <img
                src={previewUrl}
                alt={preview.name}
                className="max-h-[28rem] w-full object-contain"
              />
            )}
            {preview && previewUrl && creativeKind(preview) === "Vídeo" && (
              <video src={previewUrl} controls className="max-h-[28rem] w-full" />
            )}
            {preview && previewUrl && creativeKind(preview) === "PDF" && (
              <iframe title={preview.name} src={previewUrl} className="h-[28rem] w-full" />
            )}
            {preview && !previewUrl && <ItemIcon file={preview} />}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={!preview}
              onClick={() =>
                preview && void downloadFile(preview).catch((caught) => setError(messageOf(caught)))
              }
            >
              <Download />
              Baixar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function LibraryCard({
  name,
  detail,
  file,
  creativeCount = 0,
  selected,
  master,
  onToggle,
  onOpen,
  onDragItemStart,
  onDragItemOver,
  onDropItem,
  dropActive = false,
  onDownload,
  onRename,
  onMove,
  onRemove,
  onAccess,
}: {
  name: string;
  detail: string;
  file?: CreativeFile;
  creativeCount?: number;
  selected: boolean;
  master: boolean;
  onToggle: () => void;
  onOpen: () => void;
  onDragItemStart?: (event: DragEvent<HTMLButtonElement>) => void;
  onDragItemOver?: (event: DragEvent<HTMLDivElement>) => void;
  onDropItem?: (event: DragEvent<HTMLDivElement>) => void;
  dropActive?: boolean;
  onDownload?: () => void;
  onRename?: () => void;
  onMove?: () => void;
  onRemove?: () => void;
  onAccess?: () => void;
}) {
  const filledFolder = !file && creativeCount > 0;
  return (
    <Card
      className={cn(
        "overflow-hidden",
        selected && "border-primary ring-1 ring-primary",
        dropActive && "border-primary bg-primary/5 ring-2 ring-primary",
      )}
      onDragEnter={onDragItemOver}
      onDragOver={onDragItemOver}
      onDrop={onDropItem}
    >
      <button
        type="button"
        draggable={Boolean(onDragItemStart)}
        onDragStart={onDragItemStart}
        className={cn(
          "relative grid aspect-video w-full place-items-center bg-secondary/70",
          onDragItemStart && "cursor-grab active:cursor-grabbing",
        )}
        onClick={onOpen}
      >
        {file ? <ItemIcon file={file} /> : filledFolder ? <StackedFoldersIcon /> : <ItemIcon />}
      </button>
      <CardContent className="p-4">
        <div className="flex items-start gap-2">
          <Checkbox
            checked={selected}
            onCheckedChange={onToggle}
            aria-label={`Selecionar ${name}`}
            className="mt-1"
          />
          <button
            type="button"
            draggable={Boolean(onDragItemStart)}
            onDragStart={onDragItemStart}
            className={cn(
              "min-w-0 flex-1 text-left",
              onDragItemStart && "cursor-grab active:cursor-grabbing",
            )}
            onClick={onOpen}
          >
            <p className="truncate font-medium">{name}</p>
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{detail}</p>
            {filledFolder && (
              <Badge
                variant="secondary"
                className="mt-2 h-5 rounded-full border-primary/25 bg-primary/15 px-2 text-[11px] font-medium text-primary shadow-none hover:bg-primary/15"
              >
                {creativeCountLabel(creativeCount)}
              </Badge>
            )}
          </button>
          {(master || onDownload) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label={`Ações de ${name}`}>
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {onDownload && (
                  <DropdownMenuItem onSelect={onDownload}>
                    <Download />
                    Baixar
                  </DropdownMenuItem>
                )}
                {master && onAccess && (
                  <DropdownMenuItem onSelect={onAccess}>
                    <Users />
                    Acesso do cliente
                  </DropdownMenuItem>
                )}
                {master && onRename && (
                  <DropdownMenuItem onSelect={onRename}>
                    <Pencil />
                    Renomear
                  </DropdownMenuItem>
                )}
                {master && onMove && (
                  <DropdownMenuItem onSelect={onMove}>
                    <Move />
                    Mover
                  </DropdownMenuItem>
                )}
                {master && onRemove && (
                  <DropdownMenuItem onSelect={onRemove} className="text-destructive">
                    <Trash2 />
                    Excluir
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
