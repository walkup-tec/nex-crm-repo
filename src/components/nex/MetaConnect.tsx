import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  disconnectMetaFn,
  getMetaConnectionFn,
  selectMetaAdAccountFn,
  startMetaConnectFn,
  syncMetaAccountsFn,
} from "@/lib/meta.functions";
import type { MetaConnectionView } from "@/lib/meta-access";

const missing: MetaConnectionView = {
  status: "missing",
  connectedAt: null,
  lastSyncAt: null,
  lastError: null,
  selectedAccountId: null,
  selectedAccountName: null,
  accounts: [],
};

export function MetaConnect({
  organizationId,
  prepareOrganization,
  onChanged,
}: {
  organizationId: string | null;
  prepareOrganization?: () => Promise<string | null>;
  onChanged?: () => void;
}) {
  const [view, setView] = useState<MetaConnectionView>(missing);
  const [accountId, setAccountId] = useState("");
  const [loading, setLoading] = useState(Boolean(organizationId));
  const [pending, setPending] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!organizationId) {
      setView(missing);
      setLoading(false);
      return;
    }
    let active = true;
    void (async () => {
      setLoading(true);
      const result = await getMetaConnectionFn({ data: { organizationId } });
      if (!active) return;
      setLoading(false);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setView(result.data);
      setAccountId(result.data.selectedAccountId ?? "");
    })();
    return () => {
      active = false;
    };
  }, [organizationId]);

  const connect = async () => {
    setPending("connect");
    setError("");
    const target = organizationId ?? (await prepareOrganization?.());
    if (!target) {
      setPending("");
      return;
    }
    const result = await startMetaConnectFn({ data: { organizationId: target } });
    if (!result.ok) {
      setPending("");
      setError(result.message);
      return;
    }
    window.location.assign(result.data.url);
  };

  const run = async (action: "sync" | "save" | "disconnect") => {
    if (!organizationId) return;
    setPending(action);
    setError("");
    const result =
      action === "sync"
        ? await syncMetaAccountsFn({ data: { organizationId } })
        : action === "disconnect"
          ? await disconnectMetaFn({ data: { organizationId } })
          : await selectMetaAdAccountFn({ data: { organizationId, accountId } });
    setPending("");
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setView(result.data);
    setAccountId(result.data.selectedAccountId ?? accountId);
    onChanged?.();
  };

  const connected = view.status === "connected" || view.status === "error";
  const statusText =
    view.status === "connected"
      ? "Status: Conectado"
      : view.status === "error"
        ? "Status: Erro na conexão"
        : view.status === "disconnected"
          ? "Status: Desconectada"
          : "Status: Não conectada";

  return (
    <section className="space-y-3 rounded-lg border p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium">Meta</p>
        <p className="text-xs text-muted-foreground">{statusText}</p>
      </div>
      <p className="text-sm text-muted-foreground">
        Conecte a conta Meta deste cliente para importar as contas de anúncio e acompanhar as campanhas.
      </p>
      {loading && <div className="h-16 animate-pulse rounded-md bg-muted" />}
      {!loading && connected && (
        <>
          {view.accounts.length > 0 && (
            <ul className="max-h-36 space-y-1 overflow-auto rounded-md border p-2 text-sm">
              {view.accounts.map((account) => (
                <li key={account.accountId}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-3 rounded px-2 py-1.5 text-left hover:bg-accent"
                    onClick={() => setAccountId(account.accountId)}
                  >
                    <span>{account.name}</span>
                    <span className="text-xs text-muted-foreground">{account.statusLabel}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {view.accounts.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma conta de anúncio apareceu nesta autorização.</p>}
          <div className="space-y-2">
            <Label htmlFor="meta-account-id">ID da conta de anúncio</Label>
            <Input
              id="meta-account-id"
              value={accountId}
              onChange={(event) => setAccountId(event.target.value)}
              placeholder="1234567890"
              inputMode="numeric"
            />
            {view.selectedAccountName && (
              <p className="text-xs text-muted-foreground">
                Acompanhando {view.selectedAccountName}
                {view.selectedAccountId ? ` · ${view.selectedAccountId}` : ""}
              </p>
            )}
          </div>
        </>
      )}
      {view.lastError && <p className="text-sm text-destructive">{view.lastError}</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => void connect()} disabled={pending !== ""}>
          {pending === "connect" ? "Abrindo a Meta..." : "Conexão META"}
        </Button>
        {connected && organizationId && (
          <>
            <Button type="button" variant="outline" onClick={() => void run("save")} disabled={pending !== "" || accountId.trim() === ""}>
              {pending === "save" ? "Salvando..." : "Usar esta conta"}
            </Button>
            <Button type="button" variant="outline" onClick={() => void run("sync")} disabled={pending !== ""}>
              {pending === "sync" ? "Sincronizando..." : "Sincronizar contas"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => void run("disconnect")} disabled={pending !== ""}>
              Desconectar Meta
            </Button>
          </>
        )}
      </div>
    </section>
  );
}
