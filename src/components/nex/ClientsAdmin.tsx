import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { CircleDollarSign, MoreHorizontal, Pencil, Plus, Trash2, UserRoundCog } from "lucide-react";
import { applyMask } from "@/lib/masks";
import type { ClientDraft, ListedClient } from "@/lib/client-access";
import { clientStatusLabel, dateBr, invoiceStatusLabel, isInactiveClient, moneyFromCents, percentBr } from "@/lib/client-access";
import { lookupCnpjFn } from "@/lib/cnpj.functions";
import { createClientFn, listClientsFn, lookupAsaasSubscriptionFn, setClientStatusFn, updateClientFn } from "@/lib/clients.functions";
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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const emptyDraft: ClientDraft = {
  legalName: "",
  document: "",
  responsibleName: "",
  responsibleEmail: "",
  whatsapp: "",
  sameFinancePhone: true,
  monthlyFee: "",
  dueDay: "",
  startsOn: "",
  endsOn: "",
  finePercent: "",
  interestPercent: "",
  asaasSubscriptionId: "",
};

function draftFrom(client: ListedClient): ClientDraft {
  const documentDigits = client.document.replace(/\D/g, "");
  return {
    legalName: client.legalName,
    document: documentDigits.length === 11 || documentDigits.length === 14 ? applyMask("doc", documentDigits) : client.document,
    responsibleName: client.responsibleName,
    responsibleEmail: client.responsibleEmail,
    whatsapp: client.whatsapp ? applyMask("phone", client.whatsapp) : "",
    sameFinancePhone: client.sameFinancePhone,
    monthlyFee: client.monthlyFeeCents == null ? "" : moneyFromCents(client.monthlyFeeCents),
    dueDay: client.dueDay == null ? "" : String(client.dueDay),
    startsOn: dateBr(client.startsOn, ""),
    endsOn: dateBr(client.endsOn, ""),
    finePercent: client.finePercent == null ? "" : percentBr(client.finePercent),
    interestPercent: client.interestPercent == null ? "" : percentBr(client.interestPercent),
    asaasSubscriptionId: client.asaasSubscriptionId,
  };
}

function initials(name: string) {
  const parts = name.split(" ").filter(Boolean).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("") || "CL";
}

