import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { BillingNoticeKind } from "@/lib/billing-plan";
import {
  billingNoticeText,
  billingToday,
  judgeNotice,
  noticeWindowOpen,
} from "@/lib/billing-notice";
import { pixQrPayload } from "@/lib/finance-access";
import { readCoraInvoice } from "@/server/cora.server";
import { probeFinanceEvolution, sendFinanceWhatsapp } from "@/server/evo.server";

const kinds = new Set<BillingNoticeKind>(["before_7", "before_3", "due", "after_1", "after_3", "after_5"]);
let running = false;
let started = false;
let schemaWarned = false;
let financeSendSucceeded = false;

type NoticeRow = {
  id: string;
  organization_id: string;
  due_date: string;
  kind: string;
  send_on: string;
  status: string;
  claimed_at?: string | null;
};

export function startBillingNoticeRunner() {
  if (started) return;
  started = true;
  void probeFinanceEvolution().catch(() => null);
  const tick = () => {
    if (shuttingDown()) return;
    void runBillingNotices().catch((error: unknown) => {
      console.error("billing_notices", error instanceof Error ? error.message : "falha");
    });
  };
  setTimeout(tick, 10_000).unref();
  setInterval(tick, 15 * 60_000).unref();
}

export async function stopOpenBillingNotices(organizationId: string, dueDate: string, reason: string) {
  // O pagamento encerra a régua desta parcela. As próximas cobranças já emitidas permanecem no valor original.
  const { error } = await supabaseAdmin
    .from("billing_notices")
    .update({ status: "skipped", error: reason })
    .eq("organization_id", organizationId)
    .eq("due_date", dueDate.slice(0, 10))
    .eq("status", "pending");
  if (error && !schemaGap(error.message)) throw new Error(error.message);
}

export async function runBillingNotices(now = new Date()) {
  if (running || !noticeWindowOpen(now)) return;
  running = true;
  try {
    await releaseStaleClaims(now);
    const today = billingToday(now);
    await reopenRefusedNotice(today);
    const { data, error } = await supabaseAdmin
      .from("billing_notices")
      .select("id, organization_id, due_date, kind, send_on, status")
      .eq("status", "pending")
      .lte("send_on", today);
    if (error) {
      warnSchema(error.message);
      return;
    }
    for (const notice of data ?? []) {
      if (shuttingDown()) return;
      try {
        await deliverNotice(notice, today);
      } catch (error) {
        console.error("billing_notices", error instanceof Error ? error.message : "falha");
      }
    }
  } finally {
    running = false;
  }
}

