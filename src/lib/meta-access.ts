export type MetaAccountView = {
  id: string;
  accountId: string;
  name: string;
  currency: string | null;
  statusLabel: string;
};

export type MetaBusinessView = {
  id: string;
  name: string;
};

export type MetaConnectionView = {
  status: "missing" | "pending" | "connected" | "error" | "disconnected";
  connectedAt: string | null;
  lastSyncAt: string | null;
  lastError: string | null;
  selectedAccountId: string | null;
  selectedAccountName: string | null;
  selectedPortfolioId: string | null;
  accounts: MetaAccountView[];
};

export type MetaPeriod = { mode: "total" } | { mode: "custom"; since: string; until: string };

export type MetaKpis = {
  reach: number;
  impressions: number;
  clicks: number;
  results: number;
  resultLabel: string;
  spend: number;
  cpc: number | null;
  ctr: number | null;
  cpm: number | null;
  frequency: number | null;
};

export type MetaResultSeries = {
  campaigns: { id: string; name: string; resultLabel: string }[];
  points: { date: string; values: Record<string, number> }[];
};

export type MetaCampaignRow = {
  id: string;
  name: string;
  status: string;
  statusGroup: "Ativa" | "Inativa" | "Encerrada" | "Outro";
  reach: number;
  impressions: number;
  clicks: number;
  results: number;
  resultLabel: string;
  spend: number;
  cpc: number | null;
  ctr: number | null;
};

export type MetaDayPoint = {
  date: string;
  campaignId: string;
  spend: number;
  impressions: number;
  clicks: number;
  results: number;
};

export type MetaCampaignSnapshot = {
  id: string;
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  results: number;
};

export type MasterCampaignRow = MetaCampaignRow & {
  organizationId: string;
  clientName: string;
  accountName: string;
  currency: string;
};

export type MasterCampaignsView = {
  period: MetaPeriod;
  campaigns: MasterCampaignRow[];
  clients: { id: string; name: string }[];
  notices: string[];
};

export type MetaPerformanceView = {
  organizationId: string | null;
  role: "master" | "client_admin" | "client_user";
  canConnect: boolean;
  canView: boolean;
  connectionStatus: MetaConnectionView["status"];
  lastError: string | null;
  accountId: string | null;
  accountName: string | null;
  currency: string;
  period: MetaPeriod;
  kpis: MetaKpis | null;
  previous: MetaKpis | null;
  previousReady: boolean;
  previousCampaigns: MetaCampaignSnapshot[];
  campaigns: MetaCampaignRow[];
  series: MetaResultSeries;
  days: MetaDayPoint[];
};
