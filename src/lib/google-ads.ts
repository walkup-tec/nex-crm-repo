export const googleAdsEnvNames = [
  "GOOGLE_ADS_CLIENT_ID",
  "GOOGLE_ADS_CLIENT_SECRET",
  "GOOGLE_ADS_REDIRECT_URI",
  "GOOGLE_ADS_REFRESH_TOKEN",
  "GOOGLE_ADS_LOGIN_CUSTOMER_ID",
] as const;

export const googleAdsScope = "https://www.googleapis.com/auth/adwords";

export type GoogleAdsAccount = {
  customerId: string;
  name: string;
  currency: string;
  status: string;
};

export type GoogleAdsCampaign = {
  id: string;
  name: string;
  status: string;
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
};

export function missingGoogleAdsEnv(env: Record<string, string | undefined>) {
  return googleAdsEnvNames.filter((name) => !env[name]?.trim());
}

export function cleanCustomerId(value: string) {
  const digits = value.trim().replace(/^customers\//, "").replace(/\D/g, "");
  return /^\d{6,12}$/.test(digits) ? digits : "";
}

export function refreshTokenUsable(scope: string | undefined) {
  if (!scope?.trim()) return true;
  return scope.split(/\s+/).includes(googleAdsScope);
}

export function refreshTokenBody(input: { clientId: string; clientSecret: string; refreshToken: string }) {
  return new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: input.refreshToken,
    client_id: input.clientId,
    client_secret: input.clientSecret,
  });
}

export function googleAdsApiVersion(env: Record<string, string | undefined>) {
  const version = env.GOOGLE_ADS_API_VERSION?.trim() || "v25";
  return /^v\d+$/.test(version) ? version : "v25";
}

export function customerClientQuery() {
  return [
    "SELECT customer_client.client_customer, customer_client.descriptive_name, customer_client.currency_code, customer_client.status, customer_client.manager",
    "FROM customer_client",
    "WHERE customer_client.manager = FALSE",
  ].join(" ");
}

export type GoogleAdsMetric = "clicks" | "impressions" | "cpc" | "cost";

export type GoogleAdsDay = {
  date: string;
  clicks: number;
  impressions: number;
  cost: number;
};

export type GoogleAdsPeriod = { mode: "total" } | { mode: "custom"; since: string; until: string };

const dayKey = /^(\d{4})-(\d{2})-(\d{2})$/;

export function shiftIsoMonths(iso: string, months: number) {
  const match = dayKey.exec(iso);
  if (!match) return iso;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  date.setUTCMonth(date.getUTCMonth() + months);
  return date.toISOString().slice(0, 10);
}

