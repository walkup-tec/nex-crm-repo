import type { InvoiceStatus } from "@/lib/client-access";

export type FinanceCharge = {
  id: string;
  organizationId: string;
  clientName: string;
  competence: string;
  dueDate: string;
  totalCents: number;
  baseCents: number;
  status: InvoiceStatus;
  paidAt: string | null;
  invoiceUrl: string | null;
  canNegotiate: boolean;
};

export type FinanceAudit = {
  id: string;
  text: string;
  actorName: string;
  at: string;
};

export type MasterFinance = {
  receivableCents: number;
  overdueCents: number;
  receivedThisMonthCents: number;
  charges: FinanceCharge[];
  audit: FinanceAudit[];
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

export function chargeStatus(asaasStatus: string, dueDate: string, today: string): InvoiceStatus {
  if (paidStatuses.has(asaasStatus)) return "paid";
  if (cancelledStatuses.has(asaasStatus)) return "cancelled";
  if (asaasStatus === "OVERDUE" || asaasStatus === "DUNNING_REQUESTED" || dueDate < today)
    return "overdue";
  return "pending";
}

export function centsFromReais(value: number) {
  return Math.round(value * 100);
}

export function competenceOf(dueDate: string) {
  return `${dueDate.slice(0, 7)}-01`;
}

const localPaidCharge = {
  legalName: "MMS MARKETING E SISTEMAS DIGITAIS LTDA",
  competence: "2026-06-01",
  dueDate: "2026-06-27",
};

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

export type FinancePeriod = "all" | "past-week" | "next-week" | "past-month" | "current-month";

export function shiftDate(iso: string, days: number) {
  const date = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function financePeriodBounds(
  period: FinancePeriod,
  today = todayKey(),
): { start: string; end: string } | null {
  if (period === "all") return null;
  if (period === "past-week") return { start: shiftDate(today, -6), end: today };
  if (period === "next-week") return { start: today, end: shiftDate(today, 6) };
  const [yearText, monthText] = today.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  if (period === "current-month") {
    const end = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return {
      start: `${yearText}-${monthText}-01`,
      end: `${yearText}-${monthText}-${String(end).padStart(2, "0")}`,
    };
  }
  const startDate = new Date(Date.UTC(year, month - 2, 1));
  const endDate = new Date(Date.UTC(year, month - 1, 0));
  return { start: startDate.toISOString().slice(0, 10), end: endDate.toISOString().slice(0, 10) };
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

export function whenLabel(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  });
}