async function deliverNotice(notice: NoticeRow, today: string) {
  if (!kinds.has(notice.kind as BillingNoticeKind)) return;
  const kind = notice.kind as BillingNoticeKind;
  const context = await noticeContext(notice.organization_id, notice.due_date);
  if (!context.externalChargeId) {
    await finishNotice(notice.id, { status: "skipped", error: "Sem cobrança Cora para esta parcela." });
    return;
  }
  const verdict = judgeNotice({
    kind,
    sendOn: notice.send_on.slice(0, 10),
    today,
    status: "pending",
    coraStatus: context.localStatus === "paid" ? "PAID" : context.localStatus === "cancelled" ? "CANCELLED" : "OPEN",
    legalName: context.legalName,
    financePhone: context.financePhone,
    pixCode: context.pixCode,
    faceCents: context.faceCents,
    delinquencyCents: context.delinquencyCents,
    localStatus: context.localStatus,
  });
  if (verdict.type === "wait") return;
  if (verdict.type === "skip") {
    await finishNotice(notice.id, { status: "skipped", error: verdict.reason });
    if (verdict.stopSeries) await stopOpenBillingNotices(notice.organization_id, notice.due_date, verdict.reason);
    return;
  }
  if (!(await claimNotice(notice.id, context.invoiceId))) return;
  let remote = "OPEN";
  try {
    if (!context.externalChargeId) throw new Error("Cobrança sem identificador na Cora.");
    remote = (await readCoraInvoice(context.externalChargeId)).status;
  } catch (error) {
    await finishNotice(notice.id, {
      status: "pending",
      error: safeError(error),
    });
    return;
  }
  const confirmed = judgeNotice({
    kind,
    sendOn: notice.send_on.slice(0, 10),
    today,
    status: "pending",
    coraStatus: remote,
    legalName: context.legalName,
    financePhone: context.financePhone,
    pixCode: context.pixCode,
    faceCents: context.faceCents,
    delinquencyCents: context.delinquencyCents,
    localStatus: context.localStatus,
  });
  if (confirmed.type === "skip") {
    await finishNotice(notice.id, { status: "skipped", error: confirmed.reason });
    if (confirmed.stopSeries) await stopOpenBillingNotices(notice.organization_id, notice.due_date, confirmed.reason);
    return;
  }
  if (confirmed.type !== "send") {
    await finishNotice(notice.id, { status: "pending", error: confirmed.reason });
    return;
  }
  const pixCode = pixQrPayload(context.pixCode);
  const text = billingNoticeText(kind, {
    name: context.legalName,
    due: notice.due_date,
    faceCents: confirmed.faceCents,
    updatedCents: confirmed.updatedCents,
    pixCode,
  });
  try {
    const { renderChargeCardPng } = await import("@/server/charge-card.server");
    const image = await renderChargeCardPng({
      clientName: context.legalName,
      totalCents: confirmed.faceCents,
      dueDate: notice.due_date.slice(0, 10),
      pixPayload: pixCode,
      adsMeta: context.adsMeta,
      adsGoogle: context.adsGoogle,
      delinquencyAmountCents: context.delinquencyCents,
      promotions: context.promotions,
      promoMonthlyCents: context.promoMonthlyCents,
      nominalMonthlyCents: context.nominalMonthlyCents,
    });
    const sent = await sendFinanceWhatsapp({ phone: context.financePhone, text, imagePng: image });
    if (!sent.ok) {
      const retryLater = sent.error === "Nenhuma instância do WhatsApp financeiro está conectada.";
      await finishNotice(notice.id, {
        status: retryLater ? "pending" : "failed",
        error: sent.error || "O WhatsApp não confirmou a mensagem.",
        body: text,
        channel: "whatsapp",
      });
      return;
    }
    financeSendSucceeded = true;
    await finishNotice(notice.id, {
      status: "sent",
      body: text,
      channel: "whatsapp",
      provider_message_id: sent.messageId,
      error: sent.error || null,
      sent_at: new Date().toISOString(),
    });
  } catch (error) {
    await finishNotice(notice.id, {
      status: "pending",
      error: safeError(error),
      body: text,
    });
  }
}

async function reopenRefusedNotice(today: string) {
  if (financeSendSucceeded) return;
  const { data, error } = await supabaseAdmin
    .from("billing_notices")
    .select("id, organization_id")
    .eq("status", "failed")
    .eq("error", "O WhatsApp não confirmou a mensagem.")
    .eq("send_on", today)
    .order("created_at", { ascending: true })
    .limit(1);
  if (error || !data?.[0]) {
    if (error) warnSchema(error.message);
    return;
  }
  const pending = await supabaseAdmin
    .from("billing_notices")
    .select("id")
    .eq("organization_id", data[0].organization_id)
    .eq("status", "pending")
    .eq("send_on", today)
    .limit(1);
  if (pending.error) {
    warnSchema(pending.error.message);
    return;
  }
  if (pending.data?.length) return;
  const { error: updateError } = await supabaseAdmin
    .from("billing_notices")
    .update({ status: "pending", error: null, claimed_at: null })
    .eq("id", data[0].id)
    .eq("status", "failed");
  if (updateError) warnSchema(updateError.message);
}

