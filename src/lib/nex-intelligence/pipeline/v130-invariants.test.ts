/**
 * Invariantes v1.3.0 — fixtures determinísticas (sem Meta/OpenAI).
 */
import assert from "node:assert/strict";
import { processClaimIRPipeline } from "@/lib/nex-intelligence/claim-ir/process";
import { validateClaimIR } from "@/lib/nex-intelligence/claim-ir/validate";
import { recoverClaimIRStructural } from "@/lib/nex-intelligence/recovery/transform";
import { renderApprovedClaimsIR, renderExecutiveFromApprovedIR } from "@/lib/nex-intelligence/report/renderers";
import {
  assertPublishable,
  canTransitionExecution,
  canTransitionPublication,
  deriveAnalyticalStatus,
  transitionPublication,
} from "@/lib/nex-intelligence/pipeline/state-machine";
import { buildMetricRegistry } from "@/lib/nex-intelligence/metrics/registry";
import { buildChatgptMetaAnalysisPayload } from "@/lib/nex-intelligence/integrations/chatgpt/payload";
import { NEX_INTELLIGENCE_PROTOCOL_VERSION } from "@/lib/nex-intelligence/versions";
import type { NexMetaAnalysisV1 } from "@/lib/meta-export";
import type { MetaDataQualityReport } from "@/lib/nex-intelligence/quality/validate-export";
import { indexTracesById, type MetricTraceRecord, type MetricTraceability } from "@/lib/nex-intelligence/trace";

const quality = {
  status: "PASS",
  engine_version: "1.3.0",
  protocol_version: "1.3.0",
  validated_at: "2026-01-01T00:00:00Z",
  checks: [],
  affected_metrics: [],
  compromised_metrics: [],
  verified_metrics: ["ctr", "cpc", "cpm", "impressions", "clicks", "spend"],
  computed_metrics: {} as MetaDataQualityReport["computed_metrics"],
} as MetaDataQualityReport;

const payload = {
  schema_version: "1.0.0",
  account: { id: "act_1", name: "Conta", metrics: { impressions: 1000, clicks: 50, spend: 100, results: 5 } },
  period: { since: "2026-01-01", until: "2026-01-07", timezone: "America/Sao_Paulo" },
  campaigns: [
    {
      id: "camp_1",
      name: "Campanha A",
      metrics: { impressions: 1000, clicks: 50, spend: 100, results: 5, ctr: 5 },
    },
  ],
  adsets: [],
  ads: [],
  metadata: { client_name: "Test", source: "NEX" },
} as unknown as NexMetaAnalysisV1;

const traceRow: MetricTraceRecord = {
  trace_id: "nx-tr-camp_1-ctr",
  entity_level: "campaign",
  entity_id: "camp_1",
  metric: "ctr",
  source: "META_MARKETING_API",
  source_level: "campaign",
  source_field: "ctr",
  period: { since: "2026-01-01", until: "2026-01-07" },
  calculation: {
    type: "RATIO",
    formula: "clicks/impressions*100",
    inputs: { clicks: 50, impressions: 1000 },
    result: 5,
  },
  validation: { status: "PASS", dependencies: ["clicks", "impressions"] },
  used_by: [],
};

const catalog: MetricTraceability = {
  version: "1.0",
  records: [traceRow],
};

const traces = indexTracesById(catalog);

// 1. Claim publicado exige trace válido
{
  const bad = validateClaimIR(
    {
      claim_id: "c1",
      operation: "METRIC_VALUE",
      entity_level: "campaign",
      entity_id: "camp_1",
      args: { metric: "ctr" },
      metric_refs: ["missing"],
      comparison_ref: null,
    },
    payload,
    quality,
    traces,
  );
  assert.equal(bad.verdict, "REJECTED");
  assert.ok(bad.rejection_codes.includes("TRACE_NOT_FOUND"));
}

