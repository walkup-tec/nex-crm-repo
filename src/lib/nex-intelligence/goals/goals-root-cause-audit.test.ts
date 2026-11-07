/**
 * Testes diagnósticos A–O da auditoria de causa-raiz (objetivos → otimizações).
 * Documentam comportamento ATUAL vs invariante desejada. Não alteram produção.
 *
 * Rodar: npx tsx src/lib/nex-intelligence/goals/goals-root-cause-audit.test.ts
 */
import { attachDataQuality, validateMetaAnalysisData } from "@/lib/meta-data-quality";
import { metaAiUserPrompt } from "@/lib/meta-ai-prompt";
import { processClaimIRPipeline } from "@/lib/nex-intelligence/claim-ir/process";
import { validateClaimIR } from "@/lib/nex-intelligence/claim-ir/validate";
import {
  buildGoalsMultilevelFixture,
  withObjectives,
} from "@/lib/nex-intelligence/goals/fixtures/goals-multilevel-fixture";
import { composeGoalAnalysis } from "@/lib/nex-intelligence/goals/compose";
import { rankOpportunitiesByObjectives } from "@/lib/nex-intelligence/goals/rank";
import { validateAnalysisObjectives } from "@/lib/nex-intelligence/goals/validate";
import { buildMetricRegistry } from "@/lib/nex-intelligence/metrics/registry";
import { renderClaimIR } from "@/lib/nex-intelligence/report/renderers";
import { recoverClaimIRStructural } from "@/lib/nex-intelligence/recovery/transform";
import { indexTracesById } from "@/lib/nex-intelligence/trace";
import {
  buildBackendTraceabilityWithComparisons,
  buildValidatedComparisonRecords,
} from "@/lib/nex-intelligence/trace/build-comparisons";

type Finding = {
  id: string;
  title: string;
  invariant: string;
  pass: boolean;
  detail: string;
};

const findings: Finding[] = [];

function expectInvariant(
  id: string,
  title: string,
  invariant: string,
  pass: boolean,
  detail: string,
) {
  findings.push({ id, title, invariant, pass, detail });
  console.log(`[${pass ? "PASS" : "FAIL"}] ${id} — ${title}`);
  if (!pass) console.log(`         ${detail}`);
}

const fixture = buildGoalsMultilevelFixture();
const quality = validateMetaAnalysisData(fixture, {
  protocolVersion: "1.3.0",
  engineVersion: "1.3.0",
});

const objectives = validateAnalysisObjectives({
  selectedGoals: ["INCREASE_RESULTS", "DECREASE_COST_PER_RESULT"],
  primaryGoal: "INCREASE_RESULTS",
  resultEventKey: "onsite_conversion.messaging_conversation_started_7d",
  contractVersion: "1.0.0",
});
if (!objectives.ok) throw new Error(objectives.message);

const payload = attachDataQuality(withObjectives(fixture, objectives.value), quality);
const { catalog, comparisons } = buildBackendTraceabilityWithComparisons({
  payload,
  quality,
  objectives: objectives.value,
});
const traces = indexTracesById(catalog);
const registry = buildMetricRegistry(payload, quality);

const scalar = (entityId: string, metric: string) =>
  [...traces.values()].find(
    (row) =>
      row.trace_id.startsWith("nx-tr-") &&
      row.entity_id === entityId &&
      row.metric === metric,
  );

const resultsTrace = scalar("camp_eff", "results");
const cprTrace = scalar("camp_eff", "cost_per_result");
const ctrTrace = scalar("camp_eff", "ctr");
if (!ctrTrace) throw new Error("fixture precisa de nx-tr ctr camp_eff");

const resultsCmp = comparisons.find(
  (row) =>
    row.kind === "ENTITY" &&
    row.metric === "results" &&
    row.entity_level === "campaign" &&
    ((row.entity_id === "camp_eff" && row.other_entity_id === "camp_costly") ||
      (row.entity_id === "camp_costly" && row.other_entity_id === "camp_eff")),
);
const ctrCmp = comparisons.find(
  (row) =>
    row.kind === "ENTITY" &&
    row.metric === "ctr" &&
    row.entity_level === "campaign" &&
    ((row.entity_id === "camp_eff" && row.other_entity_id === "camp_costly") ||
      (row.entity_id === "camp_costly" && row.other_entity_id === "camp_eff")),
);
const cprCmp = comparisons.find(
  (row) =>
    row.kind === "ENTITY" &&
    row.metric === "cost_per_result" &&
    row.entity_level === "campaign" &&
    ((row.entity_id === "camp_eff" && row.other_entity_id === "camp_costly") ||
      (row.entity_id === "camp_costly" && row.other_entity_id === "camp_eff")),
);

