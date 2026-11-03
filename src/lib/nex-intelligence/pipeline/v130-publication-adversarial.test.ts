import assert from "node:assert/strict";
import { normalizeClaimIRDraft } from "@/lib/nex-intelligence/claim-ir/normalize-from-ai";
import { processClaimIRPipeline } from "@/lib/nex-intelligence/claim-ir/process";
import { validateClaimIR } from "@/lib/nex-intelligence/claim-ir/validate";
import { buildValidatedReport } from "@/lib/nex-intelligence/publication/build-validated-report";
import { runFinalPublicationGate } from "@/lib/nex-intelligence/publication/final-gate";
import { markPersistedOutputPublished } from "@/lib/nex-intelligence/persistence/build-analytical-output";
import { buildChatgptMetaAnalysisPayload } from "@/lib/nex-intelligence/integrations/chatgpt/payload";
import { renderExecutiveFromApprovedIR } from "@/lib/nex-intelligence/report/renderers";
import { indexTracesById, type MetricTraceability } from "@/lib/nex-intelligence/trace";
import type { MetaDataQualityReport } from "@/lib/nex-intelligence/quality/validate-export";
import type { NexMetaAnalysisV1 } from "@/lib/meta-export";

const payload = {
  schema_version: "1.0.0",
  account: { id: "act_1", name: "Conta" },
  period: { since: "2026-10-01", until: "2026-10-31", timezone: "America/Sao_Paulo" },
  campaigns: [{
    id: "camp_1",
    name: "Nex Ads [Eng. WhatsApp]",
    insights: { impressions: 1000, clicks: 50, ctr: 5, spend: 100, cpc: 2 },
  }],
  adsets: [],
  ads: [],
  metadata: { source: "NEX", client_name: "Cliente" },
} as unknown as NexMetaAnalysisV1;

const quality = {
  status: "PASS",
  engine_version: "1.3.0",
  protocol_version: "1.3.0",
  validated_at: "2026-11-03T00:00:00Z",
  checks: [],
  affected_metrics: [],
  compromised_metrics: [],
  verified_metrics: ["entity_id", "ctr"],
  computed_metrics: {},
} as unknown as MetaDataQualityReport;

const catalog: MetricTraceability = {
  version: "1.0",
  records: [{
    trace_id: "tr-ctr",
    entity_level: "campaign",
    entity_id: "camp_1",
    metric: "ctr",
    source: "META_MARKETING_API",
    source_level: "campaign",
    source_field: "insights.ctr",
    period: { since: "2026-10-01", until: "2026-10-31" },
    calculation: {
      type: "RATIO",
      formula: "clicks/impressions*100",
      inputs: { clicks: 50, impressions: 1000 },
      result: 5,
    },
    validation: {
      status: "PASS",
      dependencies: ["clicks", "impressions"],
      check_codes: [],
      reason: null,
    },
    used_by: [],
  }],
};
const traces = indexTracesById(catalog);
const metricDraft = {
  claim_id: "metric-1",
  operation: "METRIC_VALUE",
  entity_level: "campaign",
  entity_id: "camp_1",
  args: { metric: "ctr" },
  metric_refs: ["tr-ctr"],
  comparison_ref: null,
};

const ir = processClaimIRPipeline({
  drafts: [metricDraft],
  payload,
  quality,
  backendTraceability: catalog,
  usedAiConclusions: true,
});
const report = buildValidatedReport({
  payload,
  quality,
  claimIr: ir,
  discardedOrRejected: 0,
  parseOk: true,
});

// 1–2: Etapa 1 é estruturada e nome completo não é truncado.
assert.match(report.markdown, /Período analisado/);
assert.ok(!report.markdown.includes("MARKDOWN IA TRUNCADO [Eng."));
assert.ok(!report.markdown.includes("Métricas verificáveis (PASS): entity_id"));
assert.doesNotMatch(report.markdown, /Indicadores locais disponíveis[^\n]*entity_id/);

// Regressão Stage 4: N observações numéricas viram uma síntese agregada.
const executive = renderExecutiveFromApprovedIR(
  ["camp_1", "camp_2", "camp_3", "camp_4"].map((entityId, index) => ({
    ...ir.approved[0]!,
    claim_id: `metric-${index + 1}`,
    entity_id: entityId,
  })),
  ir.registry,
  quality,
);
assert.match(executive, /4 entidades analisadas com indicadores verificáveis de CTR/);
assert.equal((executive.match(/\bCTR\b/g) ?? []).length, 1);
assert.doesNotMatch(executive, /CTR de \d/);