// 2. E2 exige comparison_ref
{
  const bad = validateClaimIR(
    {
      claim_id: "c2",
      operation: "PERIOD_COMPARISON",
      entity_level: "campaign",
      entity_id: "camp_1",
      args: {
        metric: "ctr",
        baseline_period: "prev",
        current_period: "curr",
        operator: "delta_pct",
      },
      metric_refs: ["nx-tr-camp_1-ctr"],
      comparison_ref: null,
    },
    payload,
    quality,
    traces,
  );
  assert.equal(bad.verdict, "REJECTED");
  assert.ok(bad.rejection_codes.includes("COMPARISON_NOT_VALIDATED"));
}

// 3. E3 estratégico sem refs → rejeitado
{
  const bad = validateClaimIR(
    {
      claim_id: "c3",
      operation: "STRATEGIC_TEST",
      entity_level: "campaign",
      entity_id: "camp_1",
      args: {
        action_kind: "test",
        action: "testar criativo",
        hypothesis: "h",
        validation_criterion: "ctr sobe",
      },
      metric_refs: [],
      comparison_ref: null,
    },
    payload,
    quality,
    traces,
  );
  assert.equal(bad.verdict, "REJECTED");
}

// 4. Texto livre da IA não entra no relatório (renderer só IR)
{
  const ok = validateClaimIR(
    {
      claim_id: "c4",
      operation: "METRIC_VALUE",
      entity_level: "campaign",
      entity_id: "camp_1",
      args: { metric: "ctr" },
      metric_refs: ["nx-tr-camp_1-ctr"],
      comparison_ref: null,
    },
    payload,
    quality,
    traces,
  );
  assert.equal(ok.verdict, "APPROVED");
  const md = renderApprovedClaimsIR([ok], buildMetricRegistry(payload, quality));
  assert.ok(!md.includes("texto livre inventado pela IA"));
  assert.ok(md.toLowerCase().includes("ctr"));
}

// 5. Recovery não sobe evidência
{
  const rejected = validateClaimIR(
    {
      claim_id: "c5",
      operation: "STRATEGIC_TEST",
      entity_level: "campaign",
      entity_id: "camp_1",
      args: {
        action_kind: "pause",
        action: "pausar",
        hypothesis: "h",
        validation_criterion: "x",
      },
      metric_refs: ["nx-tr-camp_1-ctr"],
      comparison_ref: null,
    },
    payload,
    quality,
    traces,
  );
  const { claims, audit } = recoverClaimIRStructural(rejected, payload, quality, traces);
  assert.equal(audit.transform, "strategic_or_causal_to_monitor");
  if (claims[0]) {
    assert.equal(claims[0].operation, "MONITOR");
    assert.equal(claims[0].evidence_level, "E1");
    assert.notEqual(claims[0].evidence_level, "E3");
  }
}

// 6. Resumo não introduz claim novo (só IDs aprovados)
{
  const processed = processClaimIRPipeline({
    drafts: [
      {
        claim_id: "obs-1",
        operation: "METRIC_VALUE",
        entity_level: "campaign",
        entity_id: "camp_1",
        args: { metric: "ctr" },
        metric_refs: ["nx-tr-camp_1-ctr"],
      },
    ],
    payload,
    quality,
    backendTraceability: catalog,
    usedAiConclusions: true,
  });
  const exec = renderExecutiveFromApprovedIR(processed.approved, processed.registry);
  for (const id of processed.executive_claim_ids) {
    assert.ok(processed.approved.some((c) => c.claim_id === id));
  }
  assert.ok(exec.length > 0);
}

// 7. Trace de outra entidade rejeitado
{
  const bad = validateClaimIR(
    {
      claim_id: "c7",
      operation: "METRIC_VALUE",
      entity_level: "campaign",
      entity_id: "camp_OTHER",
      args: { metric: "ctr" },
      metric_refs: ["nx-tr-camp_1-ctr"],
      comparison_ref: null,
    },
    payload,
    quality,
    traces,
  );
  assert.equal(bad.verdict, "REJECTED");
  assert.ok(
    bad.rejection_codes.includes("TRACE_ENTITY_MISMATCH") ||
      bad.rejection_reasons.some((r) => r.includes("entity")),
  );
}