export function ClientsAdmin() {
  const navigate = useNavigate();
  const [clients, setClients] = useState<ListedClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [tab, setTab] = useState("active");
  const [editor, setEditor] = useState<ListedClient | null | "create">(null);
  const [selected, setSelected] = useState<ListedClient | null>(null);
  const [pendingStatus, setPendingStatus] = useState<ListedClient | null>(null);
  const [savingStatus, setSavingStatus] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const result = await listClientsFn();
    setLoading(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setClients(result.data);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const active = clients.filter((client) => !isInactiveClient(client.status));
  const inactive = clients.filter((client) => isInactiveClient(client.status));
  const visible = tab === "active" ? active : inactive;

  const changeStatus = async () => {
    if (!pendingStatus) return;
    const activeNext = isInactiveClient(pendingStatus.status);
    setSavingStatus(true);
    const result = await setClientStatusFn({ data: { id: pendingStatus.id, active: activeNext } });
    setSavingStatus(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setNotice(activeNext ? `${pendingStatus.legalName} voltou para Ativos.` : `${pendingStatus.legalName} foi desativado e está em Inativos.`);
    setTab(activeNext ? "active" : "inactive");
    setPendingStatus(null);
    setSelected(null);
    await load();
  };

  return (
    <div className="space-y-4">
      {notice && <p className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm">{notice}</p>}
      {error && (
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}
      <Tabs value={tab} onValueChange={setTab}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <TabsList>
            <TabsTrigger value="active">
              Ativos <Badge variant="secondary" className="ml-2">{active.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="inactive">
              Inativos <Badge variant="secondary" className="ml-2">{inactive.length}</Badge>
            </TabsTrigger>
          </TabsList>
          <Button className="sm:ml-auto" onClick={() => setEditor("create")}>
            <Plus />
            Novo cliente
          </Button>
        </div>
        <TabsContent value={tab} className="mt-4 space-y-3">
          {loading && (
            <div className="space-y-3" aria-busy="true">
              <div className="h-20 animate-pulse rounded-lg bg-muted" />
              <div className="h-20 animate-pulse rounded-lg bg-muted" />
            </div>
          )}
          {!loading && visible.length === 0 && (
            <div className="rounded-lg border border-dashed px-4 py-10 text-center">
              <p className="font-medium">{tab === "active" ? "Nenhum cliente ativo" : "Nenhum cliente inativo"}</p>
              <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                {tab === "active"
                  ? "Cadastre a empresa e o contrato. O acesso do cliente continua em Usuários."
                  : "Os clientes desativados, bloqueados ou com contrato encerrado ficam nesta lista."}
              </p>
            </div>
          )}
          {!loading &&
            visible.map((client) => (
              <Card key={client.id}>
                <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
                  <div className="grid size-11 place-items-center rounded-lg bg-brand-soft font-bold text-primary">{initials(client.legalName)}</div>
                  <div className="flex-1">
                    <p className="font-semibold">{client.legalName}</p>
                    <p className="text-sm text-muted-foreground">Responsável: {client.responsibleName || "não informado"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Saldo Meta</p>
                    <p className={client.balanceKnown && client.balanceCents <= 2000 ? "font-bold text-destructive" : "font-bold"}>
                      {client.balanceKnown ? moneyFromCents(client.balanceCents) : "Aguardando a Meta"}
                    </p>
                  </div>
                  <Badge variant={client.status === "active" ? "default" : "destructive"}>{clientStatusLabel(client.status)}</Badge>
                  <Button variant="ghost" size="icon" onClick={() => setSelected(client)} aria-label={`Abrir ${client.legalName}`}>
                    <MoreHorizontal />
                  </Button>
                </CardContent>
              </Card>
            ))}
        </TabsContent>
      </Tabs>

      <ClientDialog
        client={selected}
        onClose={() => setSelected(null)}
        onEdit={() => {
          if (!selected) return;
          setEditor(selected);
          setSelected(null);
        }}
        onStatus={() => {
          if (!selected) return;
          setPendingStatus(selected);
          setSelected(null);
        }}
        onSupport={async () => {
          if (!selected) return;
          await navigate({ to: "/master/suporte/$orgId", params: { orgId: selected.id } });
        }}
        onFinance={() => {
          if (!selected) return;
          void navigate({ to: "/master/financeiro/$orgId", params: { orgId: selected.id } });
        }}
      />

      <ClientForm
        open={editor !== null}
        client={editor && editor !== "create" ? editor : null}
        onOpenChange={(open) => !open && setEditor(null)}
        onSaved={async (message) => {
          setEditor(null);
          setNotice(message);
          await load();
        }}
      />

      <AlertDialog open={pendingStatus !== null} onOpenChange={(open) => !open && !savingStatus && setPendingStatus(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingStatus && isInactiveClient(pendingStatus.status) ? "Reativar" : "Desativar"} {pendingStatus?.legalName}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingStatus && isInactiveClient(pendingStatus.status)
                ? "O cliente volta para Ativos e os usuários conseguem entrar de novo."
                : "O cliente vai para Inativos e os usuários dessa empresa deixam de entrar no NEX Ads."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={savingStatus}>Cancelar</AlertDialogCancel>
            <Button variant={pendingStatus && isInactiveClient(pendingStatus.status) ? "default" : "destructive"} disabled={savingStatus} onClick={() => void changeStatus()}>
              {savingStatus ? "Salvando..." : pendingStatus && isInactiveClient(pendingStatus.status) ? "Reativar cliente" : "Desativar cliente"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ClientDialog({
  client,
  onClose,
  onEdit,
  onStatus,
  onSupport,
  onFinance,
}: {
  client: ListedClient | null;
  onClose: () => void;
  onEdit: () => void;
  onStatus: () => void;
  onSupport: () => Promise<void>;
  onFinance: () => void;
}) {
  const [working, setWorking] = useState(false);
  const inactive = client ? isInactiveClient(client.status) : false;
  return (
    <Dialog open={client !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{client?.legalName}</DialogTitle>
          <DialogDescription>Visão operacional do cliente</DialogDescription>
        </DialogHeader>
        {client && (
          <Tabs defaultValue="summary">
            <TabsList className="w-full">
              <TabsTrigger value="summary">Resumo</TabsTrigger>
              <TabsTrigger value="contract">Contrato</TabsTrigger>
              <TabsTrigger value="meta">Contas Meta</TabsTrigger>
            </TabsList>
            <TabsContent value="summary" className="grid gap-3 sm:grid-cols-2">
              <Info label="Responsável" value={client.responsibleName || "—"} />
              <Info label="Situação" value={clientStatusLabel(client.status)} />
              <Info label="Financeiro" value={client.financeLabel} />
              <Info label="Saldo Meta" value={client.balanceKnown ? moneyFromCents(client.balanceCents) : "Aguardando a Meta"} />
            </TabsContent>
            <TabsContent value="contract" className="grid gap-3 sm:grid-cols-2">
              <Info label="Mensalidade" value={client.monthlyFeeCents == null ? "Contrato não cadastrado" : moneyFromCents(client.monthlyFeeCents)} />
              <Info label="Vencimento" value={client.dueDay == null ? "—" : `Todo dia ${client.dueDay}`} />
              <Info label="Início" value={dateBr(client.startsOn)} />
              <Info label="Término" value={dateBr(client.endsOn)} />
              <Info label="Multa" value={client.finePercent == null ? "—" : percentBr(client.finePercent)} />
              <Info label="Juros mensais" value={client.interestPercent == null ? "—" : percentBr(client.interestPercent)} />
            </TabsContent>
            <TabsContent value="meta" className="space-y-3">
              <Info label="Portfólio empresarial" value={client.portfolioId || "Não informado"} />
              <Info
                label="Contas vinculadas"
                value={client.metaAccounts.length ? client.metaAccounts.map((account) => `${account.name} • ${account.id}`).join(" / ") : "Nenhuma conta informada"}
              />
              <p className="text-sm text-muted-foreground">A Meta só é consultada depois que a conexão da empresa estiver autorizada.</p>
            </TabsContent>
          </Tabs>
        )}
        <div className="grid gap-2 sm:grid-cols-2">
          <Button
            disabled={working || !client}
            onClick={() => {
              setWorking(true);
              void onSupport().finally(() => setWorking(false));
            }}
          >
            <UserRoundCog />
            Acessar em modo suporte
          </Button>
          <Button variant="outline" onClick={onEdit}>
            <Pencil />
            Editar cliente
          </Button>
          <Button variant="outline" onClick={onFinance}>
            <CircleDollarSign />
            Abrir financeiro
          </Button>
          <Button variant="destructive" onClick={onStatus}>
            <Trash2 />
            {inactive ? "Reativar cliente" : "Desativar cliente"}
          </Button>
        </div>
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

function ClientForm({
  open,
  client,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  client: ListedClient | null;
  onOpenChange: (open: boolean) => void;
  onSaved: (message: string) => Promise<void>;
}) {
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState<ClientDraft>(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [cnpjNote, setCnpjNote] = useState("");
  const [asaasNote, setAsaasNote] = useState("");
  const [asaasLoading, setAsaasLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStep(1);
    setSaving(false);
    setFormError("");
    setCnpjNote("");
    setAsaasNote("");
    setAsaasLoading(false);
    setDraft(client ? draftFrom(client) : emptyDraft);
  }, [open, client]);

  useEffect(() => {
    if (!open || step !== 1) return;
    const digits = draft.document.replace(/\D/g, "");
    const savedDigits = client?.document.replace(/\D/g, "") ?? "";
    if (digits.length !== 14 || digits === savedDigits) {
      if (digits.length !== 14) setCnpjNote("");
      return;
    }
    let active = true;
    setCnpjNote("Consultando o CNPJ...");
    const timer = setTimeout(() => {
      void lookupCnpjFn({ data: { document: digits } }).then((result) => {
        if (!active) return;
        if (!result.ok) {
          setCnpjNote(result.message);
          return;
        }
        setCnpjNote("Razão social encontrada.");
        setDraft((current) => ({ ...current, legalName: result.data.legalName }));
      });
    }, 400);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [open, step, draft.document, client]);

  const set = (patch: Partial<ClientDraft>) => setDraft((current) => ({ ...current, ...patch }));

  const submit = async () => {
    setSaving(true);
    setFormError("");
    const result = client ? await updateClientFn({ data: { ...draft, id: client.id } }) : await createClientFn({ data: draft });
    setSaving(false);
    if (!result.ok) {
      setFormError(result.message);
      return;
    }
    await onSaved(client ? "Cliente atualizado." : "Cliente criado.");
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{client ? "Editar cliente" : "Novo cliente"}</DialogTitle>
          <DialogDescription>
            Etapa {step} de 2 • {["Empresa e responsável", "Contrato"][step - 1]}
          </DialogDescription>
        </DialogHeader>
        <Progress value={step * 50} />
        {formError && (
          <p role="alert" className="text-sm text-destructive">
            {formError}
          </p>
        )}
        {step === 1 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="CPF ou CNPJ" value={draft.document} onChange={(value) => set({ document: applyMask("doc", value) })} placeholder="00.000.000/0000-00" />
            <Field label="Razão social" value={draft.legalName} onChange={(value) => set({ legalName: value })} placeholder="Preenchida pelo CNPJ" />
            {cnpjNote && (
              <p className={`sm:col-span-2 text-xs ${cnpjNote.includes("encontrada") || cnpjNote.startsWith("Consultando") ? "text-muted-foreground" : "text-destructive"}`}>
                {cnpjNote}
              </p>
            )}
            <Field label="Responsável" value={draft.responsibleName} onChange={(value) => set({ responsibleName: value })} placeholder="Nome completo" />
            <div>
              <Field label="E-mail" value={draft.responsibleEmail} onChange={(value) => set({ responsibleEmail: value })} placeholder="nome@empresa.com.br" />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mt-2 h-8 px-2 text-muted-foreground"
                disabled={asaasLoading || !draft.responsibleEmail.includes("@")}
                onClick={() => {
                  setAsaasLoading(true);
                  setAsaasNote("");
                  void lookupAsaasSubscriptionFn({ data: { email: draft.responsibleEmail } }).then((result) => {
                    setAsaasLoading(false);
                    if (!result.ok) {
                      setAsaasNote(result.message);
                      return;
                    }
                    setAsaasNote(result.data.note);
                    set({
                      monthlyFee: result.data.monthlyFee,
                      dueDay: result.data.dueDay,
                      startsOn: result.data.startsOn,
                      endsOn: result.data.endsOn,
                      finePercent: result.data.finePercent,
                      interestPercent: result.data.interestPercent,
                      asaasSubscriptionId: result.data.subscriptionId,
                    });
                  });
                }}
              >
                {asaasLoading ? "Consultando o Asaas..." : "Integrar Asaas"}
              </Button>
              {asaasNote && (
                <p className={`mt-1 text-xs ${asaasNote.startsWith("Assinatura localizada") ? "text-muted-foreground" : "text-destructive"}`}>{asaasNote}</p>
              )}
            </div>
            <Field label="WhatsApp" value={draft.whatsapp} onChange={(value) => set({ whatsapp: applyMask("phone", value) })} placeholder="(00) 00000-0000" />
            <label className="flex items-center gap-2 self-end pb-2 text-sm">
              <Checkbox checked={draft.sameFinancePhone} onCheckedChange={(value) => set({ sameFinancePhone: value === true })} />
              Mesmo WhatsApp do responsável
            </label>
          </div>
        )}
        {step === 2 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Mensalidade" value={draft.monthlyFee} onChange={(value) => set({ monthlyFee: applyMask("money", value) })} placeholder="R$ 0,00" />
            <Field label="Dia do vencimento" value={draft.dueDay} onChange={(value) => set({ dueDay: applyMask("day", value) })} placeholder="10" />
            <Field label="Início" value={draft.startsOn} onChange={(value) => set({ startsOn: applyMask("date", value) })} placeholder="DD/MM/AAAA" />
            <Field label="Término" value={draft.endsOn} onChange={(value) => set({ endsOn: applyMask("date", value) })} placeholder="DD/MM/AAAA" />
            <Field label="Multa" value={draft.finePercent} onChange={(value) => set({ finePercent: applyMask("percent", value) })} placeholder="2,00%" />
            <Field label="Juros mensais" value={draft.interestPercent} onChange={(value) => set({ interestPercent: applyMask("percent", value) })} placeholder="1,00%" />
          </div>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" disabled={step === 1 || saving} onClick={() => setStep((current) => current - 1)}>
            Voltar
          </Button>
          {step < 2 ? (
            <Button type="button" disabled={saving} onClick={() => setStep((current) => current + 1)}>
              Continuar
            </Button>
          ) : (
            <Button type="button" disabled={saving} onClick={() => void submit()}>
              {saving ? "Salvando..." : client ? "Salvar cliente" : "Criar cliente"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  const id = label.replace(/\W+/g, "-").toLowerCase();
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <Input id={id} className="mt-2" placeholder={placeholder} value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}