// Pré-condição estrutural: assimetria catálogo escalar vs comparison
expectInvariant(
  "P0",
  "Scalar results/CPR devem existir quando comparisons results/CPR existem",
  "build-catalog não pode omitir nx-tr enquanto build-comparisons emite nx-cmp",
  Boolean(resultsTrace && cprTrace) || !(resultsCmp && cprCmp),
  `quality=${quality.status} compromised=${quality.compromised_metrics.join(",")} resultsTr=${resultsTrace?.trace_id ?? "MISSING"} cprTr=${cprTrace?.trace_id ?? "MISSING"} resultsCmp=${resultsCmp?.comparison_ref ?? "none"} cprCmp=${cprCmp?.comparison_ref ?? "none"}`,
);

// --- A: METRIC_VALUE(results) com trace de CTR ---
{
  const claim = validateClaimIR(
    {
      claim_id: "diag-A",
      operation: "METRIC_VALUE",
      entity_level: "campaign",
      entity_id: "camp_eff",
      args: { metric: "results" },
      metric_refs: [ctrTrace.trace_id],
      comparison_ref: null,
      hypothesis_ref: null,
      action_ref: null,
    },
    payload,
    quality,
    traces,
  );
  expectInvariant(
    "A",
    "METRIC_VALUE(results) com trace CTR deve ser rejeitado",
    "metric_refs deve ser compatível com args.metric",
    claim.verdict === "REJECTED",
    `atual=${claim.verdict} reasons=${claim.rejection_reasons.join("|")}`,
  );
}

// --- B: METRIC_VALUE com nx-cmp em metric_refs (caso estilo 741e2bc9) ---
{
  if (!resultsCmp || !ctrCmp) throw new Error("comparisons results/ctr ausentes");
  const claim = validateClaimIR(
    {
      claim_id: "diag-B",
      operation: "METRIC_VALUE",
      entity_level: "campaign",
      entity_id: resultsCmp.entity_id,
      args: { metric: "results" },
      metric_refs: [resultsCmp.comparison_ref, ctrCmp.comparison_ref],
      comparison_ref: null,
      hypothesis_ref: null,
      action_ref: null,
    },
    payload,
    quality,
    traces,
  );
  expectInvariant(
    "B",
    "METRIC_VALUE não pode usar nx-cmp-* em metric_refs",
    "comparisons só em comparison_ref; METRIC_VALUE exige nx-tr-* escalar",
    claim.verdict === "REJECTED",
    `atual=${claim.verdict} evidence=${claim.evidence_level} reasons=${claim.rejection_reasons.join("|") || "none"}`,
  );
}

// --- C: eventos incompatíveis ---
{
  const bad = comparisons.find(
    (row) =>
      (row.metric === "results" || row.metric === "cost_per_result") &&
      (row.entity_id === "camp_leads" || row.other_entity_id === "camp_leads"),
  );
  expectInvariant(
    "C",
    "Não comparar results/CPR entre eventos incompatíveis",
    "leftEvent === rightEvent para results/cost_per_result",
    bad === undefined,
    bad ? `encontrou ${bad.comparison_ref}` : "ok",
  );
}

