/** DTOs do painel NEX Intelligence (frontend). Valores ausentes = null, nunca zero inventado. */

export type MetricQuality = "PASS" | "WARNING" | "FAIL" | "NOT_VERIFIABLE" | "UNAVAILABLE";

export type MetricKey =
  | "results"
  | "cost_per_result"
  | "spend"
  | "ctr"
  | "cpc"
  | "cpm"
  | "clicks"
  | "impressions"
  | "reach"
  | "frequency";

export type DashboardMetric = {
  key: MetricKey;
  label: string;
  value: number | null;
  unit: "count" | "currency" | "ratio_pct" | "other";
  quality: MetricQuality;
  desirableDirection: "up" | "down" | "neutral";
  periodStart: string | null;
  periodEnd: string | null;
  sourceTraceIds: string[];
};

export type MetricComparison = {
  metricKey: MetricKey;
  before: DashboardMetric | null;
  after: DashboardMetric | null;
  absoluteDelta: number | null;
  relativeDeltaPercent: number | null;
  pointsDelta: number | null;
  comparisonStatus: "VALID" | "INSUFFICIENT" | "INCOMPARABLE";
  assessment: "IMPROVED" | "WORSENED" | "MIXED" | "INCONCLUSIVE" | "NOT_ASSESSED";
};

export type DailySeriesPoint = {
  date: string;
  results: number | null;
  spend: number | null;
  clicks: number | null;
  impressions: number | null;
  ctr: number | null;
  cpc: number | null;
  cpm: number | null;
  cost_per_result: number | null;
};

export type InsightItem = {
  kind: "performance" | "opportunity" | "next_step" | "monitor";
  title: string;
  body: string;
  evidenceLevel: "E1" | "E2" | "E3" | "E0" | null;
  claimId: string | null;
};

export type SuggestedTaskDetail = {
  primaryGoal: string | null;
  relatedGoals: string[];
  strategyType: string | null;
  entityNames: string[];
  diagnosisSummary: string | null;
  detectedProblem: string | null;
  opportunity: string | null;
  metricRows: Array<{
    metric: string;
    label: string;
    unit: string;
    cells: Array<{ entityId: string; entityName: string; value: number | null }>;
  }>;
  mechanism: string | null;
  expectedDirection: string | null;
  assumptions: string[];
  limitations: string[];
  actionSteps: string[];
  prerequisites: string[];
  executionLevel: string | null;
  successCriteria: string[];
  guardrailMetrics: string[];
  confidenceStatus: string | null;
  confidenceReasons: string[];
  category: "optimization" | "investigation" | "monitor";
};

export type SuggestedTask = {
  id: string;
  claimId: string;
  title: string;
  justification: string;
  priority: "high" | "medium" | "low";
  evidenceLevel: "E1" | "E2" | "E3" | "E0" | null;
  kind: "action" | "test" | "hypothesis" | "monitor";
  entityLevel: string | null;
  entityId: string | null;
  /** Nome amigável da entidade (campanha/conjunto/anúncio), quando resolvível. */
  entityName: string | null;
  detail: SuggestedTaskDetail | null;
  status: "PENDING" | "APPLIED" | "REJECTED" | "IN_PROGRESS";
  appliedAt: string | null;
};

export type OptimizationMarker = {
  id: string;
  entityId: string;
  entityLevel: "campaign" | "adset" | "ad" | "account";
  effectiveAt: string;
  type: string;
  description: string;
  responsibleUserId: string | null;
  responsibleName: string | null;
  communicationStatus: "none" | "pending" | "sent" | "failed";
};

export type CampaignOption = {
  id: string;
  name: string;
  objective: string | null;
  resultMetric: string | null;
  status?: string | null;
  statusGroup?: "Ativa" | "Inativa" | "Encerrada" | "Outro" | null;
};

export type IntelligenceDashboardView = {
  executionId: string | null;
  organizationId: string | null;
  clientName: string;
  accountId: string;
  accountName: string;
  campaignId: string | null;
  campaignName: string | null;
  resultEventLabel: string;
  periodStart: string | null;
  periodEnd: string | null;
  timezone: string;
  analyticalStatus: string | null;
  publicationStatus: string | null;
  protocolVersion: string | null;
  dataQualityStatus: string | null;
  currency: string;
  metrics: DashboardMetric[];
  comparisons: MetricComparison[];
  series: DailySeriesPoint[];
  insights: InsightItem[];
  tasks: SuggestedTask[];
  markers: OptimizationMarker[];
  campaigns: CampaignOption[];
  analysisMarkdown: string;
};
