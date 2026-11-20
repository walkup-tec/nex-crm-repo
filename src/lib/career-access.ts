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

/** Normaliza telefone/WhatsApp para dedupe (só dígitos; preserva DDI quando houver). */
export function normalizePhoneDigits(value: string) {
  return value.replace(/\D/g, "");
}

export function parsePhoneParts(value: string): { ddi: string; ddd: string; number: string; digits: string } {
  const digits = normalizePhoneDigits(value);
  if (!digits) return { ddi: "", ddd: "", number: "", digits: "" };
  if (digits.length >= 12 && digits.startsWith("55")) {
    return { ddi: "55", ddd: digits.slice(2, 4), number: digits.slice(4), digits };
  }
  if (digits.length >= 10 && digits.length <= 11) {
    return { ddi: "55", ddd: digits.slice(0, 2), number: digits.slice(2), digits: `55${digits}` };
  }
  return { ddi: "", ddd: "", number: digits, digits };
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
  // canônicos v0.3.0
  email: "hr_email",
  hr: "hr_email",
  hr_mail: "hr_email",
  rh_email: "hr_email",
  recruiting: "hr_email",
  recruiter_email: "hr_email",
  recruiting_email: "hr_email",
  corporate: "corporate_email",
  company_email: "corporate_email",
  general_email: "corporate_email",
  whatsapp: "whatsapp",
  wa: "whatsapp",
  business_whatsapp: "whatsapp",
  phone: "phone",
  telephone: "phone",
  mobile: "phone",
  celular: "phone",
  telefone: "phone",
  website: "website",
  site: "website",
  careers_page: "website",
  career_page: "website",
  linkedin: "recruiter_linkedin",
  company_linkedin: "website",
  company_li: "website",
  recruiter_li: "recruiter_linkedin",
  marketing_li: "recruiter_linkedin",
  marketing_manager_linkedin: "recruiter_linkedin",
  person_linkedin: "recruiter_linkedin",
  instagram: "instagram",
  ig: "instagram",
  facebook: "facebook",
  fb: "facebook",
  person: "other",
};

/** Kinds aceitos no banco (canônicos + legado). */
export const CAREER_CONTACT_KINDS = [
  "hr_email",
  "corporate_email",
  "whatsapp",
  "phone",
  "website",
  "recruiter_linkedin",
  "instagram",
  "facebook",
  // legado (ainda válidos no CHECK)
  "recruiting_email",
  "business_whatsapp",
  "company_linkedin",
  "marketing_manager_linkedin",
  "person",
  "other",
] as const;

export type CareerContactKind = (typeof CAREER_CONTACT_KINDS)[number];

/** Kinds preferidos pelo contrato v0.3.0 (UI/MCP docs). */
export const CAREER_CONTACT_KINDS_V030 = [
  "hr_email",
  "corporate_email",
  "whatsapp",
  "phone",
  "website",
  "recruiter_linkedin",
  "instagram",
  "facebook",
] as const;

export function normalizeCareerContactKind(raw: string): CareerContactKind | "" {
  const value = raw.trim().toLowerCase().replace(/\s+/g, "_");
  if (!value) return "";
  const aliased = CONTACT_KIND_ALIASES[value] ?? value;
  return (CAREER_CONTACT_KINDS as readonly string[]).includes(aliased) ? (aliased as CareerContactKind) : "";
}

export function careerContactKindLabel(kind: string): string {
  const map: Record<string, string> = {
    hr_email: "E-mail RH",
    recruiting_email: "E-mail recrutamento",
    corporate_email: "E-mail corporativo",
    whatsapp: "WhatsApp",
    business_whatsapp: "WhatsApp",
    phone: "Telefone",
    website: "Site",
    recruiter_linkedin: "LinkedIn recrutador",
    company_linkedin: "LinkedIn empresa",
    marketing_manager_linkedin: "LinkedIn marketing",
    instagram: "Instagram",
    facebook: "Facebook",
    person: "Pessoa",
    other: "Outro",
  };
  return map[kind] ?? kind;
}

export type CareerResearchMode = "linkedin_monitor" | "company_prospect" | "unknown";

export function normalizeCareerResearchMode(raw: string | undefined | null): CareerResearchMode {
  const value = (raw ?? "").trim().toLowerCase().replace(/\s+/g, "_");
  if (value === "linkedin_monitor" || value === "linkedin" || value === "monitor") return "linkedin_monitor";
  if (value === "company_prospect" || value === "prospect" || value === "prospection" || value === "multichannel") {
    return "company_prospect";
  }
  return "unknown";
}

export type CareerEnrichmentStatus = "none" | "partial" | "complete" | "researching";

export function deriveEnrichmentStatus(kindsFound: string[]): CareerEnrichmentStatus {
  const set = new Set(kindsFound.map((k) => normalizeCareerContactKind(k) || k));
  const priority = ["hr_email", "recruiting_email", "corporate_email", "whatsapp", "business_whatsapp", "website", "recruiter_linkedin"];
  const hits = priority.filter((k) => set.has(k)).length;
  if (hits === 0) return "none";
  if (hits >= 4) return "complete";
  return "partial";
}