// --- D: sem entrega ---
{
  const noDeliveryId = "camp_no_delivery_diag";
  const payloadD = structuredClone(payload) as typeof payload;
  payloadD.campaigns.push({
    ...payloadD.campaigns[0]!,
    id: noDeliveryId,
    name: "Sem entrega",
    insights: {
      spend: null as unknown as number,
      impressions: null as unknown as number,
      reach: null as unknown as number,
      frequency: null,
      clicks: null as unknown as number,
      link_clicks: null as unknown as number,
      ctr: null,
      link_ctr: null,
      cpc: null,
      link_cpc: null,
      cpm: null,
      results: null,
      cost_per_result: null,
    },
    daily_insights: [],
    result_metric: "onsite_conversion.messaging_conversation_started_7d",
  });
  const qualityD = validateMetaAnalysisData(payloadD, {
    protocolVersion: "1.3.0",
    engineVersion: "1.3.0",
  });
  const compsD = buildValidatedComparisonRecords({
    payload: payloadD,
    quality: qualityD,
    objectives: objectives.value,
  });
  const withEmpty = compsD.refs.find(
    (row) => row.entity_id === noDeliveryId || row.other_entity_id === noDeliveryId,
  );
  // Diagnóstico adicional: spend=0 (não null) ainda gera comparisons — documentado se aparecer.
  const payloadZero = structuredClone(payload) as typeof payload;
  payloadZero.campaigns.push({
    ...payloadZero.campaigns[0]!,
    id: "camp_zero_spend_diag",
    name: "Zero spend",
    insights: {
      ...payloadZero.campaigns[0]!.insights!,
      spend: 0,
      impressions: 0,
      clicks: 0,
      results: 0,
      cost_per_result: null,
      ctr: null,
      cpc: null,
      cpm: null,
    },
    daily_insights: [],
    result_metric: "onsite_conversion.messaging_conversation_started_7d",
  });
  const compsZero = buildValidatedComparisonRecords({
    payload: payloadZero,
    quality: validateMetaAnalysisData(payloadZero, {
      protocolVersion: "1.3.0",
      engineVersion: "1.3.0",
    }),
    objectives: objectives.value,
  });
  const zeroSpendCmp = compsZero.refs.find(
    (row) =>
      row.entity_id === "camp_zero_spend_diag" || row.other_entity_id === "camp_zero_spend_diag",
  );
  expectInvariant(
    "D",
    "Campanha sem métricas (null) não entra em comparison; spend=0 ainda pode entrar",
    "null ⇒ skip; zero numérico não é ausência",
    withEmpty === undefined,
    `nullPair=${withEmpty?.comparison_ref ?? "none"} zeroSpendPair=${zeroSpendCmp?.comparison_ref ?? "none"}`,
  );
}

// --- E: daily vs consolidated ---
{
  const messagingChecks = quality.checks.filter(
    (c) => c.code === "CAMPAIGN_RESULTS_DAILY_VS_CONSOLIDATED",
  );
  expectInvariant(
    "E",
    "Divergência daily×consolidado é detectada",
    "CAMPAIGN_RESULTS_DAILY_VS_CONSOLIDATED presente no quality report",
    messagingChecks.length > 0,
    `checks=${messagingChecks.length} states=${messagingChecks.map((c) => c.state).join(",")} quality=${quality.status}`,
  );
}

// --- F: STRATEGIC sem comparison ---
{
  const metricRef = (cprTrace ?? ctrTrace).trace_id;
  const pipe = processClaimIRPipeline({
    drafts: [
      {
        claim_id: "diag-F",
        operation: "STRATEGIC_TEST",
        entity_level: "campaign",
        entity_id: "camp_eff",
        args: {
          action_kind: "scale_budget",
          action: "redistribuir orçamento",
          hypothesis: "CPR alto relativo",
          validation_criterion: "CPR cai 10%",
        },
        metric_refs: [metricRef],
        comparison_ref: null,
        hypothesis_ref: null,
        action_ref: null,
      },
    ],
    payload,
    quality,
    backendTraceability: catalog,
    usedAiConclusions: true,
  });
  const keptStrategic = pipe.approved.some(
    (c) => c.claim_id === "diag-F" && c.operation === "STRATEGIC_TEST",
  );
  const becameMonitor = pipe.approved.some(
    (c) => c.operation === "MONITOR" && c.recovery_origin?.includes("strategic_to_monitor"),
  );
  expectInvariant(
    "F",
    "STRATEGIC_TEST sem comparison não sobrevive como E3",
    "sem comparison_ref ⇒ rejeita/recupera MONITOR",
    !keptStrategic && becameMonitor,
    `strategic=${keptStrategic} monitor=${becameMonitor} audits=${pipe.recovery_audits.map((a) => a.transform).join(",")}`,
  );
}

