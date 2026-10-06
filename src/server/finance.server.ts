import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  centsFromReais,
  chargeStatus,
  competenceLabel,
  competenceOf,
  daysPast,
  keepsNominalValue,
  monthKey,
  nominalPaymentId,
  penaltiesRemain,
  todayKey,
  waivedOnCharge,
  type FinanceAudit,
  type FinanceCharge,
  type MasterFinance,
  type OwnFinance,
} from "@/lib/finance-access";
import type { InvoiceStatus } from "@/lib/client-access";
import { asaasConfigured, createNominalPix, deletePayment, getPayment, listSubscriptionPayments, readPaymentPix, waivePaymentPenalties, type AsaasPayment } from "@/server/asaas.server";

type Role = "master" | "client_admin" | "client_user";
type Actor = { id: string; role: Role; organizationId: string | null; fullName: string };
type ContractRow = { id: string; organization_id: string; external_subscription_id: string | null; monthly_fee_cents: number; starts_on: string; ends_on: string | null };
type InvoiceRow = {
  id: string;
  organization_id: string;
  competence: string;
  due_date: string;
  base_amount_cents: number;
  total_amount_cents: number;
  status: InvoiceStatus;
  paid_at: string | null;
  invoice_url: string | null;
  external_charge_id: string | null;
};

function fail(message: string): never {
  throw new Error(message);
}

async function actorOf(userId: string): Promise<Actor> {
  const [{ data: profile, error: profileError }, { data: roles, error: roleError }] = await Promise.all([
    supabaseAdmin.from("profiles").select("id, full_name, organization_id, is_blocked").eq("id", userId).maybeSingle(),
    supabaseAdmin.from("user_roles").select("role").eq("user_id", userId),
  ]);
  if (profileError) fail(profileError.message);
  if (roleError) fail(roleError.message);
  if (!profile) fail("Seu perfil ainda não está ligado a um acesso.");
  if (profile.is_blocked) fail("Este acesso está bloqueado.");
  const role = (roles ?? []).some((row) => row.role === "master")
    ? "master"
    : (roles ?? []).some((row) => row.role === "client_admin")
      ? "client_admin"
      : (roles ?? []).some((row) => row.role === "client_user")
        ? "client_user"
        : null;
  if (!role) fail("Você não pode consultar o financeiro.");
  return { id: profile.id, role, organizationId: profile.organization_id, fullName: profile.full_name };
}

async function contractsOf(organizationId?: string) {
  let query = supabaseAdmin.from("contracts").select("id, organization_id, external_subscription_id, monthly_fee_cents, starts_on, ends_on");
  if (organizationId) query = query.eq("organization_id", organizationId);
  const { data, error } = await query;
  if (error) fail(error.message);
  return (data ?? []) as ContractRow[];
}

