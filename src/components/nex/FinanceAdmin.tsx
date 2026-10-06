import { useCallback, useEffect, useState } from "react";
import { History } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { dateBr, invoiceStatusLabel, moneyFromCents } from "@/lib/client-access";
import { competenceLabel, whenLabel, type FinanceCharge, type MasterFinance } from "@/lib/finance-access";
import { listMasterFinanceFn, negotiateChargeFn } from "@/lib/finance.functions";

export function FinanceAdmin() {
  const [snapshot, setSnapshot] = useState<MasterFinance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [charge, setCharge] = useState<FinanceCharge | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const result = await listMasterFinanceFn();
    setLoading(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setSnapshot(result.data);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const charges = (snapshot?.charges ?? []).filter((item) => {
    if (filter === "overdue") return item.status === "overdue";
    if (filter === "paid") return item.status === "paid";
    return true;
  });

  return (
    <div className="space-y-5">
      {loading && <p className="text-sm text-muted-foreground">Consultando cobranças no Asaas...</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}
      {snapshot?.notice && <p className="text-sm text-muted-foreground">{snapshot.notice}</p>}
      {snapshot && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Metric label="A receber" value={moneyFromCents(snapshot.receivableCents)} />
            <Metric label="Vencidas" value={moneyFromCents(snapshot.overdueCents)} />
            <Metric label="Recebido no mês" value={moneyFromCents(snapshot.receivedThisMonthCents)} />
          </div>
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle>Cobranças</CardTitle>
                <Select value={filter} onValueChange={setFilter}>
                  <SelectTrigger className="w-full sm:w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os status</SelectItem>
                    <SelectItem value="overdue">Vencidas</SelectItem>
                    <SelectItem value="paid">Pagas</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {charges.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {snapshot.charges.length === 0 ? "Nenhuma cobrança gravada." : "Nenhuma cobrança neste filtro."}
                </p>
              ) : (
                charges.map((item) => (
                  <div key={item.id} className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center">
                    <div className="flex-1">
                      <p className="font-semibold">{item.clientName}</p>
                      <p className="text-xs text-muted-foreground">
                        Competência {competenceLabel(item.competence)} • vencimento {dateBr(item.dueDate)}
                      </p>
                    </div>
                    <strong>{moneyFromCents(item.totalCents)}</strong>
                    <Badge variant={item.status === "overdue" ? "destructive" : "outline"}>{item.status === "paid" ? "Paga" : invoiceStatusLabel(item.status)}</Badge>
                    {item.canNegotiate && (
                      <Button variant="outline" onClick={() => setCharge(item)}>
                        Negociar
                      </Button>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Auditoria financeira</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {snapshot.audit.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma movimentação registrada.</p>
              ) : (
                snapshot.audit.map((item) => (
                  <div key={item.id} className="flex gap-3 border-b pb-3 last:border-0">
                    <History className="mt-0.5 size-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{item.text}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.actorName} • {whenLabel(item.at)}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </>
      )}
      <NegotiateDialog
        charge={charge}
        onClose={() => setCharge(null)}
        onSaved={async () => {
          setCharge(null);
          await load();
        }}
      />
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-sm text-muted-foreground">{label}</p>
        <strong className="mt-3 block font-display text-2xl sm:text-3xl">{value}</strong>
      </CardContent>
    </Card>
  );
}

function NegotiateDialog({ charge, onClose, onSaved }: { charge: FinanceCharge | null; onClose: () => void; onSaved: () => Promise<void> }) {
  const [waiveFine, setWaiveFine] = useState(false);
  const [waiveInterest, setWaiveInterest] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setWaiveFine(false);
    setWaiveInterest(false);
    setSaving(false);
    setError("");
  }, [charge?.id]);

  const after = waiveFine && waiveInterest ? charge?.baseCents ?? 0 : charge?.totalCents ?? 0;

  const save = async () => {
    if (!charge) return;
    setSaving(true);
    setError("");
    const result = await negotiateChargeFn({ data: { invoiceId: charge.id, waiveFine, waiveInterest } });
    setSaving(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    await onSaved();
  };

  return (
    <Dialog open={charge !== null} onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Negociar cobrança</DialogTitle>
          <DialogDescription>
            {charge ? `${charge.clientName} • ${competenceLabel(charge.competence)}` : ""}
          </DialogDescription>
        </DialogHeader>
        {charge && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Info label="Valor atual" value={moneyFromCents(charge.totalCents)} />
              <Info label="Após ajustes" value={moneyFromCents(after)} />
            </div>
            <label className="flex items-center justify-between gap-3 rounded-lg border p-4 text-sm">
              Remover multa desta cobrança
              <Switch checked={waiveFine} onCheckedChange={setWaiveFine} />
            </label>
            <label className="flex items-center justify-between gap-3 rounded-lg border p-4 text-sm">
              Remover juros desta cobrança
              <Switch checked={waiveInterest} onCheckedChange={setWaiveInterest} />
            </label>
            <p className="text-xs text-muted-foreground">A alteração é gravada no Asaas e nesta cobrança.</p>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={() => void save()} disabled={saving || (!waiveFine && !waiveInterest)}>
            {saving ? "Salvando..." : "Registrar negociação"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}
