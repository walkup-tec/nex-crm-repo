import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  CircleDollarSign,
  Copy,
  Eye,
  MessageCircle,
  MoreHorizontal,
  Search,
  Wallet,
  XCircle,
} from "lucide-react";
import QRCode from "@/vendor/qrcode/lib/browser.js";
import { DashboardKpiCard } from "@/components/nex/DashboardKpiCard";
import { PeriodPicker } from "@/components/nex/PeriodPicker";
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
import { dateBr, invoiceStatusLabel, moneyFromCents } from "@/lib/client-access";
import {
  chargeInPeriod,
  chargeMatchesClient,
  competenceLabel,
  financeMonitorCaption,
  financeMonitorGroups,
  pixQrPayload,
  todayKey,
  type ChargePix,
  type FinanceCharge,
  type FinanceMonitorItem,
  type MasterFinance,
} from "@/lib/finance-access";
import { applyMask } from "@/lib/masks";
import {
  cancelMasterChargeFn,
  changeInvoiceDueDateFn,
  chargePixFn,
  listMasterFinanceFn,
  markManualChargePaidFn,
  negotiateChargeFn,
  resendChargeDueWhatsappFn,
} from "@/lib/finance.functions";
import type { MetaPeriod } from "@/lib/meta-access";
import { cn } from "@/lib/utils";