async function savePayment(contract: ContractRow, payment: AsaasPayment): Promise<"inserted" | "updated" | "skipped"> {
  if (!payment.id || !payment.dueDate || typeof payment.value !== "number") return "skipped";
  const due = payment.dueDate.slice(0, 10);
  const today = todayKey();
  const status = chargeStatus(payment.status ?? "", due, today);
  const base = typeof payment.originalValue === "number" ? payment.originalValue : payment.value;
  const paidOn = payment.clientPaymentDate || payment.paymentDate || null;
  const row = {
    organization_id: contract.organization_id,
    contract_id: contract.id,
    competence: competenceOf(due),
    due_date: due,
    base_amount_cents: centsFromReais(base),
    total_amount_cents: centsFromReais(payment.value),
    status,
    paid_at: status === "paid" ? (paidOn ? new Date(`${paidOn.slice(0, 10)}T12:00:00Z`).toISOString() : new Date().toISOString()) : null,
    external_charge_id: payment.id,
    invoice_url: payment.invoiceUrl || null,
    updated_at: new Date().toISOString(),
  };
  const { data: current, error: readError } = await supabaseAdmin.from("invoices").select("id, pix_code, status, base_amount_cents").eq("external_charge_id", payment.id).maybeSingle();
  if (readError) fail(readError.message);
  if (current) {
    if (current.status === "paid") return "updated";
    if (keepsNominalValue(current.pix_code)) {
      row.total_amount_cents = Number(current.base_amount_cents);
      if (nominalPaymentId(current.pix_code)) return "updated";
    }
    const { error } = await supabaseAdmin.from("invoices").update(row).eq("id", current.id);
    if (error) fail(error.message);
    return "updated";
  }
  const { error } = await supabaseAdmin.from("invoices").insert(row);
  if (!error) return "inserted";
  if (!/duplicate|unique|23505/i.test(error.message)) fail(error.message);
  const { data: sameMonth } = await supabaseAdmin.from("invoices").select("id, pix_code, status, base_amount_cents").eq("organization_id", contract.organization_id).eq("competence", row.competence).maybeSingle();
  if (sameMonth?.status === "paid" || nominalPaymentId(sameMonth?.pix_code ?? null)) return "skipped";
  if (sameMonth && keepsNominalValue(sameMonth.pix_code)) row.total_amount_cents = Number(sameMonth.base_amount_cents);
  const { error: updateError } = await supabaseAdmin.from("invoices").update(row).eq("organization_id", contract.organization_id).eq("competence", row.competence);
  if (updateError) return "skipped";
  return "updated";
}

async function audit(
  actorId: string,
  organizationId: string | null,
  action: string,
  entityId: string | null,
  details: { count?: number; clientName?: string; waiveFine?: boolean; waiveInterest?: boolean; competence?: string },
) {
  await supabaseAdmin.from("audit_logs").insert({
    organization_id: organizationId,
    actor_id: actorId,
    action,
    entity_type: "invoice",
    entity_id: entityId,
    details,
  });
}

export async function syncFinance(userId: string, organizationId?: string) {
  const actor = await actorOf(userId);
  const target = actor.role === "master" ? organizationId : actor.organizationId ?? undefined;
  if (actor.role !== "master" && !target) fail("Sua conta ainda não está ligada a uma empresa.");
  if (actor.role !== "master" && organizationId && organizationId !== actor.organizationId) fail("Você não pode sincronizar o financeiro deste cliente.");
  const contracts = await contractsOf(target);
  const linked = contracts.filter((contract) => contract.external_subscription_id);
  if (!asaasConfigured()) {
    return linked.length ? "O Asaas ainda não está configurado no servidor. As cobranças já gravadas continuam visíveis." : "Nenhum contrato integrado ao Asaas.";
  }
  if (!linked.length) return "Nenhum contrato integrado ao Asaas. A cobrança entra depois da integração.";
  let inserted = 0;
  let problem = "";
  for (const contract of linked) {
    try {
      const payments = await listSubscriptionPayments(contract.external_subscription_id ?? "");
      for (const payment of payments) {
        const saved = await savePayment(contract, payment);
        if (saved === "inserted") inserted += 1;
      }
    } catch (error) {
      if (!problem) problem = error instanceof Error ? error.message : "Não foi possível consultar o Asaas agora.";
    }
  }
  if (inserted > 0) {
    await audit(actor.id, target ?? null, "finance.sync", null, { count: inserted });
  }
  await settleNominalPayments(target);
  return problem;
}

const paidAsaas = new Set(["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH", "DUNNING_RECEIVED"]);

