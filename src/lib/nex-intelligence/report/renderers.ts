import type { ValidatedClaimIR } from "@/lib/nex-intelligence/claim-ir/validate";
import type { MetricRegistryEntry } from "@/lib/nex-intelligence/metrics/registry";

function formatValue(entry: MetricRegistryEntry | undefined, metric: string): string {
  if (!entry || !entry.value_present || entry.value == null) return `${metric} (indisponível)`;
  const value = entry.value.toLocaleString("pt-BR", {
    maximumFractionDigits: entry.unit === "ratio_pct" ? Math.min(2, entry.precision) : entry.precision,
  });
  if (entry.unit === "ratio_pct") return `${metric.toUpperCase()} de ${value}%`;
  if (entry.unit === "currency") return `${metric.toUpperCase()} de ${value}`;
  return `${metric} = ${value}`;
}

function lookup(
  registry: MetricRegistryEntry[],
  entityId: string | null,
  metric: string,
): MetricRegistryEntry | undefined {
  if (!entityId) return registry.find((r) => r.metric === metric && r.entity_level === "account");
  return registry.find((r) => r.entity_id === entityId && r.metric === metric);
}

/** Renderizadores determinísticos — nenhum texto livre da IA. */
export function renderClaimIR(
  claim: ValidatedClaimIR,
  registry: MetricRegistryEntry[] = [],
): string {
  if (claim.verdict !== "APPROVED") return "";

  switch (claim.operation) {
    case "METRIC_VALUE": {
      const metric = claim.args.metric;
      const entry = lookup(registry, claim.entity_id, metric);
      const where = claim.entity_id
        ? ` (${claim.entity_level} ${entry?.entity_name ? `“${entry.entity_name}” ` : ""}\`${claim.entity_id}\`)`
        : " (conta)";
      return `- ${formatValue(entry, metric)} no período analisado${where}.`;
    }
    case "PERIOD_COMPARISON": {
      if (claim.evidence_level !== "E2" && claim.evidence_level !== "E3") return "";
      const { metric, operator, baseline_period, current_period } = claim.args;
      return `- Comparação de ${metric} (${operator}) entre ${baseline_period} e ${current_period} (ref \`${claim.comparison_ref}\`).`;
    }
    case "ENTITY_COMPARISON": {
      if (claim.evidence_level !== "E2" && claim.evidence_level !== "E3") return "";
      const { metric, other_entity_id, operator } = claim.args;
      return `- Comparação de ${metric} (${operator}) com entidade \`${other_entity_id}\` (ref \`${claim.comparison_ref}\`).`;
    }
    case "QUALITATIVE_CLASSIFICATION": {
      if (claim.evidence_level !== "E2" && claim.evidence_level !== "E3") return "";
      const { metric } = claim.args;
      return `- Classificação comparativa de ${metric} validada pela referência \`${claim.comparison_ref}\`.`;
    }
    case "CAUSAL_HYPOTHESIS": {
      if (claim.evidence_level !== "E3") return "";
      return `- Hipótese causal rastreável aprovada (ref \`${claim.hypothesis_ref}\`).`;
    }
    case "MONITOR": {
      if (claim.evidence_level !== "E1" && claim.evidence_level !== "E2" && claim.evidence_level !== "E3") {
        return "";
      }
      // MONITOR E1 não pode conter intervenção — só métricas
      const metrics = claim.args.metrics.map((metric) => metric.toUpperCase());
      const metricLabel =
        metrics.length > 1
          ? `${metrics.slice(0, -1).join(", ")} e ${metrics.at(-1)}`
          : metrics[0] ?? "métricas";
      const entity = lookup(registry, claim.entity_id, claim.args.metrics[0] ?? "");
      const scope =
        claim.entity_level === "campaign" && entity?.entity_name
          ? ` da campanha ${entity.entity_name}`
          : claim.entity_id
            ? ` (${claim.entity_level} \`${claim.entity_id}\`)`
            : "";
      return `- Monitorar ${metricLabel}${scope} nos próximos períodos (${claim.args.validation_criterion.type}).`;
    }
    case "STRATEGIC_TEST": {
      if (claim.evidence_level !== "E3") return "";
      return `- Executar teste estratégico controlado (${claim.args.action_kind}) com validação e reversão vinculadas às evidências E3 aprovadas.`;
    }
    default:
      return "";
  }
}

export function renderApprovedClaimsIR(
  claims: ValidatedClaimIR[],
  registry: MetricRegistryEntry[] = [],
  emptyLabel = "_Nenhuma afirmação verificável._",
): string {
  const lines = claims
    .filter((c) => c.verdict === "APPROVED")
    .map((c) => renderClaimIR(c, registry))
    .filter(Boolean);
  return lines.length ? lines.join("\n") : emptyLabel;
}

/** Resumo executivo = projeção dos aprovados (sem afirmação nova). */
export function renderExecutiveFromApprovedIR(
  approved: ValidatedClaimIR[],
  registry: MetricRegistryEntry[] = [],
): string {
  const projected = approved.filter(
    (c) =>
      c.operation === "METRIC_VALUE" ||
      c.operation === "MONITOR" ||
      c.operation === "PERIOD_COMPARISON" ||
      c.operation === "ENTITY_COMPARISON" ||
      (c.operation === "STRATEGIC_TEST" && c.evidence_level === "E3"),
  );
  return renderApprovedClaimsIR(
    projected,
    registry,
    "_Sem conclusões verificáveis disponíveis._",
  );
}
