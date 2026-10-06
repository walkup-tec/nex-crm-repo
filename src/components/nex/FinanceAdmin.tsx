import { useCallback, useEffect, useState } from "react";
import { History } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { dateBr, invoiceStatusLabel, moneyFromCents } from "@/lib/client-access";
import { chargeInPeriod, competenceLabel, dailyChargeTotals, financePeriodBounds, todayKey, whenLabel, type FinanceCharge, type FinancePeriod, type MasterFinance } from "@/lib/finance-access";
import { listMasterFinanceFn, negotiateChargeFn } from "@/lib/finance.functions";

const periods: { value: FinancePeriod; label: string }[] = [
  { value: "all", label: "Todo o período" },
  { value: "past-week", label: "Semana passada" },
  { value: "next-week", label: "Semana seguinte" },
  { value: "past-month", label: "Mês passado" },
  { value: "current-month", label: "Mês atual" },
];

export function FinanceAdmin() {
  const [snapshot, setSnapshot] = useState<MasterFinance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [period, setPeriod] = useState<FinancePeriod>("all");
  const [view, setView] = useState("lista");
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

  const bounds = financePeriodBounds(period, todayKey());
  const inPeriod = (snapshot?.charges ?? []).filter((item) => chargeInPeriod(item.dueDate, bounds));
  const charges = inPeriod.filter((item) => {
    if (filter === "overdue") return item.status === "overdue";
    if (filter === "paid") return item.status === "paid";
    return true;
  });
  const receivableCents = period === "all" ? snapshot?.receivableCents ?? 0 : inPeriod.filter((item) => item.status === "pending" || item.status === "overdue").reduce((sum, item) => sum + item.totalCents, 0);
  const overdueCents = period === "all" ? snapshot?.overdueCents ?? 0 : inPeriod.filter((item) => item.status === "overdue").reduce((sum, item) => sum + item.totalCents, 0);
  const receivedCents = period === "all" ? snapshot?.receivedThisMonthCents ?? 0 : inPeriod.filter((item) => item.status === "paid").reduce((sum, item) => sum + item.totalCents, 0);
  const days = dailyChargeTotals(snapshot?.charges ?? [], bounds);

  return (
    <div className="space-y-5">
      {loading && <p className="text-sm text-muted-foreground">Consultando cobranças no Asaas...</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}
      {snapshot?.notice && <p className="text-sm text-muted-foreground">{snapshot.notice}</p>}
      {snapshot && (
        <>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            {periods.map((item) => (
              <Button key={item.value} size="sm" variant={period === item.value ? "default" : "outline"} onClick={() => setPeriod(item.value)}>
                {item.label}
              </Button>
            ))}
          </div>
          {bounds && (
            <p className="text-xs text-muted-foreground">
              {dateBr(bounds.start)} a {dateBr(bounds.end)}
              {period === "past-week" ? " · últimos 7 dias" : period === "next-week" ? " · próximos 7 dias" : ""}
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-3">
            <Metric label="A receber" value={moneyFromCents(receivableCents)} />
            <Metric label="Vencidas" value={moneyFromCents(overdueCents)} />
            <Metric label={period === "all" ? "Recebido no mês" : "Recebido no período"} value={moneyFromCents(receivedCents)} />
          </div>
          <Tabs value={view} onValueChange={setView}>
            <TabsList>
              <TabsTrigger value="lista">Lista</TabsTrigger>
              <TabsTrigger value="graficos">Gráficos</TabsTrigger>
            </TabsList>
            <TabsContent value="lista" className="space-y-5">
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
                  {snapshot.charges.length === 0 ? "Nenhuma cobrança gravada." : inPeriod.length === 0 ? "Nenhuma cobrança neste período." : "Nenhuma cobrança neste filtro."}
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
            </TabsContent>
            <TabsContent value="graficos" className="space-y-5">
              {view === "graficos" && <DailyCharts days={days} />}
            </TabsContent>
          </Tabs>
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

function DailyCharts({ days }: { days: { label: string; totalCents: number }[] }) {
  const data = days.map((item) => ({ ...item, total: item.totalCents / 100 }));
  if (data.length === 0) return <p className="text-sm text-muted-foreground">Nenhuma cobrança neste período para montar os gráficos.</p>;
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Total por dia</CardTitle>
          <p className="text-sm text-muted-foreground">Soma das cobranças com vencimento em cada dia do período.</p>
        </CardHeader>
        <CardContent>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} minTickGap={24} />
                <YAxis tickFormatter={axisMoney} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} width={72} />
                <Tooltip content={<MoneyTooltip />} />
                <Bar dataKey="total" fill="var(--primary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Evolução diária</CardTitle>
          <p className="text-sm text-muted-foreground">Mesma soma diária, em linha, no período selecionado.</p>
        </CardHeader>
        <CardContent>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} minTickGap={24} />
                <YAxis tickFormatter={axisMoney} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} width={72} />
                <Tooltip content={<MoneyTooltip />} />
                <Line type="monotone" dataKey="total" stroke="var(--primary)" strokeWidth={2} dot={data.length <= 31} activeDot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </>
  );
}

function axisMoney(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

function MoneyTooltip({ active, payload }: { active?: boolean; payload?: { payload?: { label?: string; totalCents?: number } }[] }) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-sm">
      <p className="font-semibold">{row.label}</p>
      <p className="mt-1">{moneyFromCents(row.totalCents ?? 0)}</p>
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
            <p className="text-xs text-muted-foreground">
              {waiveFine && waiveInterest
                ? "Só esta cobrança fica no valor nominal. A multa e os juros dela saem no Asaas. As outras cobranças não mudam."
                : "A alteração vale apenas para esta cobrança no Asaas."}
            </p>
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
