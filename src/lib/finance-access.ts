import type { InvoiceStatus } from "@/lib/client-access";

export type FinanceCharge = {
  id: string;
  organizationId: string;
  clientName: string;
  clientDocument: string;
  competence: string;
  dueDate: string;
  totalCents: number;
  baseCents: number;
  status: InvoiceStatus;
  paidAt: string | null;
  invoiceUrl: string | null;
  pixCode: string | null;
  canNegotiate: boolean;
  canCancel: boolean;
  canChangeDue: boolean;
  canMarkPaid: boolean;
  billingProvider: "cora" | "asaas" | "manual" | "";
};

export function resolveChargeBillingProvider(input: {
  billingProvider: FinanceCharge["billingProvider"];
  externalChargeId: string | null;
}): FinanceCharge["billingProvider"] {
  if (String(input.externalChargeId ?? "").startsWith("manual:")) return "manual";
  return input.billingProvider;
}

export function chargeActionFlags(input: {
  status: InvoiceStatus;
  dueDate: string;
  today: string;
  billingProvider: FinanceCharge["billingProvider"];
  externalChargeId: string | null;
}) {
  const open = input.status !== "paid" && input.status !== "cancelled";
  const due = input.dueDate.slice(0, 10);
  const provider = resolveChargeBillingProvider(input);
  const manual = provider === "manual";
  const linked = Boolean(input.externalChargeId);
  const bankLinked = linked && !manual;
  return {
    canNegotiate: open && bankLinked && (input.status === "overdue" || due < input.today),
    canCancel: open && (bankLinked || manual),
    canChangeDue: open && (bankLinked || manual),
    canMarkPaid: open && manual,
  };
}

export function chargeMatchesClient(charge: { clientName: string; clientDocument: string }, query: string) {
  const text = query.trim().toLocaleLowerCase("pt-BR");
  if (!text) return true;
  if (charge.clientName.toLocaleLowerCase("pt-BR").includes(text)) return true;
  const digits = text.replace(/\D/g, "");
  if (!digits) return false;
  return charge.clientDocument.replace(/\D/g, "").includes(digits);
}

export function pixQrPayload(code: string | null) {
  const value = code?.trim() ?? "";
  return value.startsWith("000201") ? value : "";
}

export type FinanceMonitorId = "asaas" | "cora" | "asaas_sync" | "cora_sync";
export type FinanceMonitorProvider = "cora" | "asaas";

export type FinanceMonitorItem = {
  id: FinanceMonitorId;
  label: string;
  ok: boolean;
  detail: string;
};

export type FinanceMonitorGroup = {
  provider: FinanceMonitorProvider;
  label: string;
  items: FinanceMonitorItem[];
};

export function financeMonitorCaption(item: FinanceMonitorItem) {
  if (item.ok) return `${item.label} OK`;
  return item.detail ? `${item.label}: ${item.detail}` : item.label;
}

export function financeMonitorGroups(items: FinanceMonitorItem[]): FinanceMonitorGroup[] {
  const order: { provider: FinanceMonitorProvider; label: string }[] = [
    { provider: "cora", label: "Cora" },
    { provider: "asaas", label: "Asaas" },
  ];
  return order
    .map(({ provider, label }) => ({
      provider,
      label,
      items: items.filter((item) => item.id === provider || item.id === `${provider}_sync`),
    }))
    .filter((group) => group.items.length > 0);
}

export function asaasSyncMonitor(notice: string, integrationOk: boolean): Pick<FinanceMonitorItem, "ok" | "detail"> {
  if (!integrationOk) {
    if (/chave recusada|foi recusada/i.test(notice)) return { ok: false, detail: "chave recusada" };
    if (/não está configurado/i.test(notice)) return { ok: false, detail: "não configurado" };
    return { ok: false, detail: notice.trim() ? "falhou" : "indisponível" };
  }
  if (!notice.trim() || /Nenhum contrato integrado/i.test(notice)) return { ok: true, detail: "OK" };
  if (/foi recusada/i.test(notice)) return { ok: false, detail: "chave recusada" };
  return { ok: false, detail: "falhou" };
}

export type MasterFinance = {
  receivableCents: number;
  overdueCents: number;
  receivedThisMonthCents: number;
  charges: FinanceCharge[];
  monitor: FinanceMonitorItem[];
  notice: string;
};

