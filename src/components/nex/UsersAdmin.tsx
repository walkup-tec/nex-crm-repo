import { useCallback, useEffect, useState } from "react";
import { Check, Plus } from "lucide-react";
import { AppShell } from "@/components/nex/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { applyMask } from "@/lib/masks";
import type { ListedUser, RegisteredClient, UserPermissions, UserRole, UsersSnapshot } from "@/lib/user-access";
import { MetaConnect } from "@/components/nex/MetaConnect";
import { createUserFn, deleteUserFn, listUsersFn, resendInviteFn, setUserBlockedFn, updateUserFn } from "@/lib/users.functions";

const roleLabel: Record<UserRole, string> = {
  master: "Master",
  client_admin: "Cliente",
  client_user: "Usuário",
};

const permissionFields: { key: keyof UserPermissions; label: string }[] = [
  { key: "campaigns", label: "Campanhas" },
  { key: "balance", label: "Saldo Meta" },
  { key: "credit", label: "Créditos Meta" },
  { key: "manage", label: "Usuários" },
];

const emptyPermissions: UserPermissions = { campaigns: true, balance: false, credit: false, manage: false };

function permissionSummary(user: ListedUser) {
  if (user.role !== "client_user") return null;
  const labels = permissionFields.filter((field) => user.permissions[field.key]).map((field) => field.label);
  return labels.length ? labels.join(", ") : "Sem permissões";
}

function subtitleFor(role: UserRole) {
  if (role === "master") return "Crie acessos Master ou Cliente. Os usuários de cada cliente aparecem com o responsável.";
  if (role === "client_admin") return "Crie os usuários da sua conta. Eles ficam atribuídos a você.";
  return "Seu acesso consulta a conta, sem criar outros usuários.";
}

