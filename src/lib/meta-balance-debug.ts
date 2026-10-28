export type MetaFieldRead = {
  name: string;
  field: string;
  ok: boolean;
  status: number;
  code: number | null;
  body: unknown;
};

const hiddenKey = /token|secret|password|authorization|email|fbtrace/i;

export function sanitizeMetaDebug(value: unknown, key = "", depth = 0): unknown {
  if (depth > 6) return null;
  if (value == null || typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "string") return sanitizeDebugText(value, key);
  if (Array.isArray(value)) return value.slice(0, 8).map((item) => sanitizeMetaDebug(item, key, depth + 1));
  if (typeof value !== "object") return null;
  const result: Record<string, unknown> = {};
  for (const name of Object.keys(value as Record<string, unknown>).sort()) {
    if (hiddenKey.test(name)) continue;
    result[name] = sanitizeMetaDebug((value as Record<string, unknown>)[name], name, depth + 1);
  }
  return result;
}

function sanitizeDebugText(value: string, key: string) {
  const cleaned = value
    .replace(/access_token=[^&\s]+/gi, "access_token")
    .replace(/EAA[A-Za-z0-9]+/g, "token")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "email");
  const masked = /display_string|message/i.test(key) ? cleaned.replace(/\d{12,}/g, "numero") : cleaned;
  return masked.slice(0, 400);
}
