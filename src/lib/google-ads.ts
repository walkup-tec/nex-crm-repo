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

export function campaignMetricsQuery() {
  return [
    "SELECT campaign.id, campaign.name, campaign.status, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions",
    "FROM campaign",
    "WHERE segments.date DURING LAST_30_DAYS AND campaign.status != 'REMOVED'",
    "ORDER BY metrics.impressions DESC",
    "LIMIT 50",
  ].join(" ");
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

export function googleAdsFailure(status: number, body: unknown) {
  const raw = JSON.stringify(body ?? "");
  if (/CLOUD_PROJECT_NOT_APPROVED_FOR_PRODUCTION|DEVELOPER_TOKEN_NOT_APPROVED|ACTION_NOT_PERMITTED/.test(raw)) {
    return "O projeto Google Cloud ainda não tem acesso Explorer ou superior para consultar contas reais.";
  }
  if (status === 401 || /invalid_grant|UNAUTHENTICATED/.test(raw)) {
    return "A autorização do Google Ads expirou. Atualize o refresh token no servidor.";
  }
  if (status === 403) return "O Google Ads recusou a consulta desta conta.";
  if (status === 429) return "O Google Ads limitou as consultas. Tente de novo em alguns minutos.";
  return "Não foi possível consultar o Google Ads.";
}

export function campaignStatusLabel(status: string) {
  if (status === "ENABLED") return "Ativa";
  if (status === "PAUSED") return "Pausada";
  if (status === "REMOVED") return "Removida";
  return status || "Sem status";
}
