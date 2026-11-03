import type { ValidatedClaimIR } from "@/lib/nex-intelligence/claim-ir/validate";
import type { AnalyticalStatus } from "@/lib/nex-intelligence/ai-output/types";

export type PublicationGateFailure = {
  code: string;
  detail: string;
};

const TRUNCATION_RE = /\[[^\]\n]*$|Eng\.\s*$/im;
const AI_FREE_TEXT_MARKERS = [
  /abaixo da m[eé]dia/i,
  /desempenho abaixo/i,
  /pode ser otimiz/i,
  /reavaliar o investimento/i,
  /acima do ideal/i,
  /perde efici/i,
];

function hasUnbalancedQuotes(markdown: string): boolean {
  return markdown.split("\n").some((line) => {
    const doubleQuotes = (line.match(/"/g) ?? []).length;
    const singleQuotes = (line.match(/'/g) ?? []).length;
    return doubleQuotes % 2 !== 0 || singleQuotes % 2 !== 0;
  });
}

export function runFinalPublicationGate(input: {
  markdown: string;
  approvedClaims: ValidatedClaimIR[];
  publishedClaimIds?: string[];
  stage1Source: "integrity";
  usedAiFreeText: boolean;
  analyticalStatusCandidate: AnalyticalStatus;
}): { ok: boolean; failures: PublicationGateFailure[]; analyticalStatus: AnalyticalStatus } {
  const failures: PublicationGateFailure[] = [];

  if (input.usedAiFreeText) {
    failures.push({ code: "AI_FREE_TEXT_IN_REPORT", detail: "texto analítico livre da IA no relatório" });
  }

  if (input.stage1Source !== "integrity") {
    failures.push({ code: "STAGE1_NOT_INTEGRITY", detail: "Etapa 1 sem proveniência de integridade" });
  }

  for (const section of [
    "## Etapa 1 — Validação dos dados",
    "## Etapa 2 — Análise independente",
    "## Etapa 3 — Recomendações",
    "## Etapa 4 — Resumo executivo",
  ]) {
    if (!input.markdown.includes(section)) {
      failures.push({ code: "MISSING_SECTION", detail: section });
    }
  }

  if (
    TRUNCATION_RE.test(input.markdown) ||
    /Nex Ads \[Eng\.(?!\s*WhatsApp\])/i.test(input.markdown) ||
    hasUnbalancedQuotes(input.markdown)
  ) {
    failures.push({ code: "TRUNCATED_TEXT", detail: "possível truncamento de texto ou nome" });
  }

  for (const marker of AI_FREE_TEXT_MARKERS) {
    if (marker.test(input.markdown)) {
      failures.push({ code: "FORBIDDEN_PHRASE", detail: String(marker) });
    }
  }

  const approvedIds = new Set(input.approvedClaims.map((claim) => claim.claim_id));
  for (const id of input.publishedClaimIds ?? []) {
    if (!approvedIds.has(id)) {
      failures.push({ code: "NON_APPROVED_PUBLISHED", detail: id });
    }
  }

  for (const claim of input.approvedClaims) {
    if (claim.verdict !== "APPROVED") {
      failures.push({ code: "NON_APPROVED_IN_SET", detail: claim.claim_id });
      continue;
    }
    if (
      (claim.operation === "PERIOD_COMPARISON" ||
        claim.operation === "ENTITY_COMPARISON" ||
        claim.operation === "QUALITATIVE_CLASSIFICATION") &&
      claim.evidence_level !== "E2" &&
      claim.evidence_level !== "E3"
    ) {
      failures.push({ code: "COMPARISON_WITHOUT_E2", detail: claim.claim_id });
    }
    if (
      (claim.operation === "STRATEGIC_TEST" || claim.operation === "CAUSAL_HYPOTHESIS") &&
      claim.evidence_level !== "E3"
    ) {
      failures.push({ code: "STRATEGIC_WITHOUT_E3", detail: claim.claim_id });
    }
    if (!claim.metric_refs.length) {
      failures.push({ code: "CLAIM_WITHOUT_TRACE", detail: claim.claim_id });
    }
  }

  if (failures.length) {
    return {
      ok: false,
      failures,
      analyticalStatus:
        input.analyticalStatusCandidate === "FAILED"
          ? "FAILED"
          : input.approvedClaims.some((c) => c.verdict === "APPROVED")
            ? "PARTIAL_VALIDATED"
            : "INSUFFICIENT_EVIDENCE",
    };
  }

  return { ok: true, failures: [], analyticalStatus: input.analyticalStatusCandidate };
}
