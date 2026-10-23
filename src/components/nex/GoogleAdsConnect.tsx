import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { googleAdsSelectionFn, listGoogleAdsAccountsFn, selectGoogleAdsAccountFn } from "@/lib/google-ads.functions";
import type { GoogleAdsAccount } from "@/lib/google-ads";

export function GoogleAdsConnect({ organizationId }: { organizationId: string | null }) {
  const [accounts, setAccounts] = useState<GoogleAdsAccount[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [savedName, setSavedName] = useState("");
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!organizationId) return;
    let active = true;
    setLoading(true);
    setError("");
    void (async () => {
      try {
        const current = await googleAdsSelectionFn({ data: { organizationId } });
        if (!active) return;
        if (current.ok && current.data.account) {
          setCustomerId(current.data.account.customerId);
          setSavedName(current.data.account.name);
        } else if (!current.ok) {
          setError(current.message);
        }
        const listed = await listGoogleAdsAccountsFn();
        if (!active) return;
        if (!listed.ok) setError(listed.message);
        else setAccounts(listed.data);
      } catch {
        if (active) setError("Não foi possível carregar as contas do Google Ads.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [organizationId]);

  async function save() {
    if (!organizationId || !customerId) return;
    setPending(true);
    setError("");
    const result = await selectGoogleAdsAccountFn({ data: { organizationId, customerId } });
    setPending(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setSavedName(result.data?.name || savedName);
  }

  return (
    <section className="space-y-3 rounded-lg border p-3">
      <p className="text-sm font-medium">Google Ads</p>
      {!organizationId ? <p className="text-sm text-muted-foreground">Salve o cliente para vincular a conta de anúncios.</p> : null}
      {organizationId ? (
        <div className="space-y-2">
          <Label>Conta de anúncio</Label>
          <Select value={customerId || undefined} onValueChange={setCustomerId} disabled={pending || loading || accounts.length === 0}>
            <SelectTrigger>
              <SelectValue placeholder={loading ? "Carregando contas" : accounts.length ? "Selecione a conta vinculada à MCC" : "Nenhuma conta disponível"} />
            </SelectTrigger>
            <SelectContent>
              {accounts.map((account) => (
                <SelectItem key={account.customerId} value={account.customerId}>
                  {account.name} · {account.customerId}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {savedName ? <p className="text-sm font-medium text-success">Conta vinculada: {savedName}</p> : null}
          <Button type="button" variant="outline" disabled={pending || !customerId} onClick={() => void save()}>
            {pending ? "Salvando..." : "Vincular conta"}
          </Button>
        </div>
      ) : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </section>
  );
}