// 3: “abaixo da média” não permanece METRIC_VALUE/E1.
const normalized = normalizeClaimIRDraft({
  id: "bad-average",
  level: "campaign",
  entity_id: "camp_1",
  metrics_used: ["ctr"],
  trace_ids: ["tr-ctr"],
  claim_kind: "descriptive",
  text: "CTR abaixo da média das campanhas",
}) as { operation: string };
assert.equal(normalized.operation, "QUALITATIVE_CLASSIFICATION");

// 4–5: E2 sem comparação ou com ref inventada é rejeitado.
for (const comparison_ref of [null, "fake-comparison"]) {
  const row = validateClaimIR({
    claim_id: `cmp-${comparison_ref ?? "none"}`,
    operation: "QUALITATIVE_CLASSIFICATION",
    entity_level: "campaign",
    entity_id: "camp_1",
    args: { metric: "ctr", label: "baixo", criterion: "média" },
    metric_refs: ["tr-ctr"],
    comparison_ref,
  }, payload, quality, traces);
  assert.equal(row.verdict, "REJECTED");
}

// 6: trace de métrica diferente não prova o claim.
assert.equal(validateClaimIR({
  ...metricDraft,
  claim_id: "metric-mismatch",
  args: { metric: "cpc" },
}, payload, quality, traces).verdict, "REJECTED");

// 7–8: estratégico E1 é rebaixado a MONITOR neutro, nunca publica a ação.
const recovered = processClaimIRPipeline({
  drafts: [{
    claim_id: "strategic-e1",
    operation: "STRATEGIC_TEST",
    entity_level: "campaign",
    entity_id: "camp_1",
    args: {
      action_kind: "pause",
      action: "PAUSAR CAMPANHA AGORA",
      hypothesis: "queda",
      validation_criterion: "ctr",
    },
    metric_refs: ["tr-ctr"],
    comparison_ref: null,
  }],
  payload,
  quality,
  backendTraceability: catalog,
  usedAiConclusions: true,
});
assert.equal(recovered.approved[0]?.operation, "MONITOR");
assert.ok(!recovered.recommendations_markdown.includes("PAUSAR CAMPANHA AGORA"));

// 9–11: gate bloqueia texto livre, truncamento e ID não aprovado.
for (const gate of [
  runFinalPublicationGate({
    markdown: report.markdown,
    approvedClaims: ir.approved,
    stage1Source: "integrity",
    usedAiFreeText: true,
    analyticalStatusCandidate: "COMPLETED",
  }),
  runFinalPublicationGate({
    markdown: `${report.markdown}\nNex Ads [Eng.`,
    approvedClaims: ir.approved,
    stage1Source: "integrity",
    usedAiFreeText: false,
    analyticalStatusCandidate: "COMPLETED",
  }),
  runFinalPublicationGate({
    markdown: report.markdown,
    approvedClaims: ir.approved,
    publishedClaimIds: ["not-approved"],
    stage1Source: "integrity",
    usedAiFreeText: false,
    analyticalStatusCandidate: "COMPLETED",
  }),
]) {
  assert.equal(gate.ok, false);
  assert.notEqual(gate.analyticalStatus, "COMPLETED");
}

// 12–13: gate aprovado ainda não publica; promoção exige pending_persist + gate ok.
assert.equal(report.publicationStatus, "pending_persist");
assert.equal(report.gate.ok, true);
assert.throws(() => markPersistedOutputPublished({
  publication_status: "not_ready",
  analytical_status: "PARTIAL_VALIDATED",
  publication_gate: { ok: false, failures: [] },
} as never));

// 14–15: plugin preserva contrato/tool e oculta pending_persist.
const detail = {
  id: "exec-adv",
  createdAt: "2026-11-03T00:00:00Z",
  status: "partial",
  organizationId: "org",
  clientName: "Cliente",
  accountId: "act_1",
  accountName: "Conta",
  periodSince: "2026-10-01",
  periodUntil: "2026-10-31",
  periodTimezone: "America/Sao_Paulo",
  model: "test",
  promptHash: "hash",
  protocolVersion: "1.3.0",
  dataContractVersion: "1.2.0",
  analysisMarkdown: "NÃO EXPOR",
  warnings: [],
  errorMessage: "",
  inputJson: payload,
  outputJson: { publication_status: "pending_persist", report: { markdown: "NÃO EXPOR" } },
};
const chatgpt = buildChatgptMetaAnalysisPayload(detail as never);
assert.equal(chatgpt.tool, "get_meta_analysis_execution");
assert.equal(chatgpt.report?.markdown, null);

console.log("v130-publication-adversarial.test.ts: ok (15 cases)");
