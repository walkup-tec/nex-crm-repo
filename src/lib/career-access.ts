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
