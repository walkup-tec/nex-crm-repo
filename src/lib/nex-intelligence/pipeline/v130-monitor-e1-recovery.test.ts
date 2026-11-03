import assert from "node:assert/strict";
import type { NexMetaAnalysisV1 } from "@/lib/meta-export";
import type { MetaDataQualityReport } from "@/lib/nex-intelligence/quality/validate-export";
import { processMetaAiRecommendations } from "@/lib/nex-intelligence/validation/orchestrate";
import { buildBackendMetricTraceCatalog } from "@/lib/nex-intelligence/trace/build-catalog";
import { indexTracesById } from "@/lib/nex-intelligence/trace";
import { tryCmsE1PartialRecovery } from "@/lib/nex-intelligence/recovery/cms-e1";
import { renderStage1FromIntegrity } from "@/lib/nex-intelligence/publication/stage1-integrity";

const payload = {
  schema_version: "1.0.0",
  metadata: {
    source: "NEX",
    exported_at: "2026-11-03T12:00:00-03:00",
    currency: "BRL",
    data_status: "live",
    organization_id: "org-1",
    client_name: "Cliente",
  },
  account: { id: "act_1", name: "Conta" },
  period: { since: "2026-10-01", until: "2026-10-31", timezone: "America/Sao_Paulo" },
  attribution: { setting: "unified", note: "" },
  campaigns: [{
    id: "camp_1",
    name: "Campanha A",
    insights: {
      spend: 100,
      impressions: 1000,
      reach: 800,
      frequency: 1.25,
      clicks: 50,
      link_clicks: null,
      ctr: 5,
      link_ctr: null,
      cpc: 2,
      link_cpc: null,
      cpm: 100,
      results: 10,
      cost_per_result: 10,
    },
    daily_insights: [],
  }],
  adsets: [],
  ads: [],
  business_outcomes: {
    leads_received: null,
    qualified_leads: null,
    appointments: null,
    sales: null,
    revenue: null,
  },
  warnings: [],
} as unknown as NexMetaAnalysisV1;

const quality = {
  status: "PASS",
  engine_version: "1.3.0",
  protocol_version: "1.3.0",
  validated_at: "2026-11-03T15:00:00Z",
  checks: [],
  affected_metrics: [],
  compromised_metrics: [],
  verified_metrics: ["ctr", "cpc", "clicks", "impressions", "spend"],
  computed_metrics: {},
} as unknown as MetaDataQualityReport;

const catalog = buildBackendMetricTraceCatalog(payload, quality);
const traces = indexTracesById(catalog);
const ctr = catalog.records.find((row) => row.entity_id === "camp_1" && row.metric === "ctr");
const cpc = catalog.records.find((row) => row.entity_id === "camp_1" && row.metric === "cpc");
assert.ok(ctr && cpc);

function monitor(id: string, evidence: string[], traceIds = [ctr!.trace_id, cpc!.trace_id]) {
  return {
    id,
    entity_id: "camp_1",
    level: "campaign",
    indicators_used: ["ctr", "cpc"],
    evidence,
    hypothesis: null,
    confidence: "medium",
    recommended_action: "Monitorar CTR e CPC",
    action_kind: "monitor",
    validation_criterion: "Acompanhar CTR e CPC em períodos futuros",
    trace_ids: traceIds,
  };
}

// 1. evidence[] vazio não invalida MONITOR E1 com catálogo backend válido.
{
  const result = await processMetaAiRecommendations({
    rawText: JSON.stringify({
      format: "nex_intelligence_analysis_v1_3_0",
      observations: [],
      recommendations: [monitor("rec-empty", [])],
      executive_points: [],
    }),
    payload,
    quality,
    backendTraceability: catalog,
  });
  assert.ok(result.approved.some((row) => row.id === "rec-empty"));
  assert.ok(result.claimIr?.approved.some((row) => row.claim_id === "rec-empty" && row.operation === "MONITOR"));
  assert.match(result.publishedMarkdown, /Monitorar CTR e CPC/);
}

// 2. cms_e1_already_sufficient devolve recuperação canônica e evidência backend.
{
  const recovered = tryCmsE1PartialRecovery({
    ...monitor("rec-sufficient", ["texto livre dispensável"]),
    traces,
    payload,
    quality,
  });
  assert.equal(recovered.audit.reason, "cms_e1_already_sufficient");
  assert.equal(recovered.audit.applied, true);
  assert.ok(recovered.recovered);
  assert.ok(recovered.recovered!.evidence.every((line) => /Meta Marketing API; trace/.test(line)));
}

// 3. Etapa 1 NOT_VERIFIABLE expõe estado/código, sem classificação subjetiva.
{
  const notVerifiable = {
    ...quality,
    status: "NOT_VERIFIABLE",
    checks: [{
      code: "ACCOUNT_RESULTS_RECONCILE",
      metric: "results",
      state: "NOT_VERIFIABLE",
      level: "account",
      entity_id: null,
      description: "confiança média na reconciliação",
    }],
  } as MetaDataQualityReport;
  const stage1 = renderStage1FromIntegrity(payload, notVerifiable);
  assert.match(stage1, /ACCOUNT_RESULTS_RECONCILE/);
  assert.match(stage1, /NOT_VERIFIABLE/);
  assert.doesNotMatch(stage1, /confiança média/i);
}

// 4. Sem trace recuperável, a recomendação é omitida e o fallback é determinístico.
{
  const result = await processMetaAiRecommendations({
    rawText: JSON.stringify({
      format: "nex_intelligence_analysis_v1_3_0",
      observations: [],
      recommendations: [monitor("rec-unrecoverable", [], ["missing-trace"])],
      executive_points: [],
    }),
    payload,
    quality,
    backendTraceability: { version: catalog.version, records: [] },
  });
  assert.equal(result.claimIr?.approved.some((row) => row.claim_id === "rec-unrecoverable"), false);
  assert.doesNotMatch(result.publishedMarkdown, /rec-unrecoverable/);
  assert.match(result.publishedMarkdown, /Relatório técnico determinístico/);
}

console.log("v130-monitor-e1-recovery.test.ts: ok (4 cases)");