// --- G: STRATEGIC com comparison válida ---
{
  const entityId = cprCmp?.entity_id === "camp_costly" ? "camp_costly" : "camp_eff";
  const metricRef =
    scalar(entityId, "cost_per_result")?.trace_id ??
    scalar(entityId, "ctr")?.trace_id ??
    ctrTrace.trace_id;
  const comparisonRef = cprCmp?.comparison_ref ?? null;
  const pipe = processClaimIRPipeline({
    drafts: [
      {
        claim_id: "diag-G",
        operation: "STRATEGIC_TEST",
        entity_level: "campaign",
        entity_id: entityId,
        args: {
          action_kind: "scale_budget",
          action: "mover verba para campanha com melhor CPR",
          hypothesis: "eficiência relativa observável",
          validation_criterion: "CPR agregado cai",
        },
        metric_refs: [metricRef],
        comparison_ref: comparisonRef,
        hypothesis_ref: null,
        action_ref: null,
      },
    ],
    payload,
    quality,
    backendTraceability: catalog,
    usedAiConclusions: true,
  });
  const approved = pipe.approved.find((c) => c.claim_id === "diag-G");
  const scalarMetric = traces.get(metricRef)?.metric;
  const cmpMetric = comparisonRef ? traces.get(comparisonRef)?.metric : null;
  const metricsAligned = Boolean(scalarMetric && cmpMetric && scalarMetric === cmpMetric);
  // Invariante: E3 só com metric_refs e comparison_ref da MESMA métrica (idealmente do objetivo).
  // Se scalar CPR sumiu do catálogo, o sistema NÃO deveria aprovar E3 misturando CTR + comparison CPR.
  const approvedE3 =
    approved?.verdict === "APPROVED" && approved.evidence_level === "E3";
  const pass = metricsAligned ? Boolean(approvedE3) : !approvedE3;
  expectInvariant(
    "G",
    "E3 exige alinhamento métrica(scalar) ↔ métrica(comparison)",
    "proibir STRATEGIC_TEST E3 com metric_refs CTR + comparison_ref CPR",
    pass,
    `aligned=${metricsAligned} scalar=${scalarMetric} cmpMetric=${cmpMetric} verdict=${approved?.verdict} level=${approved?.evidence_level}`,
  );
}

// --- H: recovery ---
{
  const rejected = validateClaimIR(
    {
      claim_id: "diag-H",
      operation: "STRATEGIC_TEST",
      entity_level: "campaign",
      entity_id: "camp_eff",
      args: {
        action_kind: "scale_budget",
        action: "escalar",
        hypothesis: "x",
        validation_criterion: "y",
      },
      metric_refs: [ctrTrace.trace_id],
      comparison_ref: null,
      hypothesis_ref: null,
      action_ref: null,
    },
    payload,
    quality,
    traces,
  );
  const recovered = recoverClaimIRStructural(rejected, payload, quality, traces);
  const monitor = recovered.claims[0];
  expectInvariant(
    "H",
    "Recovery converte estratégico inválido em MONITOR",
    "strategic_or_causal_to_monitor; evidence ≤ E1",
    recovered.audit.transform === "strategic_or_causal_to_monitor" &&
      monitor?.operation === "MONITOR" &&
      (monitor.evidence_level === "E1" || monitor.evidence_level === "E0"),
    `transform=${recovered.audit.transform} op=${monitor?.operation} level=${monitor?.evidence_level}`,
  );
}

// --- I: renderer results indisponível ---
{
  const hasResultsRow = registry.some(
    (row) => row.entity_id === "camp_eff" && row.metric === "results",
  );
  // Claim sintético aprovado (mesmo se scalar results estiver ausente no catálogo)
  const synthetic: Parameters<typeof renderClaimIR>[0] = {
    claim_id: "diag-I",
    operation: "METRIC_VALUE",
    entity_level: "campaign",
    entity_id: "camp_eff",
    args: { metric: "results" },
    metric_refs: resultsTrace ? [resultsTrace.trace_id] : [resultsCmp!.comparison_ref],
    comparison_ref: null,
    hypothesis_ref: null,
    action_ref: null,
    verdict: "APPROVED",
    rejection_reasons: [],
    rejection_codes: [],
    evidence_level: "E1",
    required_evidence_level: "E1",
    claim_ir_version: "1.0.0",
    recovery_origin: null,
  };
  const text = renderClaimIR(synthetic, registry);
  const hasIndisponivel = /results \(indisponível\)/i.test(text);
  expectInvariant(
    "I",
    "METRIC_VALUE(results) aprovado não deve renderizar indisponível",
    "buildMetricRegistry deve expor results com value_present",
    hasResultsRow && !hasIndisponivel,
    `registryHasResults=${hasResultsRow} text=${JSON.stringify(text)}`,
  );
}

