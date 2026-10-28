export type BalanceKind = "available" | "due" | "prepaid" | "unknown";

export type MetaCreditPix = {
  payload: string;
  image: string;
};

export type MetaCreditView = {
  accountName: string | null;
  accountId: string | null;
  currency: string;
  balanceCents: number | null;
  balanceKind: BalanceKind;
  chargeCents: number | null;
  thresholdCents: number | null;
  canAdd: boolean;
  canDebug: boolean;
  syncedAt: string | null;
  prepay: boolean | null;
  balanceUrl: string | null;
};

export type FundingSource = {
  type?: number | string;
  amount?: string | number | null;
  display_amount?: string | number | null;
  display_string?: string;
  coupons?: { amount?: string | number | null }[] | null;
};

const storedBalance = 20;

function offsetCents(value: string | number | null | undefined) {
  if (value == null || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.round(parsed);
}

function centsFromDisplay(value: string | number | null | undefined) {
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value <= 0) return null;
    return Number.isInteger(value) ? Math.round(value) : Math.round(value * 100);
  }
  if (typeof value !== "string") return null;
  const cleaned = value.trim().replace(/[^\d,.-]/g, "");
  if (!cleaned || !/\d/.test(cleaned)) return null;
  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");
  const decimalAt = Math.max(lastComma, lastDot);
  const decimal = decimalAt >= 0 ? cleaned.slice(decimalAt + 1) : "";
  const major =
    decimalAt >= 0 && decimal.length > 0 && decimal.length <= 2
      ? `${cleaned.slice(0, decimalAt).replace(/[^\d-]/g, "")}.${decimal}`
      : cleaned.replace(/[^\d-]/g, "");
  const parsed = Number(major);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.round(parsed * 100);
}

function storedSourceCents(source: FundingSource) {
  if (Number(source.type) !== storedBalance) return null;
  const amount = offsetCents(source.amount);
  if (amount != null && amount > 0) return amount;
  return centsFromDisplay(source.display_amount);
}

export function availableBalanceCents(
  funding: FundingSource | FundingSource[] | null | undefined,
): number | null {
  const sources = Array.isArray(funding) ? funding : funding ? [funding] : [];
  let total = 0;
  let found = false;
  for (const source of sources) {
    const stored = storedSourceCents(source);
    if (stored != null) {
      total += stored;
      found = true;
    }
    for (const coupon of source.coupons ?? []) {
      const cents = offsetCents(coupon.amount);
      if (cents != null && cents > 0) {
        total += cents;
        found = true;
      }
    }
  }
  return found ? total : null;
}

export function remainingSpendCents(
  spendCap: string | number | null | undefined,
  amountSpent: string | number | null | undefined,
): number | null {
  const cap = offsetCents(spendCap);
  const spent = offsetCents(amountSpent);
  if (cap == null || cap === 0 || spent == null) return null;
  return Math.max(0, cap - spent);
}

// spend_cap is the account spending limit. It is not the balance shown for the
// ad account. The card uses the stored balance Meta returns, or the bill amount.
export function spendCapBalance(input: {
  balance?: string | number | null;
  spendCap?: string | number | null;
  amountSpent?: string | number | null;
  isPrepay?: boolean | null;
}): { cents: number; kind: "available" } | null {
  const remaining = remainingSpendCents(input.spendCap, input.amountSpent);
  if (remaining == null) return null;
  const due = offsetCents(input.balance);
  const hasOpenDue = due != null && due > 0;
  if (hasOpenDue && input.isPrepay !== true) return null;
  return { cents: remaining, kind: "available" };
}

export function balanceFromAccount(input: {
  balance?: string | number | null;
  funding?: FundingSource | FundingSource[] | null;
}): { cents: number | null; kind: BalanceKind } {
  const available = availableBalanceCents(input.funding);
  if (available != null) return { cents: available, kind: "available" };
  const due = offsetCents(input.balance);
  if (due != null) return { cents: due, kind: "due" };
  return { cents: null, kind: "unknown" };
}

export function moneyCents(value: unknown): number | null {
  if (typeof value === "number" || typeof value === "string") return offsetOrDisplay(value);
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const offset = offsetOrDisplay(
    record.amount_in_hundredths ?? record.offsetted_amount ?? record.offset_amount,
  );
  if (offset != null) return offset;
  return offsetOrDisplay(record.amount);
}

function offsetOrDisplay(value: unknown) {
  if (typeof value === "number") return offsetCents(value);
  if (typeof value !== "string") return null;
  const raw = value.trim();
  if (!raw) return null;
  if (/^\d+$/.test(raw)) return offsetCents(raw);
  return centsFromDisplay(raw);
}

function positiveMoney(value: unknown) {
  const cents = moneyCents(value);
  return cents != null && cents > 0 ? cents : null;
}

export function accountFigures(input: {
  totalPrepay?: unknown;
  prepayAccount?: unknown;
  funding?: FundingSource | FundingSource[] | null;
  unbilled?: unknown;
  balance?: unknown;
  threshold?: unknown;
}) {
  const available =
    positiveMoney(input.totalPrepay) ??
    positiveMoney(input.prepayAccount) ??
    availableBalanceCents(input.funding);
  return {
    availableCents: available,
    chargeCents: positiveMoney(input.unbilled) ?? moneyCents(input.balance),
    thresholdCents: positiveMoney(input.threshold),
  };
}

export function centsFromMoneyInput(value: string) {
  const digits = value.replace(/\D/g, "");
  if (!digits) return null;
  const cents = Number(digits);
  if (!Number.isFinite(cents) || cents <= 0) return null;
  return cents;
}

export function balanceGrew(before: number | null, after: number | null, cents: number) {
  if (before == null || after == null) return false;
  if (
    !Number.isInteger(before) ||
    !Number.isInteger(after) ||
    !Number.isInteger(cents) ||
    cents <= 0
  )
    return false;
  return after >= before + cents;
}

function isPixPayload(value: string) {
  const text = value.trim();
  if (!text.startsWith("000201") || text.length < 40 || text.length > 400 || /\s/.test(text))
    return false;
  return /br\.gov\.bcb\.pix/i.test(text) || text.includes("5802BR");
}

function walk(value: unknown, depth: number, visit: (text: string) => void) {
  if (depth > 8 || value == null) return;
  if (typeof value === "string") {
    visit(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) walk(item, depth + 1, visit);
    return;
  }
  if (typeof value === "object") {
    for (const item of Object.values(value)) walk(item, depth + 1, visit);
  }
}

export function pixFromMeta(node: unknown): MetaCreditPix | null {
  let payload = "";
  walk(node, 0, (text) => {
    if (!payload && isPixPayload(text)) payload = text.trim();
  });
  if (!payload) return null;
  let image = "";
  walk(node, 0, (text) => {
    const trimmed = text.trim();
    if (image || trimmed === payload) return;
    if (trimmed.startsWith("data:image/")) image = trimmed;
    else if (trimmed.startsWith("iVBORw0KGgo") && trimmed.length > 80) image = trimmed;
  });
  return { payload, image };
}

export function metaBillingUrl(accountId: string, businessId: string | null) {
  const digits = accountId.trim().replace(/^act_/i, "");
  if (!/^\d+$/.test(digits)) return null;
  const url = new URL("https://business.facebook.com/billing_hub/payment_settings");
  url.searchParams.set("asset_id", digits);
  url.searchParams.set("placement", "ads_manager");
  if (businessId && /^\d+$/.test(businessId.trim()))
    url.searchParams.set("business_id", businessId.trim());
  return url.toString();
}
