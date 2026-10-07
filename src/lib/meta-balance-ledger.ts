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
  storedCents: number | null;
  creditCount: number;
}) {
  return (
    input.hasCard && (input.storedCents == null || input.storedCents === 0) && input.creditCount > 0
  );
}

export function prepaidBalanceCents(entries: Pick<LedgerEntry, "direction" | "cents">[]) {
  return entries.reduce(
    (total, entry) => total + (entry.direction === "credit" ? entry.cents : -entry.cents),
    0,
  );
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
  const blob = normalizeText(
    [
      record.status,
      record.charge_type,
      record.payment_option,
      record.billing_reason,
      record.transaction_type,
      record.event_type,
      record.translated_event_type,
      record.extra_data,
      extra,
    ]
      .map(readable)
      .join(" "),
  );
  const status = normalizeText(readable(record.status) || blob);
  const method = normalizeText(readable(record.payment_option));
  const pending = /pendente|pending|in_progress|initiated|failed|recusad|declin|unsuccessful/.test(
    status,
  );
  const funding =
    record.is_funding_event === true ||
    /pagamento manual|manual payment|add_funds|funding_event|adicionar fundos/.test(blob);
  const received =
    /com saldo|with balance/.test(blob) ||
    (/successful|completed|settled/.test(status) && !pending);
  const card = /credit_card|debit_card|cart[aã]o/.test(method);
  const prepaid = /pre[- ]?pago|stored[_\s-]?balance|prepaid|prepay/.test(`${method} ${blob}`);
  const paid = /pago|paid|completed|successful|settled/.test(`${status} ${blob}`) && !pending;
  const direction: LedgerDirection | null =
    funding && received && !card && !pending
      ? "credit"
      : prepaid && paid && !funding
        ? "debit"
        : null;
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
