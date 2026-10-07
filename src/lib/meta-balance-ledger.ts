import type { Json } from "@/integrations/supabase/types";
import type { FundingSource } from "@/lib/meta-credit";

export type LedgerDirection = "credit" | "debit";

export type LedgerEntry = {
  id: string;
  direction: LedgerDirection;
  cents: number;
  at: string | null;
};

const cardType = 1;

export function centsFromMetaAmount(value: unknown): number | null {
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value <= 0) return null;
    return Number.isInteger(value) ? Math.round(value) : Math.round(value * 100);
  }
  if (typeof value === "string") {
    const raw = value.trim();
    if (!raw || !/\d/.test(raw)) return null;
    if (/^\d+$/.test(raw)) {
      const cents = Number(raw);
      return Number.isFinite(cents) && cents > 0 ? cents : null;
    }
    const cleaned = raw.replace(/[^\d,.-]/g, "");
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
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  return centsFromMetaAmount(
    record["amount"] ?? record["total_amount"] ?? record["new_value"] ?? null,
  );
}

export function hasCreditCard(
  funding: FundingSource | FundingSource[] | null | undefined,
): boolean {
  const sources = Array.isArray(funding) ? funding : funding ? [funding] : [];
  return sources.some((source) => {
    if (Number(source.type) === cardType) return true;
    return /cart[aã]o|cr[eé]dito|credit card/i.test(source.display_string ?? "");
  });
}

export function shouldUsePrepaidLedger(input: {
  hasCard: boolean;
  displayedCents: number | null;
  storedCents: number | null;
  creditCount: number;
}) {
  const noStoredBalance = input.storedCents == null || input.storedCents === 0;
  const displayedIsZero = input.displayedCents == null || input.displayedCents === 0;
  return noStoredBalance && (input.hasCard || displayedIsZero) && input.creditCount > 0;
}

export function prepaidBalanceCents(entries: Pick<LedgerEntry, "direction" | "cents" | "at">[]) {
  const ordered = [...entries].sort((left, right) => {
    const delta = occurredMillis(left.at) - occurredMillis(right.at);
    if (delta !== 0) return delta;
    if (left.direction === right.direction) return 0;
    return left.direction === "credit" ? -1 : 1;
  });
  let balance = 0;
  for (const entry of ordered) {
    balance =
      entry.direction === "credit" ? balance + entry.cents : Math.max(0, balance - entry.cents);
  }
  return balance;
}

function occurredMillis(at: string | null | undefined) {
  if (!at) return Number.NEGATIVE_INFINITY;
  const parsed = Date.parse(at);
  return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed;
}

export function mergeLedger(existing: LedgerEntry[], incoming: LedgerEntry[]) {
  const byId = new Map(existing.map((entry) => [entry.id, entry]));
  for (const entry of incoming) {
    if (!byId.has(entry.id)) byId.set(entry.id, entry);
  }
  return [...byId.values()];
}

export function readLedger(value: Json | null | undefined): LedgerEntry[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const entries = value["entries"];
  if (!Array.isArray(entries)) return [];
  return entries.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const id = typeof item["id"] === "string" ? item["id"] : "";
    const direction =
      item["direction"] === "credit" || item["direction"] === "debit" ? item["direction"] : null;
    const cents = typeof item["cents"] === "number" ? item["cents"] : null;
    const at = typeof item["at"] === "string" ? item["at"] : null;
    if (!id || !direction || cents == null || !Number.isInteger(cents) || cents <= 0) return [];
    return [{ id, direction, cents, at }];
  });
}

type GraphPayment = {
  id?: unknown;
  tracking_id?: unknown;
  status?: unknown;
  charge_type?: unknown;
  payment_option?: unknown;
  billing_reason?: unknown;
  transaction_type?: unknown;
  event_type?: unknown;
  translated_event_type?: unknown;
  extra_data?: unknown;
  is_funding_event?: unknown;
  app_amount?: unknown;
  provider_amount?: unknown;
  amount?: unknown;
  time?: unknown;
  event_time?: unknown;
  object_id?: unknown;
};

export function classifyGraphPayment(item: unknown): LedgerEntry | null {
  if (!item || typeof item !== "object" || Array.isArray(item)) return null;
  const record = item as GraphPayment;
  const extra = parseExtra(record.extra_data);
  const direction = paymentDirection(record, extra);
  if (!direction) return null;
  const cents = centsFromMetaAmount(
    record.app_amount ??
      record.provider_amount ??
      record.amount ??
      extra?.["amount"] ??
      extra?.["new_value"],
  );
  const id = paymentId(record);
  if (!id || cents == null) return null;
  const at = occurredAt(record.time ?? record.event_time);
  return { id, direction, cents, at };
}

function statusText(record: GraphPayment, extra: Record<string, unknown> | null) {
  const direct = readable(record.status).trim();
  if (direct) return direct;
  if (!extra) return "";
  return readable(extra["status"] ?? extra["payment_status"]).trim();
}

function paymentDirection(
  record: GraphPayment,
  extra: Record<string, unknown> | null,
): LedgerDirection | null {
  const status = canonical(statusText(record, extra));
  if (status === "com saldo" || status === "with balance") return "credit";
  if (status === "pago" || status === "paid") return "debit";
  if (ignoredStatus.has(status)) return null;

  const event = canonical(readable(record.event_type));
  if (ignoredEvent.has(event)) return null;
  if (event === "funding event successful") return "credit";
  if (event === "ad account billing charge") return "debit";

  if (!settledStatus.has(status)) return null;
  if (record.is_funding_event === true) return "credit";
  const charge = canonical(readable(record.charge_type));
  if (charge === "payment" || charge === "charge") return "debit";
  return null;
}

const ignoredStatus = new Set([
  "falha",
  "failed",
  "failure",
  "declined",
  "pendente",
  "pending",
  "in progress",
  "initiated",
]);

const ignoredEvent = new Set([
  "ad account billing decline",
  "ad account billing charge failed",
  "funding event initiated",
]);

const settledStatus = new Set(["completed", "successful", "settled", "success"]);

function canonical(value: string) {
  return normalizeText(value).replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
}

function paymentId(record: GraphPayment) {
  if (typeof record.id === "string" && record.id.trim()) return record.id.trim();
  if (typeof record.tracking_id === "string" && record.tracking_id.trim())
    return record.tracking_id.trim();
  const event = typeof record.event_type === "string" ? record.event_type : "";
  const objectId = record.object_id == null ? "" : String(record.object_id);
  const time = record.event_time == null ? "" : String(record.event_time);
  const id = [event, objectId, time].filter(Boolean).join(":");
  return id || null;
}

function occurredAt(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return new Date(value > 10_000_000_000 ? value : value * 1000).toISOString();
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  return null;
}

function parseExtra(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value))
    return value as Record<string, unknown>;
  if (typeof value !== "string" || !value.trim().startsWith("{")) return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return null;
  }
  return null;
}

function readable(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (!value || typeof value !== "object") return "";
  return JSON.stringify(value);
}

function normalizeText(value: string) {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}
