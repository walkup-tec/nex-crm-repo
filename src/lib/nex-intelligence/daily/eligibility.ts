/** Regras puras de elegibilidade da rotina diária (testáveis sem DB). */

export type DailyEligibilityOrg = {
  id: string;
  status: string;
  adsMeta: boolean;
  legalName: string;
};

export type DailyEligibilityConnection = {
  organizationId: string;
  status: string;
  hasToken: boolean;
};

export type DailyEligibilityVerdict =
  | { ok: true }
  | { ok: false; reason: string };

export function isSubscriberActiveForIntelligence(org: DailyEligibilityOrg): DailyEligibilityVerdict {
  if (!org.adsMeta) return { ok: false, reason: "ads_meta_disabled" };
  if (org.status === "disabled" || org.status === "blocked") {
    return { ok: false, reason: `org_status_${org.status}` };
  }
  if (org.status === "overdue") return { ok: false, reason: "org_overdue" };
  if (org.status !== "active") return { ok: false, reason: `org_status_${org.status}` };
  return { ok: true };
}

export function hasOperationalMetaLink(
  orgId: string,
  connections: DailyEligibilityConnection[],
): DailyEligibilityVerdict {
  const link = connections.find((row) => row.organizationId === orgId);
  if (!link) return { ok: false, reason: "meta_connection_missing" };
  if (link.status !== "connected") return { ok: false, reason: `meta_status_${link.status}` };
  if (!link.hasToken) return { ok: false, reason: "meta_token_missing" };
  return { ok: true };
}

export function evaluateDailyEligibility(
  org: DailyEligibilityOrg,
  connections: DailyEligibilityConnection[],
): DailyEligibilityVerdict {
  const subscriber = isSubscriberActiveForIntelligence(org);
  if (!subscriber.ok) return subscriber;
  return hasOperationalMetaLink(org.id, connections);
}

/** Data de referência (ontem) no fuso America/Sao_Paulo, formato YYYY-MM-DD. */
export function intelligenceReferenceDate(now = new Date(), timeZone = "America/Sao_Paulo"): string {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const [y, m, d] = today.split("-").map(Number);
  const utc = Date.UTC(y!, m! - 1, d!);
  const yesterday = new Date(utc - 24 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(yesterday);
}

export function shouldRunDailyJobAt(
  now: Date,
  options?: { hour?: number; timeZone?: string; lastRunKey?: string | null },
): { run: boolean; slotKey: string } {
  const timeZone = options?.timeZone ?? "America/Sao_Paulo";
  const hour = options?.hour ?? Number(process.env.NEX_INTELLIGENCE_DAILY_HOUR || 7);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  const slotKey = `${get("year")}-${get("month")}-${get("day")}T${get("hour")}`;
  const currentHour = Number(get("hour"));
  if (!Number.isFinite(currentHour) || currentHour !== hour) {
    return { run: false, slotKey };
  }
  if (options?.lastRunKey === slotKey) return { run: false, slotKey };
  return { run: true, slotKey };
}