// --- J: influência dos objetivos ---
{
  const composed = composeGoalAnalysis(objectives.value);
  const prompt = metaAiUserPrompt(payload, catalog, comparisons);
  const hasObjectivesBlock = /Objetivos da análise/i.test(prompt);
  const hasRequiredMetrics = composed.requiredMetrics.every((m) => prompt.includes(m));
  const comparisonMetrics = new Set(comparisons.map((c) => c.metric));
  expectInvariant(
    "J",
    "Objetivos influenciam prompt + comparisons",
    "formatObjectivesForPrompt + métricas de objetivo nas comparisons",
    hasObjectivesBlock &&
      hasRequiredMetrics &&
      comparisonMetrics.has("results") &&
      comparisonMetrics.has("cost_per_result"),
    `block=${hasObjectivesBlock} metrics=${hasRequiredMetrics}`,
  );
}

// --- K: ranking primary ---
{
  const ranked = rankOpportunitiesByObjectives(
    [
      {
        id: "sec",
        relatedGoal: "DECREASE_COST_PER_RESULT",
        primaryMetric: "cost_per_result",
        evidenceLevel: "E3",
      },
      {
        id: "pri",
        relatedGoal: "INCREASE_RESULTS",
        primaryMetric: "results",
        evidenceLevel: "E2",
      },
    ],
    objectives.value,
  );
  expectInvariant(
    "K",
    "primaryGoal ordena oportunidades",
    "INCREASE_RESULTS precede mesmo com E2 < E3 do secundário",
    ranked[0]?.id === "pri",
    `ordem=${ranked.map((r) => r.id).join(">")}`,
  );
}

// --- L: multinível ---
{
  const adsetOk = comparisons.some((c) => c.entity_level === "adset");
  const adOk = comparisons.some((c) => c.entity_level === "ad");
  // Fixture atual pode omitir ad se pares não tiverem métrica recomputável sob quality.
  expectInvariant(
    "L",
    "Comparações adset existem; ad deve existir quando há pares com métrica",
    "nível adset obrigatório; ad desejável para motor multinível",
    adsetOk,
    `adset=${adsetOk} ad=${adOk} (ad=false é gap se fixture tiver ≥2 ads comparáveis)`,
  );
}

// --- M: zero vs ausente ---
{
  const zeroPayload = structuredClone(payload) as typeof payload;
  const camp = zeroPayload.campaigns.find((c) => c.id === "camp_eff")!;
  camp.insights = { ...camp.insights!, results: 0, cost_per_result: null };
  // Forçar quality limpa local: ainda usamos validate — o ponto é recompute/catalog.
  const qZ = validateMetaAnalysisData(zeroPayload, {
    protocolVersion: "1.3.0",
    engineVersion: "1.3.0",
  });
  // Patch quality to PASS for results so catalog keep logic is isolable
  const qPass = {
    ...qZ,
    status: "PASS" as const,
    compromised_metrics: [] as string[],
    affected_metrics: [] as string[],
    checks: qZ.checks.map((c) =>
      c.metric === "results" ? { ...c, state: "PASS" as const } : c,
    ),
  };
  const absentPayload = structuredClone(payload) as typeof payload;
  const campA = absentPayload.campaigns.find((c) => c.id === "camp_eff")!;
  campA.insights = { ...campA.insights!, results: null, cost_per_result: null };
  const qA = {
    ...validateMetaAnalysisData(absentPayload, {
      protocolVersion: "1.3.0",
      engineVersion: "1.3.0",
    }),
    status: "PASS" as const,
    compromised_metrics: [] as string[],
    affected_metrics: [] as string[],
  };

  const catZ = buildBackendTraceabilityWithComparisons({
    payload: zeroPayload,
    quality: qPass,
    objectives: objectives.value,
  });
  const catA = buildBackendTraceabilityWithComparisons({
    payload: absentPayload,
    quality: qA,
    objectives: objectives.value,
  });
  const zeroTr = catZ.catalog.records.find(
    (r) => r.entity_id === "camp_eff" && r.metric === "results" && r.trace_id.startsWith("nx-tr-"),
  );
  const absentTr = catA.catalog.records.find(
    (r) => r.entity_id === "camp_eff" && r.metric === "results" && r.trace_id.startsWith("nx-tr-"),
  );
  expectInvariant(
    "M",
    "Zero ≠ ausente no catálogo de results",
    "results=0 gera nx-tr; results=null não gera",
    zeroTr != null && zeroTr.calculation.result === 0 && absentTr == null,
    `zero=${zeroTr?.calculation.result} absent=${absentTr?.trace_id ?? "none"}`,
  );
}