async function noticeContext(organizationId: string, dueDate: string) {
  const due = dueDate.slice(0, 10);
  const [organization, invoices, contract, promotions] = await Promise.all([
    supabaseAdmin
      .from("organizations")
      .select("legal_name, finance_phone, ads_meta, ads_google")
      .eq("id", organizationId)
      .maybeSingle(),
    supabaseAdmin
      .from("invoices")
      .select("id, status, external_charge_id, pix_code, base_amount_cents, total_amount_cents, updated_at")
      .eq("organization_id", organizationId)
      .eq("due_date", due),
    supabaseAdmin
      .from("contracts")
      .select("delinquency_amount_cents, monthly_fee_cents, after_promo_cents, promo_enabled, promo_starts_on, promo_ends_on")
      .eq("organization_id", organizationId)
      .limit(1),
    supabaseAdmin
      .from("client_promotions")
      .select("starts_on, ends_on, amount_cents, nominal_cents")
      .eq("organization_id", organizationId)
      .order("starts_on"),
  ]);
  if (organization.error) fail(organization.error.message);
  if (invoices.error) fail(invoices.error.message);
  if (contract.error) fail(contract.error.message);
  const promoRows =
    promotions.error && /client_promotions|schema cache|does not exist/i.test(promotions.error.message)
      ? []
      : (promotions.data ?? []);
  if (promotions.error && promoRows.length === 0 && !/client_promotions|schema cache|does not exist/i.test(promotions.error.message)) {
    fail(promotions.error.message);
  }
  const invoice = pickInvoice(invoices.data ?? []);
  const deal = contract.data?.[0] ?? null;
  const face = Number(invoice?.base_amount_cents ?? invoice?.total_amount_cents ?? 0);
  return {
    legalName: organization.data?.legal_name ?? "",
    financePhone: organization.data?.finance_phone ?? "",
    adsMeta: organization.data?.ads_meta !== false,
    adsGoogle: organization.data?.ads_google === true,
    invoiceId: invoice?.id ?? null,
    externalChargeId: invoice?.external_charge_id ?? "",
    pixCode: invoice?.pix_code ?? "",
    faceCents: face,
    localStatus: invoice?.status ?? "",
    delinquencyCents: deal?.delinquency_amount_cents == null ? null : Number(deal.delinquency_amount_cents),
    promoMonthlyCents: deal?.promo_enabled ? Number(deal.monthly_fee_cents) : null,
    nominalMonthlyCents: deal?.after_promo_cents == null ? null : Number(deal.after_promo_cents),
    promotions: promoRows.map((row) => ({
      startsOn: String(row.starts_on).slice(0, 10),
      endsOn: String(row.ends_on).slice(0, 10),
      amountCents: Number(row.amount_cents),
      nominalCents: Number(row.nominal_cents),
    })),
  };
}

function pickInvoice(
  rows: {
    id: string;
    status: string;
    external_charge_id: string | null;
    pix_code: string | null;
    base_amount_cents: number;
    total_amount_cents: number;
    updated_at: string;
  }[],
) {
  const cora = rows.filter((row) => (row.external_charge_id ?? "").startsWith("inv_"));
  const open = cora.filter((row) => row.status === "pending" || row.status === "overdue");
  const pool = open.length > 0 ? open : cora;
  return [...pool].sort((left, right) => right.updated_at.localeCompare(left.updated_at))[0] ?? null;
}

async function claimNotice(id: string, invoiceId: string | null) {
  const { data, error } = await supabaseAdmin
    .from("billing_notices")
    .update({
      status: "sending",
      claimed_at: new Date().toISOString(),
      ...(invoiceId ? { invoice_id: invoiceId } : {}),
    })
    .eq("id", id)
    .eq("status", "pending")
    .select("id");
  if (error) {
    warnSchema(error.message);
    return false;
  }
  return (data ?? []).length === 1;
}

async function finishNotice(
  id: string,
  patch: {
    status: string;
    error?: string | null;
    body?: string;
    channel?: string;
    provider_message_id?: string;
    sent_at?: string;
  },
) {
  const { error } = await supabaseAdmin.from("billing_notices").update(patch).eq("id", id);
  if (error) warnSchema(error.message);
}

async function releaseStaleClaims(now: Date) {
  const { data, error } = await supabaseAdmin
    .from("billing_notices")
    .select("id, claimed_at, provider_message_id")
    .eq("status", "sending");
  if (error) {
    warnSchema(error.message);
    return;
  }
  const limit = now.getTime() - 2 * 60 * 60 * 1000;
  for (const row of data ?? []) {
    if (row.provider_message_id) continue;
    const claimed = row.claimed_at ? new Date(row.claimed_at).getTime() : 0;
    if (claimed && claimed > limit) continue;
    await finishNotice(row.id, { status: "failed", error: "Envio sem confirmação." });
  }
}

function fail(message: string): never {
  if (schemaGap(message)) warnSchema(message);
  throw new Error(message);
}

function warnSchema(message: string) {
  if (!schemaGap(message)) {
    console.error("billing_notices", message);
    return;
  }
  if (schemaWarned) return;
  schemaWarned = true;
  console.error("billing_notices", "A régua financeira precisa da migração 0040.");
}

function schemaGap(message: string) {
  return /claimed_at|invoice_id|provider_message_id|schema cache|does not exist|billing_notices_status_check|check constraint/i.test(
    message,
  );
}

function shuttingDown() {
  return (globalThis as { __NEX_SHUTTING_DOWN?: boolean }).__NEX_SHUTTING_DOWN === true;
}

function safeError(error: unknown) {
  const message = error instanceof Error ? error.message : "Falha ao preparar a cobrança.";
  return message.replace(/bearer\s+\S+/gi, "bearer").slice(0, 240);
}
