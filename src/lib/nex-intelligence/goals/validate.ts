import {
  ANALYSIS_GOAL_CONTRACT_VERSION,
  ANALYSIS_GOALS,
  type AnalysisGoal,
  type AnalysisObjectives,
  type GoalTarget,
  type GoalTargetUnit,
} from "@/lib/nex-intelligence/goals/types";
import { getGoalDefinition } from "@/lib/nex-intelligence/goals/definitions";

const GOAL_SET = new Set<string>(ANALYSIS_GOALS);

function isAnalysisGoal(value: unknown): value is AnalysisGoal {
  return typeof value === "string" && GOAL_SET.has(value);
}

function unitForGoal(goal: AnalysisGoal): GoalTargetUnit {
  return getGoalDefinition(goal).defaultTargetUnit;
}

export type ValidateObjectivesResult =
  | { ok: true; value: AnalysisObjectives }
  | { ok: false; message: string };

/** Normaliza e valida o contrato de objetivos (backend + testes). */
export function validateAnalysisObjectives(raw: unknown): ValidateObjectivesResult {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, message: "Objetivos da análise são obrigatórios." };
  }
  const row = raw as Record<string, unknown>;
  const selectedRaw = row.selectedGoals;
  if (!Array.isArray(selectedRaw) || selectedRaw.length === 0) {
    return { ok: false, message: "Selecione pelo menos um objetivo." };
  }

  const selectedGoals: AnalysisGoal[] = [];
  for (const item of selectedRaw) {
    if (!isAnalysisGoal(item)) {
      return { ok: false, message: `Objetivo desconhecido: ${String(item)}.` };
    }
    if (selectedGoals.includes(item)) {
      return { ok: false, message: "Objetivos duplicados não são permitidos." };
    }
    selectedGoals.push(item);
  }

  let primaryGoal: AnalysisGoal;
  if (selectedGoals.length === 1) {
    primaryGoal = selectedGoals[0]!;
  } else if (isAnalysisGoal(row.primaryGoal)) {
    primaryGoal = row.primaryGoal;
  } else {
    return { ok: false, message: "Defina o objetivo prioritário." };
  }

  if (!selectedGoals.includes(primaryGoal)) {
    return { ok: false, message: "O objetivo prioritário deve estar entre os selecionados." };
  }

  const targets: GoalTarget[] = [];
  if (row.targets != null) {
    if (!Array.isArray(row.targets)) {
      return { ok: false, message: "Metas opcionais inválidas." };
    }
    for (const item of row.targets) {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        return { ok: false, message: "Meta opcional inválida." };
      }
      const target = item as Record<string, unknown>;
      if (!isAnalysisGoal(target.goal)) {
        return { ok: false, message: "Meta com objetivo desconhecido." };
      }
      if (!selectedGoals.includes(target.goal)) {
        return { ok: false, message: "Meta deve referir um objetivo selecionado." };
      }
      const targetValue = Number(target.targetValue);
      if (!Number.isFinite(targetValue) || targetValue <= 0) {
        return { ok: false, message: "Meta numérica deve ser finita e maior que zero." };
      }
      const expectedUnit = unitForGoal(target.goal);
      const unit = target.unit;
      if (unit != null && unit !== expectedUnit) {
        return {
          ok: false,
          message: `Unidade incompatível para ${target.goal}: esperada ${expectedUnit}.`,
        };
      }
      targets.push({
        goal: target.goal,
        targetValue,
        unit: expectedUnit,
      });
    }
  }

  const resultEventKey =
    typeof row.resultEventKey === "string" && row.resultEventKey.trim()
      ? row.resultEventKey.trim()
      : undefined;

  return {
    ok: true,
    value: {
      selectedGoals,
      primaryGoal,
      ...(targets.length ? { targets } : {}),
      ...(resultEventKey ? { resultEventKey } : {}),
      requestedAt:
        typeof row.requestedAt === "string" && row.requestedAt
          ? row.requestedAt
          : new Date().toISOString(),
      contractVersion:
        typeof row.contractVersion === "string" && row.contractVersion
          ? row.contractVersion
          : ANALYSIS_GOAL_CONTRACT_VERSION,
    },
  };
}

/** Lista as 15 combinações não vazias dos 4 objetivos (para testes). */
export function allNonEmptyGoalCombinations(): AnalysisGoal[][] {
  const codes = [...ANALYSIS_GOALS];
  const out: AnalysisGoal[][] = [];
  const n = codes.length;
  for (let mask = 1; mask < 1 << n; mask += 1) {
    const combo: AnalysisGoal[] = [];
    for (let i = 0; i < n; i += 1) {
      if (mask & (1 << i)) combo.push(codes[i]!);
    }
    out.push(combo);
  }
  return out;
}
