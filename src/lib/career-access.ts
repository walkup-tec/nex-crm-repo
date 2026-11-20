/** E-mail canônico do único usuário autorizado no módulo Candidatura (painel). */
export const CAREER_ALLOWED_EMAIL = "walkup@walkuptec.com.br";

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export function isCareerAllowedEmail(email: string | null | undefined) {
  return normalizeEmail(email ?? "") === CAREER_ALLOWED_EMAIL;
}

/** Remove acentos e padroniza espaços/caixa para comparação de nomes. */
export function normalizeCompanyName(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function normalizeCnpj(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.length === 14 ? digits : "";
}

export function normalizeDomain(websiteOrDomain: string) {
  const raw = websiteOrDomain.trim().toLowerCase();
  if (!raw) return "";
  try {
    const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    const host = new URL(withProtocol).hostname.replace(/^www\./, "");
    return host;
  } catch {
    return raw
      .replace(/^https?:\/\//i, "")
      .replace(/^www\./i, "")
      .split("/")[0]
      ?.split("?")[0]
      ?.trim() ?? "";
  }
}

export function normalizeLinkedInUrl(value: string) {
  const raw = value.trim().toLowerCase();
  if (!raw) return "";
  try {
    const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    const url = new URL(withProtocol);
    if (!url.hostname.includes("linkedin.com")) return raw.split("?")[0]?.replace(/\/$/, "") ?? "";
    return `${url.hostname.replace(/^www\./, "")}${url.pathname.replace(/\/$/, "")}`;
  } catch {
    return raw.split("?")[0]?.replace(/\/$/, "") ?? "";
  }
}

export function normalizeJobUrl(value: string) {
  const raw = value.trim();
  if (!raw) return "";
  try {
    const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    const url = new URL(withProtocol);
    url.hash = "";
    ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "fbclid", "gclid"].forEach((key) =>
      url.searchParams.delete(key),
    );
    const qs = url.searchParams.toString();
    return `${url.origin}${url.pathname.replace(/\/$/, "")}${qs ? `?${qs}` : ""}`.toLowerCase();
  } catch {
    return raw.split("#")[0]?.trim().toLowerCase() ?? "";
  }
}

export function normalizeJobTitle(value: string) {
  return normalizeCompanyName(value);
}

export function normalizeContactValue(value: string) {
  return value.trim().toLowerCase();
}

export type CareerUpsertCounts = {
  received: number;
  created: number;
  updated: number;
  duplicates: number;
  errors: number;
};

export function emptyUpsertCounts(): CareerUpsertCounts {
  return { received: 0, created: 0, updated: 0, duplicates: 0, errors: 0 };
}

/** Lê string de campo camelCase ou snake_case (GPT/MCP costuma misturar). */
export function pickCareerField(row: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return "";
}

export function asCareerRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

const CONTACT_KIND_ALIASES: Record<string, string> = {
  email: "hr_email",
  hr: "hr_email",
  hr_mail: "hr_email",
  recruiting: "recruiting_email",
  recruiter_email: "recruiting_email",
  whatsapp: "business_whatsapp",
  phone: "business_whatsapp",
  linkedin: "company_linkedin",
  company_li: "company_linkedin",
  recruiter_li: "recruiter_linkedin",
  marketing_li: "marketing_manager_linkedin",
  person_linkedin: "recruiter_linkedin",
};

export const CAREER_CONTACT_KINDS = [
  "hr_email",
  "recruiting_email",
  "business_whatsapp",
  "company_linkedin",
  "recruiter_linkedin",
  "marketing_manager_linkedin",
  "person",
  "other",
] as const;

export type CareerContactKind = (typeof CAREER_CONTACT_KINDS)[number];

export function normalizeCareerContactKind(raw: string): CareerContactKind | "" {
  const value = raw.trim().toLowerCase().replace(/\s+/g, "_");
  if (!value) return "";
  const aliased = CONTACT_KIND_ALIASES[value] ?? value;
  return (CAREER_CONTACT_KINDS as readonly string[]).includes(aliased) ? (aliased as CareerContactKind) : "";
}
