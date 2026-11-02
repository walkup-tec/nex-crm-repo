import { useCallback, useEffect, useState } from "react";
import { Copy, Eye, History, MoreHorizontal, Search } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import QRCode from "@/vendor/qrcode/lib/browser.js";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PeriodPicker } from "@/components/nex/PeriodPicker";
import { dateBr, invoiceStatusLabel, moneyFromCents } from "@/lib/client-access";
import {
  chargeInPeriod,
  chargeMatchesClient,
  competenceLabel,
  dailyChargeTotals,
  pixQrPayload,
  todayKey,
  whenLabel,
  type ChargePix,
  type FinanceCharge,
  type MasterFinance,
} from "@/lib/finance-access";
import { applyMask } from "@/lib/masks";
import {
  cancelMasterChargeFn,
  changeInvoiceDueDateFn,
  chargePixFn,
  listMasterFinanceFn,
  negotiateChargeFn,
} from "@/lib/finance.functions";
import type { MetaPeriod } from "@/lib/meta-access";

export function FinanceAdmin() {
  const [snapshot, setSnapshot] = useState<MasterFinance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [period, setPeriod] = useState<MetaPeriod>({ mode: "total" });
  const [view, setView] = useState("lista");
  const [charge, setCharge] = useState<FinanceCharge | null>(null);
  const [pixCharge, setPixCharge] = useState<FinanceCharge | null>(null);
  const [dueCharge, setDueCharge] = useState<FinanceCharge | null>(null);
  const [cancelCharge, setCancelCharge] = useState<FinanceCharge | null>(null);

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

  const today = todayKey();
  const bounds = period.mode === "total" ? null : { start: period.since, end: period.until };
  const listedStatus = (item: FinanceCharge) =>
    item.status === "pending" && item.dueDate.slice(0, 10) < today ? "overdue" : item.status;
  const inPeriod = (snapshot?.charges ?? []).filter((item) => chargeInPeriod(item.dueDate, bounds));
  const charges = inPeriod.filter((item) => {
    const status = listedStatus(item);
    if (filter === "overdue") return status === "overdue";
    if (filter === "paid") return status === "paid";
    return true;
  }).filter((item) => chargeMatchesClient(item, query));
  const receivableCents =
    period.mode === "total"
      ? snapshot?.receivableCents ?? 0
      : inPeriod
          .filter((item) => item.status === "pending" || item.status === "overdue")
          .reduce((sum, item) => sum + item.totalCents, 0);
  const overdueCents = inPeriod
    .filter((item) => listedStatus(item) === "overdue")
    .reduce((sum, item) => sum + item.totalCents, 0);
  const receivedCents =
    period.mode === "total"
      ? snapshot?.receivedThisMonthCents ?? 0
      : inPeriod.filter((item) => item.status === "paid").reduce((sum, item) => sum + item.totalCents, 0);
  const days = dailyChargeTotals(snapshot?.charges ?? [], bounds);

  return (
    <div className="space-y-5">
      {loading && <p className="text-sm text-muted-foreground">Consultando cobranças no Asaas...</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}
      {snapshot?.notice && <p className="text-sm text-muted-foreground">{snapshot.notice}</p>}
      {snapshot && (
        <>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
            <PeriodPicker
              value={period}
              disabled={loading}
              onApply={setPeriod}
              totalHint="Exibe cobranças, totais e gráficos de todo o período disponível."
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Metric label="A receber" value={moneyFromCents(receivableCents)} />
            <Metric label="Vencidas" value={moneyFromCents(overdueCents)} />
            <Metric
              label={period.mode === "total" ? "Recebido no mês" : "Recebido no período"}
              value={moneyFromCents(receivedCents)}
            />
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
                <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                  <div className="relative sm:w-72">
                    <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" />
                    <Input
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Nome ou CNPJ"
                      aria-label="Pesquisar por nome ou CNPJ"
                      className="pl-9"
                    />
                  </div>
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
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {charges.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {snapshot.charges.length === 0 ? "Nenhuma cobrança gravada." : inPeriod.length === 0 ? "Nenhuma cobrança neste período." : query.trim() ? "Nenhum cliente encontrado para esta pesquisa." : "Nenhuma cobrança neste filtro."}
                </p>
              ) : (
                charges.map((item) => (
                  <div key={item.id} className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center">
                    <div className="flex-1">
                      <p className="font-semibold">{item.clientName}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.clientDocument.replace(/\D/g, "") ? `${applyMask("doc", item.clientDocument)} • ` : ""}
                        Competência {competenceLabel(item.competence)} • vencimento {dateBr(item.dueDate)}
                      </p>
                    </div>
                    <strong>{moneyFromCents(item.totalCents)}</strong>
                    <Badge variant={listedStatus(item) === "overdue" ? "destructive" : "outline"}>{listedStatus(item) === "paid" ? "Paga" : invoiceStatusLabel(listedStatus(item))}</Badge>
                    <div className="flex items-center gap-2">
                      {listedStatus(item) !== "paid" && listedStatus(item) !== "cancelled" ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          aria-label={`Ver Pix de ${item.clientName}`}
                          onClick={() => setPixCharge(item)}
                        >
                          <Eye className="size-4" />
                        </Button>
                      ) : null}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button type="button" variant="outline" size="icon" aria-label={`Ações de ${item.clientName}`}>
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            disabled={!item.canChangeDue}
                            onSelect={() => setDueCharge(item)}
                          >
                            Mudar vencimento
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            disabled={!item.canNegotiate}
                            onSelect={() => setCharge(item)}
                          >
                            Negociação
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            disabled={!item.canCancel || item.billingProvider !== "cora"}
                            className="text-destructive focus:text-destructive"
                            onSelect={() => setCancelCharge(item)}
                          >
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
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
      <PixViewDialog charge={pixCharge} onClose={() => setPixCharge(null)} />
      <DueDateDialog
        charge={dueCharge}
        onClose={() => setDueCharge(null)}
        onSaved={async () => {
          setDueCharge(null);
          await load();
        }}
      />
      <CancelChargeDialog
        charge={cancelCharge}
        onClose={() => setCancelCharge(null)}
        onSaved={async () => {
          setCancelCharge(null);
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

async function copyDataUrlImage(dataUrl: string) {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  if (typeof ClipboardItem === "undefined" || !navigator.clipboard?.write) {
    const anchor = document.createElement("a");
    anchor.href = dataUrl;
    anchor.download = "pix-qrcode.png";
    anchor.click();
    return "download";
  }
  await navigator.clipboard.write([new ClipboardItem({ [blob.type || "image/png"]: blob })]);
  return "copied";
}

function PixViewDialog({ charge, onClose }: { charge: FinanceCharge | null; onClose: () => void }) {
  const [pix, setPix] = useState<ChargePix | null>(null);
  const [qrImage, setQrImage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    setPix(null);
    setQrImage("");
    setError("");
    setNotice("");
    if (!charge) return;
    let alive = true;
    void (async () => {
      setLoading(true);
      const result = await chargePixFn({ data: { invoiceId: charge.id } });
      if (!alive) return;
      setLoading(false);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setPix(result.data);
    })();
    return () => {
      alive = false;
    };
  }, [charge?.id]);

  useEffect(() => {
    const payload = pix?.payload?.trim() || pixQrPayload(charge?.pixCode ?? null);
    if (!payload) {
      setQrImage(pix?.image ? `data:image/png;base64,${pix.image}` : "");
      return;
    }
    if (pix?.image) {
      setQrImage(pix.image.startsWith("data:") ? pix.image : `data:image/png;base64,${pix.image}`);
      return;
    }
    let alive = true;
    void QRCode.toDataURL(payload, {
      width: 480,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#111111", light: "#ffffff" },
    })
      .then((url) => {
        if (alive) setQrImage(url);
      })
      .catch(() => {
        if (alive) setError("Não foi possível montar o QR Code Pix.");
      });
    return () => {
      alive = false;
    };
  }, [pix, charge?.pixCode]);

  const payload = pix?.payload?.trim() || pixQrPayload(charge?.pixCode ?? null);
  const link = pix?.invoiceUrl?.trim() || charge?.invoiceUrl?.trim() || "";

  return (
    <Dialog open={charge !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Pix da cobrança</DialogTitle>
          <DialogDescription>
            {charge ? `${charge.clientName} • ${competenceLabel(charge.competence)}` : ""}
          </DialogDescription>
        </DialogHeader>
        {loading ? <p className="text-sm text-muted-foreground">Carregando Pix...</p> : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {!loading && !error && charge ? (
          <div className="space-y-4">
            <div className="grid place-items-center rounded-xl border bg-white p-4">
              {qrImage ? (
                <img src={qrImage} alt="QR Code Pix" className="size-56" />
              ) : (
                <p className="text-sm text-muted-foreground">QR Code indisponível.</p>
              )}
            </div>
            <p className="text-center text-lg font-semibold tabular-nums">
              {moneyFromCents(pix?.totalCents ?? charge.totalCents)}
            </p>
            <div className="grid gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={!qrImage}
                onClick={() => {
                  void copyDataUrlImage(qrImage)
                    .then((mode) =>
                      setNotice(mode === "download" ? "Imagem baixada." : "Imagem do QR Code copiada."),
                    )
                    .catch(() => setNotice("Não foi possível copiar a imagem."));
                }}
              >
                <Copy className="size-4" />
                Copiar imagem do QR Code
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={!link && !payload}
                onClick={() => {
                  const value = link || payload;
                  if (!value) return;
                  void navigator.clipboard.writeText(value).then(() => {
                    setNotice(link ? "Link do QR Code copiado." : "Código Pix copiado.");
                  });
                }}
              >
                <Copy className="size-4" />
                {link ? "Copiar link do QR Code" : "Copiar código Pix"}
              </Button>
            </div>
            {notice ? <p className="text-sm text-muted-foreground">{notice}</p> : null}
          </div>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DueDateDialog({
  charge,
  onClose,
  onSaved,
}: {
  charge: FinanceCharge | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setDueDate(charge?.dueDate.slice(0, 10) ?? "");
    setSaving(false);
    setError("");
  }, [charge?.id, charge?.dueDate]);

  const save = async () => {
    if (!charge) return;
    setSaving(true);
    setError("");
    const result = await changeInvoiceDueDateFn({ data: { invoiceId: charge.id, dueDate } });
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
          <DialogTitle>Mudar vencimento</DialogTitle>
          <DialogDescription>
            {charge ? `${charge.clientName} • ${competenceLabel(charge.competence)}` : ""}
          </DialogDescription>
        </DialogHeader>
        {charge ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Vencimento atual: <strong>{dateBr(charge.dueDate)}</strong>
              {charge.billingProvider === "cora"
                ? " A Cora cancela o Pix atual e emite outro com a nova data."
                : " O vencimento é atualizado no Asaas."}
            </p>
            <label className="grid gap-2 text-sm">
              Novo vencimento
              <Input
                type="date"
                value={dueDate}
                min={todayKey()}
                onChange={(event) => setDueDate(event.target.value)}
              />
            </label>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button
            onClick={() => void save()}
            disabled={saving || !dueDate || dueDate === charge?.dueDate.slice(0, 10)}
          >
            {saving ? "Salvando..." : "Salvar vencimento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CancelChargeDialog({
  charge,
  onClose,
  onSaved,
}: {
  charge: FinanceCharge | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setSaving(false);
    setError("");
  }, [charge?.id]);

  const save = async () => {
    if (!charge) return;
    setSaving(true);
    setError("");
    const result = await cancelMasterChargeFn({ data: { invoiceId: charge.id } });
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
          <DialogTitle>Excluir cobrança</DialogTitle>
          <DialogDescription>
            {charge ? `${charge.clientName} • ${competenceLabel(charge.competence)}` : ""}
          </DialogDescription>
        </DialogHeader>
        {charge ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {charge.billingProvider === "cora"
                ? "A cobrança será cancelada na Cora e marcada como excluída no NEX."
                : "A cobrança será removida no Asaas e marcada como excluída no NEX."}{" "}
              Valor: <strong>{moneyFromCents(charge.totalCents)}</strong> • vencimento{" "}
              <strong>{dateBr(charge.dueDate)}</strong>.
            </p>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={() => void save()} disabled={saving}>
            {saving ? "Excluindo..." : "Excluir cobrança"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
              {charge.billingProvider === "cora"
                ? "A Cora não altera o Pix já emitido. Ele é cancelado e um novo Pix sai sem a multa ou os juros marcados. Se o vencimento já passou, o novo Pix vence hoje. As outras cobranças não mudam."
                : waiveFine && waiveInterest
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