async function settleNominalPayments(organizationId?: string) {
  let query = supabaseAdmin
    .from("invoices")
    .select("id, organization_id, external_charge_id, pix_code, base_amount_cents, status")
    .like("pix_code", "nex-%")
    .in("status", ["pending", "overdue"]);
  if (organizationId) query = query.eq("organization_id", organizationId);
  const { data, error } = await query;
  if (error) fail(error.message);
  for (const invoice of data ?? []) {
    if (!keepsNominalValue(invoice.pix_code) || !invoice.external_charge_id) continue;
    const payableId = nominalPaymentId(invoice.pix_code) ?? invoice.external_charge_id;
    let payment: AsaasPayment;
    try {
      payment = await getPayment(payableId);
    } catch {
      continue;
    }
    if (!payment.status || !paidAsaas.has(payment.status)) continue;
    if (payableId !== invoice.external_charge_id) {
      try {
        await deletePayment(invoice.external_charge_id);
      } catch (deleteError) {
        console.error("asaas_delete_overdue", deleteError instanceof Error ? deleteError.message : "error");
      }
    }
    const paidOn = payment.clientPaymentDate || payment.paymentDate;
    await supabaseAdmin
      .from("invoices")
      .update({
        status: "paid",
        total_amount_cents: Number(invoice.base_amount_cents),
        paid_at: paidOn ? new Date(`${paidOn.slice(0, 10)}T12:00:00Z`).toISOString() : new Date().toISOString(),
        penalties_waived: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", invoice.id);
  }
}

async function invoicesOf(organizationId?: string) {
  let query = supabaseAdmin
    .from("invoices")
    .select("id, organization_id, competence, due_date, base_amount_cents, total_amount_cents, status, paid_at, invoice_url, external_charge_id")
    .order("due_date", { ascending: false });
  if (organizationId) query = query.eq("organization_id", organizationId);
  const { data, error } = await query;
  if (error) fail(error.message);
  return (data ?? []) as InvoiceRow[];
}

function toCharge(row: InvoiceRow, names: Map<string, string>): FinanceCharge {
  return {
    id: row.id,
    organizationId: row.organization_id,
    clientName: names.get(row.organization_id) ?? "Cliente",
    competence: row.competence,
    dueDate: row.due_date,
    totalCents: Number(row.total_amount_cents),
    baseCents: Number(row.base_amount_cents),
    status: row.status,
    paidAt: row.paid_at,
    invoiceUrl: row.invoice_url,
    canNegotiate: Boolean(row.external_charge_id) && row.status === "overdue",
  };
}

async function namesOf(ids: string[]) {
  if (!ids.length) return new Map<string, string>();
  const { data, error } = await supabaseAdmin.from("organizations").select("id, legal_name").in("id", ids);
  if (error) fail(error.message);
  return new Map((data ?? []).map((row) => [row.id, row.legal_name]));
}

async function auditOf(): Promise<FinanceAudit[]> {
  const { data, error } = await supabaseAdmin
    .from("audit_logs")
    .select("id, action, details, created_at, actor_id")
    .in("action", ["finance.sync", "finance.negotiate"])
    .order("created_at", { ascending: false })
    .limit(12);
  if (error) fail(error.message);
  const rows = data ?? [];
  const actorIds = [...new Set(rows.map((row) => row.actor_id))];
  const { data: profiles } = actorIds.length
    ? await supabaseAdmin.from("profiles").select("id, full_name").in("id", actorIds)
    : { data: [] };
  const names = new Map((profiles ?? []).map((row) => [row.id, row.full_name]));
  return rows.map((row) => {
    const details = (row.details ?? {}) as { clientName?: string; waiveFine?: boolean; waiveInterest?: boolean; count?: number };
    const removed = [details.waiveFine ? "multa" : "", details.waiveInterest ? "juros" : ""].filter(Boolean).join(" e ");
    const text = row.action === "finance.negotiate"
      ? `Removidos ${removed || "acréscimos"} da cobrança de ${details.clientName ?? "cliente"}.`
      : `${details.count ?? 0} cobrança(s) sincronizada(s) pelo Asaas.`;
    return { id: row.id, text, actorName: names.get(row.actor_id) ?? "Sistema", at: row.created_at };
  });
}

export async function listMasterFinance(userId: string): Promise<MasterFinance> {
  const actor = await actorOf(userId);
  if (actor.role !== "master") fail("Só o Master consulta o financeiro geral.");
  const notice = await syncFinance(userId);
  const rows = await invoicesOf();
  const names = await namesOf([...new Set(rows.map((row) => row.organization_id))]);
  const charges = rows.map((row) => toCharge(row, names));
  const month = todayKey().slice(0, 7);
  return {
    receivableCents: charges.filter((item) => item.status === "pending" || item.status === "overdue").reduce((sum, item) => sum + item.totalCents, 0),
    overdueCents: charges.filter((item) => item.status === "overdue").reduce((sum, item) => sum + item.totalCents, 0),
    receivedThisMonthCents: charges
      .filter((item) => item.status === "paid" && item.paidAt && monthKey(item.paidAt) === month)
      .reduce((sum, item) => sum + item.totalCents, 0),
    charges,
    audit: await auditOf(),
    notice,
  };
}

export async function listOwnFinance(userId: string): Promise<OwnFinance> {
  const actor = await actorOf(userId);
  if (!actor.organizationId) fail("Sua conta ainda não está ligada a uma empresa.");
  const notice = await syncFinance(userId, actor.organizationId);
  const [contracts, rows, names] = await Promise.all([
    contractsOf(actor.organizationId),
    invoicesOf(actor.organizationId),
    namesOf([actor.organizationId]),
  ]);
  const contract = contracts[0] ?? null;
  const charges = rows.map((row) => toCharge(row, names));
  const today = todayKey();
  const open = charges.find((item) => item.status === "overdue") ?? charges.find((item) => item.status === "pending") ?? null;
  const overdueDays = open?.status === "overdue" ? Math.max(daysPast(open.dueDate, today), 1) : 0;
  const situation = overdueDays > 0 ? "Em atraso" : open ? "Em aberto" : "Em dia";
  return {
    clientName: names.get(actor.organizationId) ?? actor.fullName,
    monthlyFeeCents: contract ? Number(contract.monthly_fee_cents) : null,
    startsOn: contract?.starts_on ?? null,
    endsOn: contract?.ends_on ?? null,
    situation,
    nextCents: open?.totalCents ?? contract?.monthly_fee_cents ?? null,
    nextDue: open?.dueDate ?? null,
    overdueDays,
    charges,
    openChargeId: open?.id ?? null,
    notice,
  };
}

export async function negotiateCharge(userId: string, input: { invoiceId: string; waiveFine: boolean; waiveInterest: boolean }) {
  const actor = await actorOf(userId);
  if (actor.role !== "master") fail("Só o Master negocia cobranças.");
  if (!input.waiveFine && !input.waiveInterest) fail("Escolha remover a multa, os juros ou os dois.");
  const { data: invoice, error } = await supabaseAdmin
    .from("invoices")
    .select("id, organization_id, competence, due_date, base_amount_cents, total_amount_cents, status, paid_at, invoice_url, external_charge_id, contract_id, pix_code")
    .eq("id", input.invoiceId)
    .maybeSingle();
  if (error) fail(error.message);
  if (!invoice) fail("Cobrança não encontrada.");
  if (invoice.status === "paid" || invoice.status === "cancelled") fail("Esta cobrança não pode mais ser negociada.");
  if (!invoice.external_charge_id) fail("Esta cobrança não está ligada ao Asaas.");
  const nominal = input.waiveFine && input.waiveInterest ? Number(invoice.base_amount_cents) / 100 : null;
  const payment = await waivePaymentPenalties(invoice.external_charge_id, { waiveFine: input.waiveFine, waiveInterest: input.waiveInterest, nominal });
  let pixCode: string | null = nominal != null ? nominalPaymentId(invoice.pix_code) ? invoice.pix_code : waivedOnCharge : null;
  if (nominal != null && !nominalPaymentId(invoice.pix_code)) {
    const refreshed = await getPayment(invoice.external_charge_id);
    if (penaltiesRemain(refreshed)) {
      if (!refreshed.customer) fail("A cobrança do Asaas não informa o cliente para gerar o Pix.");
      const created = await createNominalPix({
        customer: refreshed.customer,
        value: nominal,
        dueDate: todayKey(),
        description: `Mensalidade ${competenceLabel(invoice.competence)} sem multa e sem juros`,
        externalReference: `nex-${invoice.id}`,
      });
      if (!created.id) fail("O Asaas não devolveu o Pix do valor nominal.");
      pixCode = `nex-pay:${created.id}`;
    }
  }
  const names = await namesOf([invoice.organization_id]);
  const due = (payment.dueDate || invoice.due_date).slice(0, 10);
  const status = chargeStatus(payment.status ?? invoice.status, due, todayKey());
  const total = nominal != null ? Number(invoice.base_amount_cents) : typeof payment.value === "number" ? centsFromReais(payment.value) : Number(invoice.total_amount_cents);
  const { error: updateError } = await supabaseAdmin
    .from("invoices")
    .update({
      total_amount_cents: total,
      status,
      penalties_waived: true,
      ...(pixCode ? { pix_code: pixCode } : {}),
      invoice_url: payment.invoiceUrl || invoice.invoice_url,
      updated_at: new Date().toISOString(),
    })
    .eq("id", invoice.id);
  if (updateError) fail(updateError.message);
  await audit(actor.id, invoice.organization_id, "finance.negotiate", invoice.id, {
    clientName: names.get(invoice.organization_id) ?? "cliente",
    waiveFine: input.waiveFine,
    waiveInterest: input.waiveInterest,
    competence: invoice.competence,
  });
}

export async function chargePix(userId: string, invoiceId: string) {
  const actor = await actorOf(userId);
  if (actor.role !== "master" && !actor.organizationId) fail("Sua conta ainda não está ligada a uma empresa.");
  await settleNominalPayments(actor.role === "master" ? undefined : actor.organizationId ?? undefined);
  const { data: invoice, error } = await supabaseAdmin
    .from("invoices")
    .select("id, organization_id, competence, base_amount_cents, total_amount_cents, status, external_charge_id, invoice_url, pix_code")
    .eq("id", invoiceId)
    .maybeSingle();
  if (error) fail(error.message);
  if (!invoice) fail("Cobrança não encontrada.");
  if (actor.role !== "master" && invoice.organization_id !== actor.organizationId) fail("Você não pode abrir esta cobrança.");
  if (invoice.status === "paid" || invoice.status === "cancelled") fail("Esta cobrança não está em aberto.");
  let payableId = invoice.external_charge_id;
  let totalCents = Number(invoice.total_amount_cents);
  if (keepsNominalValue(invoice.pix_code)) {
    const replacement = nominalPaymentId(invoice.pix_code);
    if (replacement) payableId = replacement;
    else if (invoice.external_charge_id) {
      const current = await getPayment(invoice.external_charge_id);
      if (penaltiesRemain(current)) {
        if (!current.customer) fail("A cobrança do Asaas não informa o cliente para gerar o Pix.");
        const created = await createNominalPix({
          customer: current.customer,
          value: Number(invoice.base_amount_cents) / 100,
          dueDate: todayKey(),
          description: `Mensalidade ${competenceLabel(invoice.competence)} sem multa e sem juros`,
          externalReference: `nex-${invoice.id}`,
        });
        if (!created.id) fail("O Asaas não devolveu o Pix do valor nominal.");
        payableId = created.id;
        await supabaseAdmin.from("invoices").update({ pix_code: `nex-pay:${created.id}`, updated_at: new Date().toISOString() }).eq("id", invoice.id);
      }
    }
    totalCents = Number(invoice.base_amount_cents);
  }
  const pix = payableId ? await readPaymentPix(payableId) : null;
  if (!pix && !invoice.invoice_url) fail("O Asaas ainda não disponibilizou o Pix desta cobrança.");
  return { payload: pix?.payload ?? "", image: pix?.image ?? "", invoiceUrl: invoice.invoice_url, totalCents };
}