export function FinanceAdmin() {
  const [snapshot, setSnapshot] = useState<MasterFinance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [period, setPeriod] = useState<MetaPeriod>({ mode: "total" });
  const [charge, setCharge] = useState<FinanceCharge | null>(null);
  const [pixCharge, setPixCharge] = useState<FinanceCharge | null>(null);
  const [dueCharge, setDueCharge] = useState<FinanceCharge | null>(null);
  const [cancelCharge, setCancelCharge] = useState<FinanceCharge | null>(null);
  const [markPaidCharge, setMarkPaidCharge] = useState<FinanceCharge | null>(null);
  const [resendingId, setResendingId] = useState("");
  const [resendNotice, setResendNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const resendWhatsapp = useCallback(async (item: FinanceCharge) => {
    setResendingId(item.id);
    setResendNotice(null);
    const result = await resendChargeDueWhatsappFn({ data: { invoiceId: item.id } });
    setResendingId("");
    if (!result.ok) {
      setResendNotice({ ok: false, text: result.message });
      return;
    }
    setResendNotice({
      ok: true,
      text: `Mensagem de vencimento reenviada para ${item.clientName}.`,
    });
  }, []);

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
    if (filter === "pending") return status === "pending";
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

  return (
    <div className="space-y-5">
      {loading && <p className="text-sm text-muted-foreground">Consultando cobranças...</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}
      {resendNotice ? (
        <p className={cn("text-sm", resendNotice.ok ? "text-emerald-600" : "text-destructive")}>
          {resendNotice.text}
        </p>
      ) : null}
      {snapshot && (
        <>
          <FinanceIntegrationMonitor items={snapshot.monitor ?? []} />
          <div className="grid gap-3 sm:grid-cols-3">
            <DashboardKpiCard
              icon={Wallet}
              accentColor="#22c55e"
              label="A receber"
              value={moneyFromCents(receivableCents)}
            />
            <DashboardKpiCard
              icon={CircleDollarSign}
              accentColor="#3b82f6"
              label={period.mode === "total" ? "Recebido no mês" : "Recebido no período"}
              value={moneyFromCents(receivedCents)}
            />
            <DashboardKpiCard
              icon={AlertCircle}
              accentColor="#ef4444"
              label="Vencido (em atraso)"
              value={moneyFromCents(overdueCents)}
            />
          </div>

          <Card className="overflow-hidden">
            <CardHeader className="space-y-4">
              <div>
                <CardTitle>Cobranças</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">Lista de contas a receber por cliente.</p>
              </div>
              <div className="flex w-full flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                <div className="relative w-full lg:max-w-sm">
                  <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" />
                  <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Nome do cliente ou CNPJ"
                    aria-label="Pesquisar por nome ou CNPJ"
                    className="pl-9"
                  />
                </div>
                <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center lg:w-auto">
                  <Select value={filter} onValueChange={setFilter}>
                    <SelectTrigger className="w-full sm:w-44" aria-label="Filtrar status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os status</SelectItem>
                      <SelectItem value="pending">Em aberto</SelectItem>
                      <SelectItem value="overdue">Vencido</SelectItem>
                      <SelectItem value="paid">Pagas</SelectItem>
                    </SelectContent>
                  </Select>
                  <PeriodPicker
                    value={period}
                    disabled={loading}
                    onApply={setPeriod}
                    allowFuture
                    totalLabel="Todo o período"
                    totalHint="Exibe cobranças e totais de todo o período disponível."
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[960px] text-left text-sm">
                  <thead className="border-y bg-muted/40 text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
                    <tr>
                      <th className="px-5 py-3 font-medium">Cliente</th>
                      <th className="px-4 py-3 font-medium">CNPJ</th>
                      <th className="px-4 py-3 font-medium">Competência</th>
                      <th className="px-4 py-3 font-medium">Vencimento</th>
                      <th className="px-4 py-3 font-medium">Valor</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-5 py-3 font-medium">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {charges.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-5 py-8 text-center text-muted-foreground">
                          {snapshot.charges.length === 0
                            ? "Nenhuma cobrança gravada."
                            : inPeriod.length === 0
                              ? "Nenhuma cobrança neste período."
                              : query.trim()
                                ? "Nenhum cliente encontrado para esta pesquisa."
                                : "Nenhuma cobrança neste filtro."}
                        </td>
                      </tr>
                    ) : (
                      charges.map((item) => {
                        const status = listedStatus(item);
                        return (
                          <tr key={item.id} className="hover:bg-muted/30">
                            <td className="px-5 py-3 font-medium">{item.clientName}</td>
                            <td className="px-4 py-3 tabular-nums text-muted-foreground">
                              {item.clientDocument.replace(/\D/g, "")
                                ? applyMask("doc", item.clientDocument)
                                : "—"}
                            </td>
                            <td className="px-4 py-3">{competenceLabel(item.competence)}</td>
                            <td className="px-4 py-3 tabular-nums">{dateBr(item.dueDate)}</td>
                            <td className="px-4 py-3 font-semibold tabular-nums">
                              {moneyFromCents(item.totalCents)}
                            </td>
                            <td className="px-4 py-3">
                              <span className="inline-flex items-center gap-1.5 text-xs font-medium">
                                <span
                                  className={cn(
                                    "size-1.5 rounded-full",
                                    status === "overdue"
                                      ? "bg-red-500"
                                      : status === "paid"
                                        ? "bg-blue-500"
                                        : "bg-emerald-500",
                                  )}
                                />
                                {status === "paid" ? "Paga" : invoiceStatusLabel(status)}
                              </span>
                            </td>
                            <td className="px-5 py-3">
                              <div className="flex items-center gap-2">
                                {status !== "paid" && status !== "cancelled" ? (
                                  <>
                                    {item.pixCode ? (
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
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="icon"
                                      disabled={resendingId === item.id}
                                      aria-label={`Reenviar cobrança por WhatsApp para ${item.clientName}`}
                                      title="Reenviar notificação de vencimento no WhatsApp"
                                      onClick={() => void resendWhatsapp(item)}
                                    >
                                      <MessageCircle className="size-4" />
                                    </Button>
                                  </>
                                ) : null}
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="icon"
                                      aria-label={`Ações de ${item.clientName}`}
                                    >
                                      <MoreHorizontal className="size-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem
                                      disabled={!item.canMarkPaid}
                                      onSelect={() => setMarkPaidCharge(item)}
                                    >
                                      Marcar como paga
                                    </DropdownMenuItem>
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
                                      disabled={
                                        !item.canCancel ||
                                        (item.billingProvider !== "cora" &&
                                          item.billingProvider !== "manual")
                                      }
                                      className="text-destructive focus:text-destructive"
                                      onSelect={() => setCancelCharge(item)}
                                    >
                                      Excluir
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
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
      <MarkPaidDialog
        charge={markPaidCharge}
        onClose={() => setMarkPaidCharge(null)}
        onSaved={async () => {
          setMarkPaidCharge(null);
          await load();
        }}
      />
    </div>
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

  const cancelCopy =
    charge?.billingProvider === "cora"
      ? "A cobrança será cancelada na Cora e marcada como excluída no NEX."
      : charge?.billingProvider === "manual"
        ? "A parcela manual será marcada como excluída no NEX. Não há cobrança na Cora/Asaas."
        : "A cobrança será removida no Asaas e marcada como excluída no NEX.";

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
              {cancelCopy} Valor: <strong>{moneyFromCents(charge.totalCents)}</strong> • vencimento{" "}
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

function MarkPaidDialog({
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
    const result = await markManualChargePaidFn({ data: { invoiceId: charge.id } });
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
          <DialogTitle>Marcar como paga</DialogTitle>
          <DialogDescription>
            {charge ? `${charge.clientName} • ${competenceLabel(charge.competence)}` : ""}
          </DialogDescription>
        </DialogHeader>
        {charge ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Confirma o recebimento desta parcela manual? Valor:{" "}
              <strong>{moneyFromCents(charge.totalCents)}</strong> • vencimento{" "}
              <strong>{dateBr(charge.dueDate)}</strong>.
            </p>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={() => void save()} disabled={saving}>
            {saving ? "Salvando..." : "Marcar como paga"}
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

function FinanceIntegrationMonitor({ items }: { items: FinanceMonitorItem[] }) {
  const groups = financeMonitorGroups(items);
  if (groups.length === 0) return null;
  return (
    <div
      className="flex flex-col gap-3 rounded-lg border bg-card/60 px-4 py-3 text-sm sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-8 sm:gap-y-2"
      role="status"
      aria-label="Monitor de integração financeira"
    >
      {groups.map((group) => (
        <div key={group.provider} className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="font-semibold text-foreground">{group.label}</span>
          {group.items.map((item) => {
            const caption = financeMonitorCaption(item);
            return (
              <div key={item.id} className="flex items-center gap-2 text-muted-foreground">
                {item.ok ? (
                  <CheckCircle2 className="size-4 shrink-0 text-emerald-500" aria-hidden />
                ) : (
                  <XCircle className="size-4 shrink-0 text-red-500" aria-hidden />
                )}
                <span className={item.ok ? "text-foreground/90" : "text-foreground/80"}>{caption}</span>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