export type OwnFinance = {
  clientName: string;
  monthlyFeeCents: number | null;
  startsOn: string | null;
  endsOn: string | null;
  situation: "Em dia" | "Em aberto" | "Em atraso";
  nextCents: number | null;
  nextDue: string | null;
  overdueDays: number;
  charges: FinanceCharge[];
  openChargeId: string | null;
  overdueChargeId: string | null;
  notice: string;
  billingProvider: "cora" | "asaas" | "manual" | "";
  clientDocument: string;
  adsMeta: boolean;
  adsGoogle: boolean;
  productHosting?: boolean;
  promoMonthlyCents: number | null;
  nominalMonthlyCents: number | null;
  promotions: { startsOn: string; endsOn: string; amountCents: number; nominalCents: number }[];
  delinquencyMode: "rate" | "amount" | "";
  finePercent: number;
  interestPercent: number;
  delinquencyAmountCents: number | null;
};

export type ChargePix = {
  payload: string;
  image: string;
  invoiceUrl: string | null;
  totalCents: number;
  nominal: boolean;
  fineCents: number;
  interestCents: number;
};

const paidStatuses = new Set(["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH", "DUNNING_RECEIVED"]);
const cancelledStatuses = new Set([
  "REFUNDED",
  "REFUND_REQUESTED",
  "REFUND_IN_PROGRESS",
  "CHARGEBACK_REQUESTED",
  "CHARGEBACK_DISPUTE",
  "AWAITING_CHARGEBACK_REVERSAL",
]);

export function unpaidChargeBlocksClient(status: InvoiceStatus, dueDate: string, today: string) {
  if (status === "paid" || status === "cancelled") return false;
  if (status === "overdue") return true;
  return status === "pending" && dueDate.slice(0, 10) < today;
}

export function chargeStatus(asaasStatus: string, dueDate: string, today: string): InvoiceStatus {
  if (paidStatuses.has(asaasStatus)) return "paid";
  if (cancelledStatuses.has(asaasStatus)) return "cancelled";
  if (asaasStatus === "OVERDUE" || asaasStatus === "DUNNING_REQUESTED" || dueDate < today)
    return "overdue";
  return "pending";
}

/** Status local a partir da cobrança Cora (OPEN/LATE/PAID/CANCELLED). */
export function coraChargeStatus(remoteStatus: string, dueDate: string, today: string): InvoiceStatus {
  const status = remoteStatus.trim().toUpperCase();
  if (status === "PAID") return "paid";
  if (status === "CANCELLED" || status === "CANCELED") return "cancelled";
  if (status === "LATE" || dueDate.slice(0, 10) < today) return "overdue";
  return "pending";
}

/** Só IDs reais da Cora entram no sync de pagamento (ignora manual:/asaas). */
export function isCoraInvoiceId(externalChargeId: string | null | undefined) {
  return String(externalChargeId ?? "").startsWith("inv_");
}

/**
 * Limita consultas à Cora às parcelas próximas do vencimento.
 * Parcelas futuras longe geram 429 e marcam "Cobranças: falhou" sem necessidade.
 */