// 8. Publish bloqueado se FAILED
{
  assert.throws(() =>
    assertPublishable({
      execution_status: "succeeded",
      analytical_status: "FAILED",
      data_quality_status: "PASS",
      publication_status: "pending_persist",
    }),
  );
  assert.equal(canTransitionPublication("failed_persist", "published"), false);
  assert.equal(canTransitionExecution("failed", "succeeded"), false);
}

// 9. Métricas independentes: CTR local PASS mesmo com warning de outra métrica
{
  const q2 = {
    ...quality,
    status: "WARNING",
    affected_metrics: ["onsite_conversion.messaging_conversation_started_7d"],
  } as MetaDataQualityReport;
  const reg = buildMetricRegistry(payload, q2);
  const ctr = reg.find((r) => r.entity_id === "camp_1" && r.metric === "ctr");
  assert.ok(ctr);
  assert.equal(ctr!.integrity, "PASS");
}

// 10. Métrica inválida ≠ PASS no relatório IR
{
  const bad = validateClaimIR(
    {
      claim_id: "c10",
      operation: "QUALITATIVE_CLASSIFICATION",
      entity_level: "campaign",
      entity_id: "camp_1",
      args: { metric: "ctr", label: "razoável", criterion: "opinião" },
      metric_refs: ["nx-tr-camp_1-ctr"],
      comparison_ref: null,
    },
    payload,
    quality,
    traces,
  );
  assert.equal(bad.verdict, "REJECTED");
  const md = renderApprovedClaimsIR([bad], []);
  assert.equal(md, "_Nenhuma afirmação verificável._");
}

// Operação desconhecida
{
  const bad = validateClaimIR(
    { claim_id: "x", operation: "MAGIC", entity_level: "account", args: {}, metric_refs: [] },
    payload,
    quality,
    traces,
  );
  assert.equal(bad.verdict, "REJECTED");
  assert.ok(bad.rejection_codes.includes("UNSUPPORTED_OPERATION"));
}

assert.equal(
  deriveAnalyticalStatus({
    approvedCount: 0,
    discardedOrRejected: 1,
    usedAiConclusions: false,
    usedFallbackOnly: false,
    technicalFailure: false,
  }),
  "INSUFFICIENT_EVIDENCE",
);

assert.equal(transitionPublication("pending_persist", "published"), "published");

{
  const detail = {
    id: "exec-1",
    createdAt: "2026-01-01T00:00:00Z",
    status: "ok",
    organizationId: "org",
    clientName: "C",
    accountId: "act_1",
    accountName: "A",
    periodSince: "2026-01-01",
    periodUntil: "2026-01-07",
    periodTimezone: "America/Sao_Paulo",
    model: "test",
    promptHash: "abc",
    protocolVersion: NEX_INTELLIGENCE_PROTOCOL_VERSION,
    dataContractVersion: "1.2.0",
    analysisMarkdown: "# ok",
    warnings: [],
    errorMessage: "",
    inputJson: payload,
    outputJson: {
      publication_status: "failed_persist",
      report: { markdown: "SECRETO" },
      analysis_markdown: "SECRETO",
    },
  };
  const blocked = buildChatgptMetaAnalysisPayload(detail as never);
  assert.equal(blocked.report?.markdown, null);
  assert.equal(blocked.ai_analysis.markdown, null);

  const legacy = buildChatgptMetaAnalysisPayload({
    ...detail,
    outputJson: {
      report: { markdown: "legado ok" },
      analysis_markdown: "legado ok",
    },
  } as never);
  assert.equal(legacy.report?.markdown, "legado ok");
  assert.equal(legacy.tool, "get_meta_analysis_execution");
}

console.log("v130-invariants.test.ts: ok");