// --- N: parcial ---
{
  const pipe = processClaimIRPipeline({
    drafts: [
      {
        claim_id: "diag-N-ok",
        operation: "METRIC_VALUE",
        entity_level: "campaign",
        entity_id: "camp_eff",
        args: { metric: "ctr" },
        metric_refs: [ctrTrace.trace_id],
        comparison_ref: null,
        hypothesis_ref: null,
        action_ref: null,
      },
      {
        claim_id: "diag-N-bad",
        operation: "STRATEGIC_TEST",
        entity_level: "campaign",
        entity_id: "camp_eff",
        args: {
          action_kind: "other",
          action: "otimizar",
          hypothesis: "h",
          validation_criterion: "c",
        },
        metric_refs: [ctrTrace.trace_id],
        comparison_ref: null,
        hypothesis_ref: null,
        action_ref: null,
      },
    ],
    payload,
    quality,
    backendTraceability: catalog,
    usedAiConclusions: true,
  });
  expectInvariant(
    "N",
    "Publicação parcial com recovery audit",
    "aprovados + recovery strategic_to_monitor",
    pipe.approved.length > 0 &&
      pipe.recovery_audits.some((a) => a.transform === "strategic_or_causal_to_monitor"),
    `status=${pipe.analytical_status} approved=${pipe.approved.length} audits=${pipe.recovery_audits.map((a) => a.transform).join(",")}`,
  );
}

// --- O: MONITOR ≠ otimização ---
{
  const pipe = processClaimIRPipeline({
    drafts: [
      {
        claim_id: "diag-O-mon",
        operation: "MONITOR",
        entity_level: "campaign",
        entity_id: "camp_eff",
        args: {
          metrics: ["ctr"],
          validation_criterion: {
            type: "PERIODIC_REVIEW",
            metrics: ["ctr"],
            comparison: "SAME_METRIC_FUTURE_PERIOD",
          },
        },
        metric_refs: [ctrTrace.trace_id],
        comparison_ref: null,
        hypothesis_ref: null,
        action_ref: null,
      },
    ],
    payload,
    quality,
    backendTraceability: catalog,
    usedAiConclusions: true,
  });
  const mon = pipe.approved.find((c) => c.claim_id === "diag-O-mon");
  const md = pipe.recommendations_markdown;
  expectInvariant(
    "O",
    "MONITOR publicado ≠ otimização aplicável",
    "texto de monitoramento; sem STRATEGIC_TEST mascarado",
    Boolean(mon) && /Monitorar/i.test(md) && !/teste estratégico/i.test(md),
    `op=${mon?.operation} md=${JSON.stringify(md.slice(0, 140))}`,
  );
}

// --- C2: integrity global ---
{
  if (quality.status === "NOT_VERIFIABLE") {
    const ctrIntegrity = registry.find(
      (r) => r.entity_id === "camp_eff" && r.metric === "ctr",
    )?.integrity;
    expectInvariant(
      "C2",
      "NOT_VERIFIABLE global não deve invalidar CTR independente",
      "integrityFor por métrica afetada",
      ctrIntegrity === "PASS" || ctrIntegrity === "WARNING",
      `ctrIntegrity=${ctrIntegrity}`,
    );
  } else {
    expectInvariant("C2", "Sem NOT_VERIFIABLE global nesta fixture", "n/a", true, `quality=${quality.status}`);
  }
}

const passed = findings.filter((f) => f.pass).length;
const failed = findings.filter((f) => !f.pass).length;
console.log("\n=== RESUMO DIAGNÓSTICO ===");
console.log(`Total=${findings.length} PASS=${passed} FAIL=${failed}`);
for (const f of findings.filter((x) => !x.pass)) {
  console.log(`- ${f.id}: ${f.invariant}`);
  console.log(`  ${f.detail}`);
}

if (failed > 0) {
  console.log("\nFAIL documenta lacunas reais do motor (auditoria). Correção só após aprovação.");
  process.exit(1);
}
process.exit(0);
