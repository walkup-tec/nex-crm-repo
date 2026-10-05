import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  disconnectMetaFn,
  getMetaConnectionFn,
  listBusinessAdAccountsFn,
  listMetaBusinessesFn,
  selectMetaAdAccountFn,
  startMetaConnectFn,
} from "@/lib/meta.functions";
import type { MetaAccountView, MetaBusinessView, MetaConnectionView } from "@/lib/meta-access";

const missing: MetaConnectionView = {
  status: "missing",
  connectedAt: null,
  lastSyncAt: null,
  lastError: null,
  selectedAccountId: null,
  selectedAccountName: null,
  selectedPortfolioId: null,
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
  const [orgId, setOrgId] = useState(organizationId);
  const [view, setView] = useState<MetaConnectionView>(missing);
  const [businesses, setBusinesses] = useState<MetaBusinessView[]>([]);
  const [accounts, setAccounts] = useState<MetaAccountView[]>([]);
  const [businessId, setBusinessId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [loading, setLoading] = useState(Boolean(organizationId));
  const [pending, setPending] = useState("");
  const [error, setError] = useState("");
  const orgRef = useRef(organizationId);
  const watchRef = useRef<number | null>(null);

  useEffect(() => {
    orgRef.current = organizationId;
    setOrgId(organizationId);
  }, [organizationId]);

  useEffect(() => {
    return () => {
      if (watchRef.current) window.clearInterval(watchRef.current);
    };
  }, []);

  const loadAccounts = async (org: string, portfolioId: string, preferredAccountId?: string) => {
    setPending("accounts");
    setError("");
    const result = await listBusinessAdAccountsFn({ data: { organizationId: org, businessId: portfolioId } });
    setPending("");
    if (!result.ok) {
      setAccounts([]);
      setError(result.message);
      return;
    }
    setAccounts(result.data);
    if (preferredAccountId && result.data.some((account) => account.accountId === preferredAccountId)) {
      setAccountId(preferredAccountId);
    }
  };

  const loadConnection = async (org: string) => {
    setLoading(true);
    setBusinesses([]);
    setAccounts([]);
    setBusinessId("");
    setAccountId("");
    const result = await getMetaConnectionFn({ data: { organizationId: org } });
    setLoading(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setView(result.data);
    if (result.data.status !== "connected" && result.data.status !== "error") return;
    const listed = await listMetaBusinessesFn({ data: { organizationId: org } });
    if (!listed.ok) {
      setError(listed.message);
      return;
    }
    setBusinesses(listed.data);
    const portfolioId = result.data.selectedPortfolioId;
    if (portfolioId && listed.data.some((item) => item.id === portfolioId)) {
      setBusinessId(portfolioId);
      if (result.data.selectedAccountId) await loadAccounts(org, portfolioId, result.data.selectedAccountId);
      else await loadAccounts(org, portfolioId);
    }
  };

  useEffect(() => {
    if (!organizationId) {
      setView(missing);
      setBusinesses([]);
      setAccounts([]);
      setLoading(false);
      return;
    }
    void loadConnection(organizationId);
  }, [organizationId]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data as { source?: string; ok?: boolean; organizationId?: string; message?: string };
      if (data?.source !== "nex-meta") return;
      if (watchRef.current) window.clearInterval(watchRef.current);
      setPending("");
      const org = orgRef.current;
      if (!data.ok) {
        setError(data.message || "A autorização da Meta não foi concluída.");
        return;
      }
      if (!org || (data.organizationId && data.organizationId !== org)) return;
      void loadConnection(org);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const connect = () => {
    setError("");
    const width = 520;
    const height = 720;
    const left = window.screenX + Math.max(0, (window.outerWidth - width) / 2);
    const top = window.screenY + Math.max(0, (window.outerHeight - height) / 2);
    const popup = window.open(
      "about:blank",
      "nex-meta-connect",
      `popup=yes,width=${width},height=${height},left=${left},top=${top}`,
    );
    if (!popup) {
      setError("O navegador bloqueou a janela da Meta. Permita pop-ups neste site e tente de novo.");
      return;
    }
    setPending("connect");
    const previousConnectedAt = view.connectedAt;
    void (async () => {
      const target = orgId ?? (await prepareOrganization?.());
      if (!target) {
        popup.close();
        setPending("");
        return;
      }
      orgRef.current = target;
      setOrgId(target);
      const result = await startMetaConnectFn({ data: { organizationId: target } });
      if (!result.ok) {
        popup.close();
        setPending("");
        setError(result.message);
        return;
      }
      popup.location.href = result.data.url;
      if (watchRef.current) window.clearInterval(watchRef.current);
      let checking = false;
      watchRef.current = window.setInterval(() => {
        if (checking) return;
        checking = true;
        void (async () => {
          const current = await getMetaConnectionFn({ data: { organizationId: target } });
          const linked = current.ok && current.data.connectedAt && current.data.connectedAt !== previousConnectedAt;
          if (linked) {
            if (watchRef.current) window.clearInterval(watchRef.current);
            setPending("");
            if (!popup.closed) popup.close();
            await loadConnection(target);
          } else if (popup.closed) {
            if (watchRef.current) window.clearInterval(watchRef.current);
            setPending("");
          }
          checking = false;
        })();
      }, 1200);
    })();
  };

  const chooseBusiness = (next: string) => {
    setBusinessId(next);
    setAccountId("");
    setAccounts([]);
    if (!orgId) return;
    void loadAccounts(orgId, next);
  };

  const save = async () => {
    if (!orgId || !businessId || !accountId) return;
    setPending("save");
    setError("");
    const result = await selectMetaAdAccountFn({ data: { organizationId: orgId, accountId, businessId } });
    setPending("");
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setView(result.data);
    onChanged?.();
  };

  const disconnect = async () => {
    if (!orgId) return;
    setPending("disconnect");
    setError("");
    const result = await disconnectMetaFn({ data: { organizationId: orgId } });
    setPending("");
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setView(result.data);
    setBusinesses([]);
    setAccounts([]);
    setBusinessId("");
    setAccountId("");
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
        A conexão abre por cima desta tela. Depois escolha o portfólio e a conta de anúncio que este cliente verá ao entrar.
      </p>
      {loading && <div className="h-16 animate-pulse rounded-md bg-muted" />}
      {!loading && connected && (
        <>
          <div className="space-y-2">
            <Label>Portfólio (BM)</Label>
            <Select {...(businessId ? { value: businessId } : {})} onValueChange={chooseBusiness} disabled={pending !== "" || businesses.length === 0}>
              <SelectTrigger>
                <SelectValue placeholder={businesses.length === 0 ? "Nenhum portfólio disponível" : "Selecione o portfólio"} />
              </SelectTrigger>
              <SelectContent>
                {businesses.map((business) => (
                  <SelectItem key={business.id} value={business.id}>
                    {business.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Conta de anúncio</Label>
            <Select
              {...(accountId ? { value: accountId } : {})}
              onValueChange={setAccountId}
              disabled={pending !== "" || !businessId || accounts.length === 0}
            >
              <SelectTrigger>
                <SelectValue placeholder={businessId ? "Selecione a conta de anúncio" : "Escolha o portfólio primeiro"} />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((account) => (
                  <SelectItem key={account.accountId} value={account.accountId}>
                    {account.name} · {account.statusLabel}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {businessId && pending !== "accounts" && accounts.length === 0 && (
              <p className="text-xs text-muted-foreground">Nenhuma conta de anúncio disponível para este administrador neste portfólio.</p>
            )}
          </div>
          {view.selectedAccountName && (
            <p className="text-xs text-muted-foreground">
              Vinculada a este cliente: {view.selectedAccountName}
              {view.selectedAccountId ? ` · ${view.selectedAccountId}` : ""}. Ao entrar, ele vê as campanhas desta conta.
            </p>
          )}
        </>
      )}
      {view.lastError && <p className="text-sm text-destructive">{view.lastError}</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={connect} disabled={pending !== ""}>
          {pending === "connect" ? "Abrindo a Meta..." : "Conexão META"}
        </Button>
        {connected && orgId && (
          <>
            <Button type="button" variant="outline" onClick={() => void save()} disabled={pending !== "" || !businessId || !accountId}>
              {pending === "save" ? "Salvando..." : "Vincular conta"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => void disconnect()} disabled={pending !== ""}>
              Desconectar Meta
            </Button>
          </>
        )}
      </div>
    </section>
  );
}
