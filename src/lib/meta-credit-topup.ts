export type CreditTopup = {
  cents: number;
  at: string;
};

export type CreditTopupLedger = {
  manualCredit: true;
  creditedCents: number;
  creditedAt: string;
  entries: [];
};

export function availableFromRegisteredCredit(creditedCents: number, spentCents: number) {
  if (!Number.isInteger(creditedCents) || creditedCents <= 0) return null;
  const spent = Number.isInteger(spentCents) && spentCents > 0 ? spentCents : 0;
  return Math.max(0, creditedCents - spent);
}

export function readCreditTopup(ledger: unknown): CreditTopup | null {
  if (!ledger || typeof ledger !== "object" || Array.isArray(ledger)) return null;
  const record = ledger as Record<string, unknown>;
  const cents = record.creditedCents;
  const at = record.creditedAt;
  if (typeof cents !== "number" || !Number.isInteger(cents) || cents <= 0) return null;
  if (typeof at !== "string" || !at.trim() || Number.isNaN(Date.parse(at))) return null;
  return { cents, at };
}

export function creditTopupLedger(cents: number, at = new Date().toISOString()): CreditTopupLedger {
  if (!Number.isInteger(cents) || cents <= 0) {
    throw new Error("Informe um valor de crédito válido.");
  }
  return {
    manualCredit: true,
    creditedCents: cents,
    creditedAt: at,
    entries: [],
  };
}

export function hasRegisteredCreditTopup(ledger: unknown) {
  return readCreditTopup(ledger) != null;
}

/** Fallback when meta_accounts.prepaid_ledger is missing in production. */
const prepaidSyncPattern = /^prepaid:(\d+):(.+)$/;

export function encodePrepaidSyncStatus(cents: number, at: string) {
  if (!Number.isInteger(cents) || cents <= 0) {
    throw new Error("Informe um valor de crédito válido.");
  }
  if (!at.trim() || Number.isNaN(Date.parse(at))) {
    throw new Error("Informe a data da recarga.");
  }
  return `prepaid:${cents}:${at}`;
}

export function readPrepaidSyncStatus(syncStatus: unknown): CreditTopup | null {
  if (typeof syncStatus !== "string") return null;
  const match = prepaidSyncPattern.exec(syncStatus.trim());
  if (!match) return null;
  const cents = Number(match[1]);
  const at = match[2] ?? "";
  if (!Number.isInteger(cents) || cents <= 0) return null;
  if (!at.trim() || Number.isNaN(Date.parse(at))) return null;
  return { cents, at };
}

export function resolveCreditTopup(ledger: unknown, syncStatus: unknown = null) {
  return readCreditTopup(ledger) ?? readPrepaidSyncStatus(syncStatus);
}

export function insightSpendToCents(spend: unknown) {
  if (typeof spend === "number") {
    if (!Number.isFinite(spend) || spend < 0) return 0;
    return Math.round(spend * 100);
  }
  if (typeof spend !== "string") return 0;
  const raw = spend.trim();
  if (!raw) return 0;
  const parsed = Number(raw.replace(",", "."));
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.round(parsed * 100);
}

export function topupSinceDate(at: string, timeZone = "America/Sao_Paulo") {
  const parsed = Date.parse(at);
  if (!Number.isFinite(parsed)) return null;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(parsed));
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  if (!year || !month || !day) return null;
  return `${year}-${month}-${day}`;
}

export function todayDate(timeZone = "America/Sao_Paulo", now = Date.now()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(now));
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  if (!year || !month || !day) return null;
  return `${year}-${month}-${day}`;
}

export function metaCreditAlertState(input: {
  topup: CreditTopup | null;
  availableCents: number | null;
  paymentError: boolean;
  lowLimitCents?: number;
}) {
  const limit = input.lowLimitCents ?? 5000;
  const missingTopup = input.topup == null;
  const balanceLow =
    !missingTopup &&
    typeof input.availableCents === "number" &&
    Number.isFinite(input.availableCents) &&
    input.availableCents <= limit;
  const paymentError = input.paymentError === true;
  return {
    missingTopup,
    balanceLow,
    paymentError,
    low: missingTopup || balanceLow || paymentError,
  };
}
