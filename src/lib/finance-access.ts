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
  notice: string;
};

export type ChargePix = {
  payload: string;
  image: string;
  invoiceUrl: string | null;
  totalCents: number;
};

const paidStatuses = new Set(["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH", "DUNNING_RECEIVED"]);
const cancelledStatuses = new Set(["REFUNDED", "REFUND_REQUESTED", "REFUND_IN_PROGRESS", "CHARGEBACK_REQUESTED", "CHARGEBACK_DISPUTE", "AWAITING_CHARGEBACK_REVERSAL"]);

export function chargeStatus(asaasStatus: string, dueDate: string, today: string): InvoiceStatus {
  if (paidStatuses.has(asaasStatus)) return "paid";
  if (cancelledStatuses.has(asaasStatus)) return "cancelled";
  if (asaasStatus === "OVERDUE" || asaasStatus === "DUNNING_REQUESTED" || dueDate < today) return "overdue";
  return "pending";
}

export function centsFromReais(value: number) {
  return Math.round(value * 100);
}

export function competenceOf(dueDate: string) {
  return `${dueDate.slice(0, 7)}-01`;
}

export function todayKey(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function monthKey(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso.slice(0, 7);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit" }).format(date);
}

export function daysPast(dueDate: string, today: string) {
  const due = Date.parse(`${dueDate.slice(0, 10)}T00:00:00Z`);
  const current = Date.parse(`${today.slice(0, 10)}T00:00:00Z`);
  if (!Number.isFinite(due) || !Number.isFinite(current)) return 0;
  return Math.floor((current - due) / 86400000);
}

export function competenceLabel(iso: string) {
  const months = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  const [year, month] = iso.slice(0, 10).split("-");
  const name = months[Number(month) - 1];
  if (!year || !name) return iso;
  return `${name}/${year}`;
}

export function whenLabel(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });
}
