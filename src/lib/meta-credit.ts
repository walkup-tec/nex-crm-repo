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
  canAdd: boolean;
  syncedAt: string | null;
  prepay: boolean | null;
  balanceUrl: string | null;
};

export type FundingSource = {
  type?: number | string;
  amount?: string | number | null;
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

export function availableBalanceCents(
  funding: FundingSource | FundingSource[] | null | undefined,
): number | null {
  const sources = Array.isArray(funding) ? funding : funding ? [funding] : [];
  let total = 0;
  let found = false;
  for (const source of sources) {
    if (Number(source.type) === storedBalance) {
      const cents = offsetCents(source.amount);
      if (cents != null) {
        total += cents;
        found = true;
      }
    }
    for (const coupon of source.coupons ?? []) {
      const cents = offsetCents(coupon.amount);
      if (cents != null) {
        total += cents;
        found = true;
      }
    }
  }
  return found ? total : null;
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