function nextIsoDay(iso: string) {
  const match = dayKey.exec(iso);
  if (!match) return iso;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

export function googleAdsQueryWindow(input: { period?: string; since?: string; until?: string }, today: string) {
  if (!dayKey.test(today)) throw new Error("Escolha o início e o fim do período.");
  if (!input.period || input.period === "total") {
    return { period: { mode: "total" } as GoogleAdsPeriod, since: shiftIsoMonths(today, -37), until: today };
  }
  if (input.period !== "custom") throw new Error("Escolha Total ou um período personalizado.");
  const since = input.since ?? "";
  const until = input.until ?? "";
  if (!dayKey.test(since) || !dayKey.test(until)) throw new Error("Escolha o início e o fim do período.");
  if (since > until) throw new Error("O período personalizado precisa começar antes de terminar.");
  if (until > today) throw new Error("O período personalizado não pode terminar no futuro.");
  if (since < shiftIsoMonths(until, -37)) throw new Error("O Google Ads só devolve até 37 meses nesse período.");
  return { period: { mode: "custom", since, until } as GoogleAdsPeriod, since, until };
}

export function accountDailyQuery(since: string, until: string) {
  if (!dayKey.test(since) || !dayKey.test(until)) throw new Error("Escolha o início e o fim do período.");
  return [
    "SELECT segments.date, metrics.impressions, metrics.clicks, metrics.cost_micros",
    "FROM customer",
    `WHERE segments.date BETWEEN '${since}' AND '${until}'`,
    "ORDER BY segments.date",
  ].join(" ");
}

export function campaignMetricsQuery(since: string, until: string) {
  if (!dayKey.test(since) || !dayKey.test(until)) throw new Error("Escolha o início e o fim do período.");
  return [
    "SELECT campaign.id, campaign.name, campaign.status, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions",
    "FROM campaign",
    `WHERE segments.date BETWEEN '${since}' AND '${until}' AND campaign.status != 'REMOVED'`,
    "ORDER BY metrics.impressions DESC",
  ].join(" ");
}

export function sumGoogleCampaigns(campaigns: Pick<GoogleAdsCampaign, "impressions" | "clicks" | "cost" | "conversions">[]) {
  return campaigns.reduce(
    (total, row) => ({
      impressions: total.impressions + row.impressions,
      clicks: total.clicks + row.clicks,
      cost: total.cost + row.cost,
      conversions: total.conversions + row.conversions,
    }),
    { impressions: 0, clicks: 0, cost: 0, conversions: 0 },
  );
}

export function googleAdsCampaignTotal(
  campaigns: Pick<GoogleAdsCampaign, "impressions" | "clicks" | "cost" | "conversions">[],
  metric: GoogleAdsMetric,
) {
  const total = sumGoogleCampaigns(campaigns);
  if (metric === "cpc") return total.clicks > 0 ? total.cost / total.clicks : 0;
  if (metric === "impressions") return total.impressions;
  if (metric === "cost") return total.cost;
  return total.clicks;
}

function record(value: unknown) {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

function amount(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function parseAccessibleCustomers(body: unknown) {
  const names = record(body).resourceNames;
  if (!Array.isArray(names)) return [];
  return names.map((item) => cleanCustomerId(text(item))).filter(Boolean);
}

export function parseCustomerClients(body: unknown) {
  const results = record(body).results;
  if (!Array.isArray(results)) return [];
  const accounts: GoogleAdsAccount[] = [];
  for (const item of results) {
    const client = record(record(item).customerClient);
    if (client.manager === true) continue;
    const customerId = cleanCustomerId(text(client.clientCustomer));
    if (!customerId || accounts.some((account) => account.customerId === customerId)) continue;
    accounts.push({
      customerId,
      name: text(client.descriptiveName).trim() || `Conta ${customerId}`,
      currency: text(client.currencyCode).trim() || "BRL",
      status: text(client.status).trim() || "ENABLED",
    });
  }
  return accounts;
}

export function parseAccountDays(body: unknown) {
  const results = record(body).results;
  if (!Array.isArray(results)) return [];
  const days: GoogleAdsDay[] = [];
  for (const item of results) {
    const row = record(item);
    const date = text(record(row.segments).date).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    const metrics = record(row.metrics);
    const next = {
      clicks: amount(metrics.clicks),
      impressions: amount(metrics.impressions),
      cost: amount(metrics.costMicros) / 1_000_000,
    };
    const existing = days.find((day) => day.date === date);
    if (existing) {
      existing.clicks += next.clicks;
      existing.impressions += next.impressions;
      existing.cost += next.cost;
      continue;
    }
    days.push({ date, ...next });
  }
  return days.sort((left, right) => left.date.localeCompare(right.date));
}

export function saoPauloDate(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function fillAccountDays(days: GoogleAdsDay[], since: string, until: string) {
  if (!dayKey.test(since) || !dayKey.test(until) || since > until) return [];
  const byDate = new Map(days.map((day) => [day.date, day]));
  const filled: GoogleAdsDay[] = [];
  let cursor = since;
  while (cursor <= until && filled.length < 1200) {
    filled.push(byDate.get(cursor) ?? { date: cursor, clicks: 0, impressions: 0, cost: 0 });
    cursor = nextIsoDay(cursor);
  }
  return filled;
}

export function googleAdsDayValue(day: GoogleAdsDay, metric: GoogleAdsMetric) {
  if (metric === "cpc") return day.clicks > 0 ? day.cost / day.clicks : 0;
  return day[metric];
}

export function googleAdsMetricTotal(days: GoogleAdsDay[], metric: GoogleAdsMetric) {
  const clicks = days.reduce((sum, day) => sum + day.clicks, 0);
  const impressions = days.reduce((sum, day) => sum + day.impressions, 0);
  const cost = days.reduce((sum, day) => sum + day.cost, 0);
  if (metric === "cpc") return clicks > 0 ? cost / clicks : 0;
  if (metric === "impressions") return impressions;
  if (metric === "cost") return cost;
  return clicks;
}

export function selectGoogleAdsMetric(selected: GoogleAdsMetric[], metric: GoogleAdsMetric) {
  if (selected.includes(metric)) return selected.length === 1 ? selected : selected.filter((item) => item !== metric);
  if (selected.length < 2) return [...selected, metric];
  return [selected[0], metric];
}

export function parseCampaignMetrics(body: unknown) {
  const results = record(body).results;
  if (!Array.isArray(results)) return [];
  const campaigns: GoogleAdsCampaign[] = [];
  for (const item of results) {
    const row = record(item);
    const campaign = record(row.campaign);
    const metrics = record(row.metrics);
    const id = text(campaign.id).trim();
    if (!id) continue;
    const existing = campaigns.find((entry) => entry.id === id);
    const next = {
      impressions: amount(metrics.impressions),
      clicks: amount(metrics.clicks),
      cost: amount(metrics.costMicros) / 1_000_000,
      conversions: amount(metrics.conversions),
    };
    if (existing) {
      existing.impressions += next.impressions;
      existing.clicks += next.clicks;
      existing.cost += next.cost;
      existing.conversions += next.conversions;
      continue;
    }
    campaigns.push({
      id,
      name: text(campaign.name).trim() || `Campanha ${id}`,
      status: text(campaign.status).trim() || "UNKNOWN",
      ...next,
    });
  }
  return campaigns;
}

function googleErrorDetail(body: unknown) {
  const error = record(record(body).error);
  const codes: string[] = [];
  let apiMessage = text(error.message);
  const details = Array.isArray(error.details) ? error.details : [];
  for (const detail of details) {
    const errors = record(detail).errors;
    if (!Array.isArray(errors)) continue;
    for (const item of errors) {
      const errorCode = record(record(item).errorCode);
      for (const name of Object.values(errorCode)) {
        if (typeof name === "string" && name.trim()) codes.push(name.trim());
      }
      if (!apiMessage) apiMessage = text(record(item).message);
    }
  }
  const http = typeof error.code === "number" ? `HTTP ${error.code}` : "";
  const detail = [http, text(error.status), codes[0], apiMessage].filter(Boolean).join(" — ");
  if (/access_token|refresh_token|client_secret|ya29\.|GOCSPX/i.test(detail)) return "";
  return detail.slice(0, 400);
}

export function googleAdsFailure(status: number, body: unknown) {
  const raw = JSON.stringify(body ?? "");
  let summary = "Não foi possível consultar o Google Ads.";
  if (/CLOUD_PROJECT_NOT_APPROVED_FOR_PRODUCTION|DEVELOPER_TOKEN_NOT_APPROVED|ACTION_NOT_PERMITTED/.test(raw)) {
    summary = "O projeto Google Cloud ainda não tem acesso Explorer ou superior para consultar contas reais.";
  } else if (status === 401 || /invalid_grant|UNAUTHENTICATED/.test(raw)) {
    summary = "A autorização do Google Ads expirou. Atualize o refresh token no servidor.";
  } else if (status === 403) summary = "O Google Ads recusou a consulta desta conta.";
  else if (status === 429) summary = "O Google Ads limitou as consultas. Tente de novo em alguns minutos.";
  const detail = googleErrorDetail(body);
  return detail ? `${summary} ${detail}` : summary;
}

export function adsLoadFailure(error: unknown) {
  const message = error instanceof Error ? error.message.trim() : "";
  if (/failed to fetch|networkerror|network request failed|load failed|aborterror|timeout/i.test(message)) {
    return "A conexão com o Google Ads caiu antes da resposta.";
  }
  if (!message || message.length > 240 || /access_token|refresh_token|client_secret|ya29\.|GOCSPX|postgres|JWT/i.test(message)) {
    return "A consulta das contas do Google Ads foi interrompida antes da resposta.";
  }
  return message;
}

export function campaignStatusLabel(status: string) {
  if (status === "ENABLED") return "Ativa";
  if (status === "PAUSED") return "Pausada";
  if (status === "REMOVED") return "Removida";
  return status || "Sem status";
}
