import { composeGoalAnalysis } from "@/lib/nex-intelligence/goals/compose";
import { ANALYSIS_GOAL_LABELS } from "@/lib/nex-intelligence/goals/types";
import type { AnalysisObjectives } from "@/lib/nex-intelligence/goals/types";

/** Bloco de contexto de objetivos para o prompt do motor (composição dinâmica). */
export function formatObjectivesForPrompt(objectives: AnalysisObjectives): string {
  const composed = composeGoalAnalysis(objectives);
  const lines: string[] = [
    "## Objetivos da análise (obrigatório orientar investigação e recomendações)",
    `Contrato: ${objectives.contractVersion ?? "1.0.0"}`,
    `Objetivos selecionados: ${objectives.selectedGoals
      .map((code) => `${code} (${ANALYSIS_GOAL_LABELS[code]})`)
      .join("; ")}`,
    `Objetivo prioritário: ${objectives.primaryGoal} (${ANALYSIS_GOAL_LABELS[objectives.primaryGoal]}) — priorize recomendações que o favoreçam; declare trade-offs com os demais.`,
  ];

  if (objectives.resultEventKey) {
    lines.push(`Evento de resultado analisado: ${objectives.resultEventKey}`);
  } else {
    lines.push(
      "Evento de resultado: use result_metric das campanhas do export; não agregue eventos incompatíveis.",
    );
  }

  if (objectives.targets?.length) {
    lines.push("Metas opcionais do gestor (intenção, não evidência nem benchmark oficial):");
    for (const target of objectives.targets) {
      lines.push(
        `- ${ANALYSIS_GOAL_LABELS[target.goal]}: ${target.targetValue} (${target.unit})`,
      );
    }
  }

  lines.push("Métricas a investigar (união deduplicada):");
  lines.push(composed.requiredMetrics.join(", "));

  lines.push("Para cada objetivo, investigue campanha → conjunto → anúncio quando houver dados.");
  lines.push(
    "Separe explicitamente: (1) otimizações/testes executáveis com evidência suficiente, (2) investigações necessárias, (3) monitoramento — monitoramento NÃO é otimização aplicável.",
  );
  lines.push(
    "Toda recomendação executável deve citar entity_id real, objetivo relacionado, evidência, intervenção, possíveis efeitos colaterais e critério de validação.",
  );
  lines.push(
    "Não use combinações pré-codificadas: derive o cruzamento a partir dos objetivos selecionados e das métricas acima.",
  );

  if (composed.goalPairs.length) {
    lines.push("Relações a avaliar entre pares de objetivos:");
    for (const [a, b] of composed.goalPairs) {
      lines.push(`- ${a} ↔ ${b}`);
    }
  }

  return lines.join("\n");
}
