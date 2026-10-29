const captured = new Set([
  "id",
  "status",
  "payment_option",
  "app_amount",
  "provider_amount",
  "amount",
  "time",
  "is_funding_event",
  "billing_reason",
  "charge_type",
  "currency",
]);

const moneyValue = new Set(["amount", "currency", "total_amount"]);

export const knownTransactionIds = [
  "29353659210991639-29241185882238978",
  "29270693555954871-29465309913159899",
  "29373632172327680-29236716052685959",
  "28936639426026954-2913029933327629",
  "29007270588963838-28916370761387158",
];

export function rejectedTransactionField(message: string | null) {
  if (!message) return null;
  const match = message.match(/field \(([a-z0-9_]+)\)/i);
  return match?.[1] ?? null;
}

export function diagnoseTransactionRow(row: Record<string, unknown>) {
  const keys = Object.keys(row).sort();
  const result: Record<string, unknown> = {
    other_keys: keys.filter((key) => !captured.has(key)),
  };
  if (typeof row.id === "string" && row.id.trim()) result.id = row.id.trim().slice(0, 80);
  for (const key of ["status", "payment_option", "billing_reason", "charge_type", "currency"]) {
    if (Object.prototype.hasOwnProperty.call(row, key)) result[key] = textValue(row[key]);
  }
  if (Object.prototype.hasOwnProperty.call(row, "is_funding_event")) {
    result.is_funding_event = row.is_funding_event === true || row.is_funding_event === false ? row.is_funding_event : textValue(row.is_funding_event);
  }
  if (Object.prototype.hasOwnProperty.call(row, "time")) result.time = timeValue(row.time);
  else result.time = null;
  for (const key of ["app_amount", "provider_amount", "amount"]) {
    if (Object.prototype.hasOwnProperty.call(row, key)) result[key] = moneyNode(row[key]);
  }
  return result;
}

export function transactionDateClass(time: unknown, now: number) {
  const parsed = epochMillis(time);
  if (parsed == null) return "unknown" as const;
  const since = now - 30 * 24 * 60 * 60 * 1000;
  if (parsed >= since && parsed <= now) return "inside" as const;
  return "outside" as const;
}

export function assembleTransactionDiagnosis(input: {
  attempts: unknown[];
  rows: Record<string, unknown>[];
  pages: number;
  hasMore: boolean;
  fields: string[];
  now: number;
}) {
  const transactions = input.rows.map((row) => diagnoseTransactionRow(row));
  const ids = transactions.flatMap((row) => (typeof row.id === "string" ? [row.id] : []));
  const seen = new Set<string>();
  const duplicateIds = ids.filter((id) => {
    if (seen.has(id)) return true;
    seen.add(id);
    return false;
  });
  const dates = input.rows.map((row) => transactionDateClass(row.time, input.now));
  const known = knownTransactionIds.map((id) => ({
    id,
    found: ids.includes(id),
  }));
  return {
    account: "886574174420761",
    edge: "transactions",
    attempts: input.attempts,
    fields: input.fields,
    pages: input.pages,
    has_more: input.hasMore,
    rows: transactions.length,
    duplicate_ids: [...new Set(duplicateIds)],
    unknown_date: dates.filter((item) => item === "unknown").length,
    dated_in_30_days: dates.filter((item) => item === "inside").length,
    dated_outside_30_days: dates.filter((item) => item === "outside").length,
    known,
    transactions,
  };
}

function moneyNode(value: unknown): unknown {
  if (value == null || typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "string") return textValue(value);
  if (typeof value !== "object" || Array.isArray(value)) return { keys: [] };
  const record = value as Record<string, unknown>;
  const result: Record<string, unknown> = { keys: Object.keys(record).sort() };
  for (const key of moneyValue) {
    if (Object.prototype.hasOwnProperty.call(record, key)) result[key] = textValue(record[key]);
  }
  return result;
}

function timeValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") return textValue(value);
  return null;
}

function textValue(value: unknown) {
  if (typeof value === "number" || typeof value === "boolean" || value == null) return value;
  if (typeof value !== "string") return null;
  return value
    .replace(/access_token=[^&\s]+/gi, "access_token")
    .replace(/EAA[A-Za-z0-9]+/g, "token")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "email")
    .replace(/\d{12,}/g, "numero")
    .slice(0, 200);
}

function epochMillis(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value > 10_000_000_000 ? value : value * 1000;
  }
  if (typeof value !== "string" || !value.trim() || value.trim() === "0") return null;
  if (/^\d+$/.test(value.trim())) return epochMillis(Number(value.trim()));
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) || parsed <= 0 ? null : parsed;
}
