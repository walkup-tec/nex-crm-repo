const keptValues = new Set([
  "type",
  "amount",
  "currency",
  "display_amount",
  "original_amount",
  "original_display_amount",
]);

export function sanitizeProbeMessage(message: string | null) {
  if (!message || /[{}[\]]/.test(message)) return null;
  const cleaned = message
    .replace(/access_token=[^&\s]+/gi, "access_token")
    .replace(/EAA[A-Za-z0-9]+/g, "token")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "email")
    .replace(/\d{12,}/g, "numero")
    .slice(0, 180);
  return cleaned.trim() || null;
}

const accountValues = new Set(["currency", "balance", "is_prepay_account", "spend_cap", "amount_spent"]);

export function sanitizeFundingNode(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => sanitizeFundingNode(item));
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const result: Record<string, unknown> = { keys: Object.keys(record).sort() };
  for (const key of keptValues) {
    if (Object.prototype.hasOwnProperty.call(record, key)) result[key] = record[key] ?? null;
  }
  if (Object.prototype.hasOwnProperty.call(record, "coupons")) result.coupons = sanitizeFundingNode(record.coupons);
  if (Object.prototype.hasOwnProperty.call(record, "coupon")) result.coupon = sanitizeFundingNode(record.coupon);
  return result;
}

export function sanitizeAccountProbe(body: Record<string, unknown>) {
  const result: Record<string, unknown> = { keys: Object.keys(body).sort() };
  for (const key of accountValues) {
    if (Object.prototype.hasOwnProperty.call(body, key)) result[key] = body[key] ?? null;
  }
  if (Object.prototype.hasOwnProperty.call(body, "funding_source_details")) {
    result.funding_source_details = sanitizeFundingNode(body.funding_source_details);
  }
  return result;
}