export function coraSyncInvoiceEligible(input: {
  externalChargeId: string | null | undefined;
  dueDate: string;
  today: string;
  horizonDays?: number;
}) {
  if (!isCoraInvoiceId(input.externalChargeId)) return false;
  const due = input.dueDate.slice(0, 10);
  const today = input.today.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(due) || !/^\d{4}-\d{2}-\d{2}$/.test(today)) return false;
  const horizonDays = input.horizonDays ?? 14;
  const date = new Date(`${today}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + horizonDays);
  const horizon = date.toISOString().slice(0, 10);
  return due <= horizon;
}

export function coraPaidAtIso(paidAt: string | null | undefined, fallback = new Date().toISOString()) {
  const raw = String(paidAt ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return `${raw}T15:00:00.000Z`;
  if (raw && Number.isFinite(Date.parse(raw))) return new Date(raw).toISOString();
  return fallback;
}

export function centsFromReais(value: number) {
  return Math.round(value * 100);
}

export function competenceOf(dueDate: string) {
  return `${dueDate.slice(0, 7)}-01`;
}

/** Inclui no Master Financeiro qualquer CPF/CNPJ real. Não usar allowlist de teste. */
export function countsInMasterFinance(document: string) {
  const digits = document.replace(/\D/g, "");
  if (!(digits.length === 11 || digits.length === 14)) return false;
  // Walkup (testes internos) — não listar no financeiro Master.
  if (digits === "50248188000160") return false;
  return true;
}

export function excludedFromMasterFinance(client: {
  clientName?: string;
  clientDocument?: string;
  legalName?: string;
}) {
  const document = client.clientDocument ?? "";
  if (document && !countsInMasterFinance(document)) return true;
  const name = client.clientName ?? client.legalName ?? "";
  return matchesInternalDashboardName(name) && /WALKUP/i.test(name);
}

const localPaidCharge = {
  legalName: "MMS MARKETING E SISTEMAS DIGITAIS LTDA",
  competence: "2026-06-01",
  dueDate: "2026-06-27",
};

const droppedCharge = {
  legalName: "MMS MARKETING E SISTEMAS DIGITAIS LTDA",
  competence: "2026-10-01",
  dueDate: "2026-10-27",
  totalCents: 140000,
};

export function dropsLocalCharge(input: {
  legalName: string;
  competence: string;
  dueDate: string;
  totalCents: number;
}) {
  return (
    input.legalName.trim().toLocaleUpperCase("pt-BR") === droppedCharge.legalName &&
    input.competence.slice(0, 10) === droppedCharge.competence &&
    input.dueDate.slice(0, 10) === droppedCharge.dueDate &&
    input.totalCents === droppedCharge.totalCents
  );
}

export function keepsAccessWithoutPayment(legalName: string) {
  return legalName.trim().toLocaleUpperCase("pt-BR") === "MMS MARKETING E SISTEMAS DIGITAIS LTDA";
}

const internalDashboardNames = [
  "MMS MARKETING E SISTEMAS DIGITAIS LTDA",
  "MMS",
  "WALKUP TECNOLOGIA E SISTEMAS LTDA",
  "WALKUP SISTEMAS E INTELIGENCIA LTDA",
  "WALKUP",
];

function normalizedOrgLabel(value: string) {
  return value.trim().toLocaleUpperCase("pt-BR").replace(/\s+/g, " ");
}

function matchesInternalDashboardName(value: string) {
  const label = normalizedOrgLabel(value);
  if (!label) return false;
  if (internalDashboardNames.includes(label)) return true;
  return (
    label.startsWith("MMS MARKETING") ||
    label.startsWith("WALKUP TECNOLOGIA") ||
    label.startsWith("WALKUP SISTEMAS")
  );
}

/** Contas internas (MMS / Walkup) — fora de qualquer indicador do dashboard Master. */
export function excludedFromMasterDashboard(client: { legalName: string; commercialName?: string | null }) {
  return matchesInternalDashboardName(client.legalName) || matchesInternalDashboardName(client.commercialName ?? "");
}

export function preservesLocalPayment(input: {
  legalName: string;
  competence: string;
  dueDate: string;
}) {
  return (
    input.legalName.trim().toLocaleUpperCase("pt-BR") === localPaidCharge.legalName &&
    input.competence.slice(0, 10) === localPaidCharge.competence &&
    input.dueDate.slice(0, 10) === localPaidCharge.dueDate
  );
}

export function todayKey(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function shiftDate(iso: string, days: number) {
  const date = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function chargeInPeriod(dueDate: string, bounds: { start: string; end: string } | null) {
  if (!bounds) return true;
  const due = dueDate.slice(0, 10);
  return due >= bounds.start && due <= bounds.end;
}

export function dailyChargeTotals(
  charges: { dueDate: string; totalCents: number; status: string }[],
  bounds: { start: string; end: string } | null,
) {
  const rows = charges.filter(
    (item) => item.status !== "cancelled" && chargeInPeriod(item.dueDate, bounds),
  );
  const start =
    bounds?.start ??
    rows.reduce(
      (min, item) => (item.dueDate.slice(0, 10) < min ? item.dueDate.slice(0, 10) : min),
      rows[0]?.dueDate.slice(0, 10) ?? "",
    );
  const end =
    bounds?.end ??
    rows.reduce(
      (max, item) => (item.dueDate.slice(0, 10) > max ? item.dueDate.slice(0, 10) : max),
      rows[0]?.dueDate.slice(0, 10) ?? "",
    );
  if (!start || !end) return [];
  const totals = new Map<string, number>();
  for (const item of rows) {
    const due = item.dueDate.slice(0, 10);
    totals.set(due, (totals.get(due) ?? 0) + item.totalCents);
  }
  const days: { day: string; label: string; totalCents: number }[] = [];
  let cursor = start;
  while (cursor <= end && days.length < 400) {
    days.push({
      day: cursor,
      label: `${cursor.slice(8, 10)}/${cursor.slice(5, 7)}`,
      totalCents: totals.get(cursor) ?? 0,
    });
    cursor = shiftDate(cursor, 1);
  }
  return days;
}

export function monthKey(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso.slice(0, 7);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
  }).format(date);
}

export function daysPast(dueDate: string, today: string) {
  const due = Date.parse(`${dueDate.slice(0, 10)}T00:00:00Z`);
  const current = Date.parse(`${today.slice(0, 10)}T00:00:00Z`);
  if (!Number.isFinite(due) || !Number.isFinite(current)) return 0;
  return Math.floor((current - due) / 86400000);
}

export function competenceLabel(iso: string) {
  const months = [
    "janeiro",
    "fevereiro",
    "março",
    "abril",
    "maio",
    "junho",
    "julho",
    "agosto",
    "setembro",
    "outubro",
    "novembro",
    "dezembro",
  ];
  const [year, month] = iso.slice(0, 10).split("-");
  const name = months[Number(month) - 1];
  if (!year || !name) return iso;
  return `${name}/${year}`;
}

export const waivedOnCharge = "nex-waived";
export const nominalPayPrefix = "nex-pay:";

export function replacementPayment(
  pixCode: string | null,
): { id: string; cents: number | null } | null {
  if (!pixCode) return null;
  if (pixCode.startsWith(nominalPayPrefix)) {
    const id = pixCode.slice(nominalPayPrefix.length);
    return /^[A-Za-z0-9_]{1,64}$/.test(id) ? { id, cents: null } : null;
  }
  const calculated = /^nex-calc:([A-Za-z0-9_]{1,64}):(\d{1,12})$/.exec(pixCode);
  const id = calculated?.[1];
  const cents = calculated?.[2];
  if (!id || !cents) return null;
  return { id, cents: Number(cents) };
}

export function nominalPaymentId(pixCode: string | null) {
  const replacement = replacementPayment(pixCode);
  if (!replacement || replacement.cents != null) return null;
  return replacement.id;
}

export function keepsNominalValue(pixCode: string | null) {
  return pixCode === waivedOnCharge || nominalPaymentId(pixCode) !== null;
}

export function chargeQuote(input: {
  baseCents: number;
  daysLate: number;
  penaltiesWaived: boolean;
  paymentFine?: { value?: number; type?: string } | null;
  paymentInterest?: { value?: number } | null;
  contractFinePercent: number;
  contractInterestPercent: number;
}) {
  const days = Math.max(0, Math.floor(input.daysLate));
  const fineWaived = input.penaltiesWaived && (input.paymentFine?.value ?? 0) <= 0;
  const interestWaived = input.penaltiesWaived && (input.paymentInterest?.value ?? 0) <= 0;
  let fineCents = 0;
  let interestCents = 0;
  if (days > 0 && !fineWaived) {
    const value = input.paymentFine?.value;
    if (
      input.contractFinePercent <= 0 &&
      input.paymentFine?.type === "FIXED" &&
      typeof value === "number" &&
      value > 0
    ) {
      fineCents = centsFromReais(value);
    } else {
      const percent =
        input.contractFinePercent > 0
          ? input.contractFinePercent
          : typeof value === "number" && value > 0
            ? value
            : 0;
      fineCents = Math.round((input.baseCents * percent) / 100);
    }
  }
  if (days > 0 && !interestWaived) {
    const value = input.paymentInterest?.value;
    const percent =
      input.contractInterestPercent > 0
        ? input.contractInterestPercent
        : typeof value === "number" && value > 0
          ? value
          : 0;
    interestCents = Math.round((input.baseCents * percent * days) / 3000);
  }
  const totalCents = input.baseCents + fineCents + interestCents;
  return { fineCents, interestCents, totalCents, nominal: totalCents === input.baseCents };
}

export function penaltiesRemain(payment: {
  fine?: { value?: number } | null;
  interest?: { value?: number } | null;
  interestValue?: number | null;
}) {
  return (
    (payment.fine?.value ?? 0) > 0 ||
    (payment.interest?.value ?? 0) > 0 ||
    (payment.interestValue ?? 0) > 0.009
  );
}
