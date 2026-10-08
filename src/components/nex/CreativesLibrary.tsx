import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  Video,
} from "lucide-react";
import { supabaseCreativeGateway } from "@/lib/creatives-store";
import {
  CREATIVE_ACCEPT,
  breadcrumb,
  childFolder,
  clientsAwaitingFolder,
  creativeKind,
  descendantFolderIds,
  filesIn,
  filesUnder,
  folderChoices,
  foldersIn,
  formatBytes,
  openingFolder,
  placementFromRelativePath,
  type CreativeFile,
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
  const [subOpen, setSubOpen] = useState(false);
  const [subName, setSubName] = useState("");
  const [rename, setRename] = useState<{
    kind: "folder" | "file";
    id: string;
    name: string;
  } | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [remove, setRemove] = useState<{
    kind: "folder" | "file";
    id: string;
    name: string;
  } | null>(null);
  const [move, setMove] = useState<CreativeFile | null>(null);
  const [moveTarget, setMoveTarget] = useState("");
  const [preview, setPreview] = useState<CreativeFile | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const opened = useRef(false);
  const dragDepth = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api.load();
      setSnapshot(data);
      if (!opened.current) {
        setCurrentId(openingFolder(master, data.folders));
        opened.current = true;
      }
    } catch (caught) {
      setError(messageOf(caught));
    } finally {
      setLoading(false);
    }
  }, [api, master]);

  useEffect(() => {
    void load();
  }, [load]);

  const trail = breadcrumb(snapshot.folders, currentId);
  const roots = foldersIn(snapshot.folders, null);
  const foldersHere = currentId ? foldersIn(snapshot.folders, currentId) : roots;
  const filesHere = currentId ? filesIn(snapshot.files, currentId) : [];
  const waiting = clientsAwaitingFolder(snapshot.clients, snapshot.folders);
  const showLibraryRoot = master || roots.length !== 1;

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

  async function createClientFolder() {
    setBusy(true);
    setError("");
    try {
      const folder = await api.createClientFolder(clientId);
      setSnapshot((current) => ({ ...current, folders: [...current.folders, folder] }));
      setClientOpen(false);
      setClientId("");
      openFolder(folder.id);
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

  async function receive(items: { relativePath: string; file: File }[]) {
    if (!master) return;
    if (!currentId) {
      setError("Abra a pasta do cliente para enviar os arquivos.");
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
        let parentId = currentId;
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
    if (!remove) return;
    setBusy(true);
    setError("");
    try {
      if (remove.kind === "folder") {
        await api.deleteFolder(remove.id);
        const removedIds = new Set(descendantFolderIds(snapshot.folders, remove.id));
        const parent = snapshot.folders.find((folder) => folder.id === remove.id)?.parentId ?? null;
        setSnapshot((current) => ({
          ...current,
          folders: current.folders.filter((folder) => !removedIds.has(folder.id)),
          files: current.files.filter((file) => !removedIds.has(file.folderId)),
        }));
        if (currentId && removedIds.has(currentId)) setCurrentId(parent);
      } else {
        await api.deleteFile(remove.id);
        setSnapshot((current) => ({
          ...current,
          files: current.files.filter((file) => file.id !== remove.id),
        }));
      }
      setSelected((current) => current.filter((id) => id !== remove.id));
      setRemove(null);
    } catch (caught) {
      setError(messageOf(caught));
    } finally {
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
            "Solte os arquivos aqui. Se eles vierem dentro de uma pasta, a subpasta é criada junto.",
        }
      : snapshot.clients.length === 0
        ? {
            title: "Nenhum cliente cadastrado",
            description: "Cadastre o cliente antes de criar a pasta dos criativos.",
          }
        : {
            title: "Nenhuma pasta de cliente",
            description: "Selecione o nome do cliente e crie a pasta com o nome dele.",
          }
    : {
        title: "Nenhum material disponível",
        description: "A NEX ainda não enviou pastas ou arquivos para esta conta.",
      };

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
          {showLibraryRoot && (
            <button
              type="button"
              className={cn("rounded px-1 py-0.5", !currentId && "font-semibold text-foreground")}
              onClick={() => openFolder(null)}
            >
              Pastas
            </button>
          )}
          {trail.map((folder, index) => (
            <span key={folder.id} className="flex min-w-0 items-center gap-1">
              {(index > 0 || showLibraryRoot) && <ChevronRight className="size-4 shrink-0" />}
              <button
                type="button"
                className={cn(
                  "truncate rounded px-1 py-0.5",
                  folder.id === currentId && "font-semibold text-foreground",
                )}
                onClick={() => openFolder(folder.id)}
              >
                {folder.name}
              </button>
            </span>
          ))}
        </nav>
        <div className="flex flex-wrap gap-2 lg:ml-auto">
          {master && !currentId && (
            <Button
              disabled={waiting.length === 0 || busy}
              onClick={() => {
                setClientId("");
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
                Enviar arquivos
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
          void receive(list);
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
            dragOver && "border-primary bg-primary/5",
          )}
          onDragEnter={(event) => {
            if (!master || !currentId) return;
            event.preventDefault();
            dragDepth.current += 1;
            setDragOver(true);
          }}
          onDragOver={(event) => {
            if (!master || !currentId) return;
            event.preventDefault();
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            dragDepth.current = Math.max(0, dragDepth.current - 1);
            if (dragDepth.current === 0) setDragOver(false);
          }}
          onDrop={(event) => {
            event.preventDefault();
            dragDepth.current = 0;
            setDragOver(false);
            if (!master) return;
            void filesFromDrop(event.dataTransfer)
              .then((items) => receive(items))
              .catch((caught) => setError(messageOf(caught)));
          }}
        >
          {master && currentId && (
            <p className="mb-3 text-xs text-muted-foreground">
              Solte arquivos ou uma pasta. JPG, PNG, WEBP, PDF, MP4 e MOV, até 200 MB.
            </p>
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
              {foldersHere.map((folder) => (
                <LibraryCard
                  key={folder.id}
                  name={folder.name}
                  detail={`Pasta • ${filesUnder(snapshot.folders, snapshot.files, folder.id).length} arquivos`}
                  selected={selected.includes(folder.id)}
                  onToggle={() => toggle(folder.id)}
                  onOpen={() => openFolder(folder.id)}
                  master={master}
                  onRename={() => {
                    setRename({ kind: "folder", id: folder.id, name: folder.name });
                    setRenameValue(folder.name);
                  }}
                  onRemove={() => setRemove({ kind: "folder", id: folder.id, name: folder.name })}
                />
              ))}
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
            <DialogTitle>Nova pasta do cliente</DialogTitle>
            <DialogDescription>
              Selecione o cliente. A pasta é criada com o nome dele e os arquivos ficam só nessa
              conta.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="creative-client">Nome do cliente</Label>
            <Select {...(clientId ? { value: clientId } : {})} onValueChange={setClientId}>
              <SelectTrigger id="creative-client">
                <SelectValue placeholder="Selecione o cliente" />
              </SelectTrigger>
              <SelectContent>
                {waiting.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setClientOpen(false)}>
              Cancelar
            </Button>
            <Button disabled={!clientId || busy} onClick={() => void createClientFolder()}>
              Criar pasta
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
            <AlertDialogTitle>Excluir {remove?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              {remove?.kind === "folder"
                ? "A pasta e tudo o que estiver dentro dela serão excluídos desta conta."
                : "O arquivo será excluído desta conta."}
            </AlertDialogDescription>
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
  selected,
  master,
  onToggle,
  onOpen,
  onDownload,
  onRename,
  onMove,
  onRemove,
}: {
  name: string;
  detail: string;
  file?: CreativeFile;
  selected: boolean;
  master: boolean;
  onToggle: () => void;
  onOpen: () => void;
  onDownload?: () => void;
  onRename?: () => void;
  onMove?: () => void;
  onRemove?: () => void;
}) {
  return (
    <Card className={cn("overflow-hidden", selected && "border-primary ring-1 ring-primary")}>
      <button
        type="button"
        className="relative grid aspect-video w-full place-items-center bg-secondary/70"
        onClick={onOpen}
      >
        {file ? <ItemIcon file={file} /> : <ItemIcon />}
      </button>
      <CardContent className="p-4">
        <div className="flex items-start gap-2">
          <Checkbox
            checked={selected}
            onCheckedChange={onToggle}
            aria-label={`Selecionar ${name}`}
            className="mt-1"
          />
          <button type="button" className="min-w-0 flex-1 text-left" onClick={onOpen}>
            <p className="truncate font-medium">{name}</p>
            <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
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