export function UsersAdmin() {
  const [snapshot, setSnapshot] = useState<UsersSnapshot | null>(null);
  const [knownRole, setKnownRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editor, setEditor] = useState<null | { mode: "create" } | { mode: "edit"; user: ListedUser }>(null);
  const [removing, setRemoving] = useState<ListedUser | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await listUsersFn();
      if (!result.ok) setError(result.message);
      else setSnapshot(result.data);
    } catch {
      setError("Não foi possível carregar os usuários.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!snapshot) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("meta") !== "choose") return;
    const org = params.get("org");
    const target = snapshot.users.find((item) => item.role === "client_admin" && item.organizationId === org);
    if (target) setEditor({ mode: "edit", user: target });
    window.history.replaceState({}, "", "/usuarios");
  }, [snapshot]);

  useEffect(() => {
    let active = true;
    void (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        if (active) setKnownRole("client_user");
        return;
      }
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id);
      if (!active) return;
      if (roles?.some((row) => row.role === "master")) setKnownRole("master");
      else if (roles?.some((row) => row.role === "client_admin")) setKnownRole("client_admin");
      else setKnownRole("client_user");
    })();
    return () => {
      active = false;
    };
  }, []);

  const role = snapshot?.actor.role ?? knownRole;
  if (!role) {
    return <main className="grid min-h-screen place-items-center text-sm text-muted-foreground">Carregando usuários...</main>;
  }
  const canCreate = role === "master" || role === "client_admin";

  return (
    <AppShell title="Usuários" subtitle={subtitleFor(role)} master={role === "master"}>
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            {loading
              ? "Consultando os acessos"
              : snapshot
                ? `${snapshot.users.length} ${snapshot.users.length === 1 ? "acesso" : "acessos"}`
                : "A lista não foi carregada"}
          </p>
          {canCreate && (
            <Button onClick={() => setEditor({ mode: "create" })}>
              <Plus />
              Novo acesso
            </Button>
          )}
        </div>

        {error && (
          <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {loading && (
          <div className="space-y-3" aria-busy="true">
            <div className="h-16 animate-pulse rounded-lg bg-muted" />
            <div className="h-16 animate-pulse rounded-lg bg-muted" />
          </div>
        )}

        {!loading && snapshot && snapshot.users.length === 0 && (
          <div className="rounded-lg border border-dashed px-4 py-10 text-center">
            <p className="font-medium">{canCreate ? "Nenhum usuário por aqui" : "Nada para administrar"}</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
              {role === "master"
                ? "Crie um Cliente para abrir a conta dele, ou outro Master para a administração."
                : role === "client_admin"
                  ? "Os usuários que você criar ficam atribuídos a você e também aparecem para o Master."
                  : "Peça ao responsável da conta se precisar de outro acesso."}
            </p>
          </div>
        )}

        {!loading && snapshot && snapshot.users.length > 0 && (
          <>
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Tipo</TableHead>
                    {role === "master" && <TableHead>Atribuído a</TableHead>}
                    {role === "master" && <TableHead>Conta META</TableHead>}
                    <TableHead>Situação</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {snapshot.users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <p className="font-medium">{user.fullName}</p>
                        <p className="text-xs text-muted-foreground">{user.email}</p>
                        {permissionSummary(user) && <p className="mt-1 text-xs text-muted-foreground">{permissionSummary(user)}</p>}
                      </TableCell>
                      <TableCell>{roleLabel[user.role]}</TableCell>
                      {role === "master" && <TableCell>{user.ownerName ?? "—"}</TableCell>}
                      {role === "master" && (
                        <TableCell>
                          <MetaAccountMark linked={user.metaLinked} />
                        </TableCell>
                      )}
                      <TableCell>
                        <Badge variant={user.blocked ? "destructive" : "secondary"}>{user.blocked ? "Bloqueado" : "Ativo"}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <RowActions user={user} onEdit={() => setEditor({ mode: "edit", user })} onRemove={() => setRemoving(user)} onChanged={load} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <ul className="space-y-3 md:hidden">
              {snapshot.users.map((user) => (
                <li key={user.id} className="rounded-lg border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{user.fullName}</p>
                      <p className="text-sm text-muted-foreground">{user.email}</p>
                    </div>
                    <Badge variant={user.blocked ? "destructive" : "secondary"}>{user.blocked ? "Bloqueado" : "Ativo"}</Badge>
                  </div>
                  <p className="mt-3 text-sm">
                    {roleLabel[user.role]}
                    {role === "master" && user.ownerName ? ` · atribuído a ${user.ownerName}` : ""}
                  </p>
                  {role === "master" && (
                    <p className="mt-2 flex items-center gap-2 text-sm">
                      Conta META
                      <MetaAccountMark linked={user.metaLinked} />
                    </p>
                  )}
                  {permissionSummary(user) && <p className="mt-1 text-xs text-muted-foreground">{permissionSummary(user)}</p>}
                  <div className="mt-4">
                    <RowActions user={user} onEdit={() => setEditor({ mode: "edit", user })} onRemove={() => setRemoving(user)} onChanged={load} />
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <UserDialog
        open={editor !== null}
        mode={editor?.mode ?? "create"}
        user={editor && editor.mode === "edit" ? editor.user : null}
        actorRole={role}
        clients={snapshot?.clients ?? []}
        onClose={() => setEditor(null)}
        onSaved={async () => {
          setEditor(null);
          await load();
        }}
      />

      <AlertDialog open={removing !== null} onOpenChange={(open) => !open && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {removing?.fullName}?</AlertDialogTitle>
            <AlertDialogDescription>O acesso deixa de entrar no NEX Ads. Esta ação não volta atrás.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={deleting}
              onClick={async () => {
                if (!removing) return;
                setDeleting(true);
                const result = await deleteUserFn({ data: { id: removing.id } });
                setDeleting(false);
                if (!result.ok) {
                  setError(result.message);
                  setRemoving(null);
                  return;
                }
                setRemoving(null);
                await load();
              }}
            >
              {deleting ? "Excluindo..." : "Excluir"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}

function MetaAccountMark({ linked }: { linked: boolean }) {
  return (
    <span className={`inline-flex items-center ${linked ? "text-success" : "text-destructive"}`} title={linked ? "BM vinculada" : "BM não vinculada"}>
      <Check className="size-4" />
      <span className="sr-only">{linked ? "BM vinculada" : "BM não vinculada"}</span>
    </span>
  );
}

function RowActions({
  user,
  onEdit,
  onRemove,
  onChanged,
}: {
  user: ListedUser;
  onEdit: () => void;
  onRemove: () => void;
  onChanged: () => Promise<void>;
}) {
  const [pending, setPending] = useState(false);
  const [rowError, setRowError] = useState("");
  const [rowNotice, setRowNotice] = useState("");
  if (!user.canManage) return <span className="text-xs text-muted-foreground">Sem ação</span>;
  return (
    <div className="flex flex-wrap justify-end gap-2">
      <Button variant="outline" size="sm" onClick={onEdit}>
        Editar
      </Button>
      <Button
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          setRowError("");
          setRowNotice("");
          const result = await resendInviteFn({ data: { id: user.id } });
          setPending(false);
          if (!result.ok) {
            setRowError(result.message);
            return;
          }
          setRowNotice("Convite reenviado.");
        }}
      >
        Reenviar convite
      </Button>
      <Button
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          setRowError("");
          const result = await setUserBlockedFn({ data: { id: user.id, blocked: !user.blocked } });
          setPending(false);
          if (!result.ok) {
            setRowError(result.message);
            return;
          }
          await onChanged();
        }}
      >
        {user.blocked ? "Desbloquear" : "Bloquear"}
      </Button>
      <Button variant="ghost" size="sm" className="text-destructive" onClick={onRemove}>
        Excluir
      </Button>
      {rowNotice && <p className="w-full text-right text-xs text-success">{rowNotice}</p>}
      {rowError && <p className="w-full text-right text-xs text-destructive">{rowError}</p>}
    </div>
  );
}

function UserDialog({
  open,
  mode,
  user,
  actorRole,
  clients,
  onClose,
  onSaved,
}: {
  open: boolean;
  mode: "create" | "edit";
  user: ListedUser | null;
  actorRole: UserRole;
  clients: RegisteredClient[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [fullName, setFullName] = useState("");
  const [clientId, setClientId] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [financeEmail, setFinanceEmail] = useState("");
  const [financeSame, setFinanceSame] = useState(false);
  const [kind, setKind] = useState<"master" | "client">("client");
  const [permissions, setPermissions] = useState<UserPermissions>(emptyPermissions);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [createdOrgId, setCreatedOrgId] = useState<string | null>(null);
  const [createdUserId, setCreatedUserId] = useState<string | null>(null);
  const [emailFailed, setEmailFailed] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFormError("");
    setSaving(false);
    setCreatedOrgId(null);
    setCreatedUserId(null);
    setEmailFailed(false);
    setClientId("");
    if (mode === "edit" && user) {
      setFullName(user.fullName);
      setEmail(user.email);
      setWhatsapp(user.whatsapp);
      setFinanceEmail(user.financeEmailSame ? user.email : user.financeEmail);
      setFinanceSame(user.financeEmailSame);
      setPermissions(user.permissions);
      return;
    }
    setFullName("");
    setEmail("");
    setWhatsapp("");
    setFinanceEmail("");
    setFinanceSame(false);
    setKind("client");
    setPermissions(emptyPermissions);
  }, [open, mode, user]);

  const showPermissions = (mode === "create" && actorRole === "client_admin") || (mode === "edit" && user?.role === "client_user");
  const simpleAccess = actorRole === "client_admin" || user?.role === "client_user";
  const chooseClient = mode === "create" && actorRole === "master" && kind === "client";
  const contact = { whatsapp, financeEmail: financeSame ? email : financeEmail, financeEmailSame: financeSame };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (chooseClient && !clientId) {
      setFormError(clients.length === 0 ? "Nenhum cliente cadastrado para selecionar." : "Selecione o cliente.");
      return;
    }
    if (createdUserId) {
      setSaving(true);
      setFormError("");
      const updated = await updateUserFn({ data: { id: createdUserId, fullName, email, ...contact } });
      if (!updated.ok) {
        setSaving(false);
        setFormError(updated.message);
        return;
      }
      const resent = await resendInviteFn({ data: { id: createdUserId } });
      setSaving(false);
      if (!resent.ok) {
        setEmailFailed(true);
        setFormError(resent.message);
        return;
      }
      setEmailFailed(false);
      await onSaved();
      return;
    }
    setSaving(true);
    setFormError("");
    const result =
      mode === "create"
        ? await createUserFn({
            data:
              actorRole === "master"
                ? { fullName, email, ...contact, kind }
                : actorRole === "client_admin"
                  ? { fullName, email, ...contact, permissions }
                  : { fullName, email, ...contact },
          })
        : await updateUserFn({
            data:
              user?.role === "client_user"
                ? { id: user.id, fullName, email, ...contact, permissions }
                : { id: user?.id ?? "", fullName, email, ...contact },
          });
    setSaving(false);
    if (!result.ok) {
      setFormError(result.message);
      return;
    }
    if (mode === "create" && typeof result.data === "object" && result.data.emailSent === false) {
      if (result.data.organizationId) setCreatedOrgId(result.data.organizationId);
      setCreatedUserId(result.data.id);
      setEmailFailed(true);
      setFormError("O acesso foi criado, mas o e-mail de convite não saiu. Clique em Reenviar convite para tentar outra vez.");
      return;
    }
    await onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !saving && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Novo acesso" : "Editar acesso"}</DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "A pessoa recebe um e-mail para definir a própria senha."
              : "O nome e o e-mail passam a valer no próximo acesso."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="user-name">Nome</Label>
            {chooseClient ? (
              <Select
                {...(clientId ? { value: clientId } : {})}
                onValueChange={(value) => {
                  setClientId(value);
                  setFullName(clients.find((item) => item.id === value)?.name ?? "");
                }}
                disabled={clients.length === 0}
              >
                <SelectTrigger id="user-name" className="w-full">
                  <SelectValue placeholder={clients.length === 0 ? "Nenhum cliente cadastrado" : "Selecione o cliente"} />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input id="user-name" value={fullName} onChange={(event) => setFullName(event.target.value)} required minLength={2} />
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="user-email">E-mail</Label>
            <Input id="user-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </div>
          {!simpleAccess && (
            <>
              <div className="space-y-2">
                <Label htmlFor="user-whatsapp">WhatsApp</Label>
                <Input
                  id="user-whatsapp"
                  inputMode="numeric"
                  autoComplete="tel"
                  placeholder="(00) 00000-0000"
                  value={whatsapp}
                  onChange={(event) => setWhatsapp(applyMask("phone", event.target.value))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="user-finance-email">E-mail financeiro</Label>
                <Input
                  id="user-finance-email"
                  type="email"
                  value={financeSame ? email : financeEmail}
                  onChange={(event) => setFinanceEmail(event.target.value)}
                  disabled={financeSame}
                  required={!financeSame}
                />
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={financeSame} onCheckedChange={(checked) => setFinanceSame(checked === true)} />
                  Usar o mesmo e-mail do usuário
                </label>
              </div>
            </>
          )}
          {mode === "create" && actorRole === "master" && (
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Tipo</legend>
              <div className="grid grid-cols-2 gap-2">
                {(["client", "master"] as const).map((value) => (
                  <label key={value} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
                    <input type="radio" name="kind" value={value} checked={kind === value} onChange={() => setKind(value)} />
                    {value === "client" ? "Cliente" : "Master"}
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          {((mode === "create" && actorRole === "master" && kind === "client") || (mode === "edit" && user?.role === "client_admin")) && (
            <MetaConnect
              organizationId={mode === "edit" ? user?.organizationId ?? null : createdOrgId}
              prepareOrganization={async () => {
                if (mode !== "create") return null;
                if (!fullName.trim()) {
                  setFormError("Selecione o cliente.");
                  return null;
                }
                const result = await createUserFn({ data: { fullName, email, ...contact, kind: "client", sendEmail: false } });
                if (!result.ok || !result.data.organizationId) {
                  setFormError(result.ok ? "O cliente foi criado sem empresa." : result.message);
                  return null;
                }
                setCreatedUserId(result.data.id);
                setCreatedOrgId(result.data.organizationId);
                return result.data.organizationId;
              }}
            />
          )}
          {showPermissions && (
            <fieldset className="space-y-3">
              <legend className="text-sm font-medium">Permissões</legend>
              {permissionFields.map((field) => (
                <div key={field.key} className="flex items-center justify-between gap-3">
                  <Label htmlFor={`perm-${field.key}`}>{field.label}</Label>
                  <Switch
                    id={`perm-${field.key}`}
                    checked={permissions[field.key]}
                    onCheckedChange={(checked) => setPermissions((current) => ({ ...current, [field.key]: checked }))}
                  />
                </div>
              ))}
            </fieldset>
          )}
          {formError && <p className="text-sm text-destructive">{formError}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Salvando..." : emailFailed ? "Reenviar convite" : mode === "create" ? "Enviar acesso" : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
