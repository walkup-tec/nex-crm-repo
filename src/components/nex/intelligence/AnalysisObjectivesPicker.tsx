import {
  ANALYSIS_GOAL_LABELS,
  ANALYSIS_GOALS,
  type AnalysisGoal,
  type AnalysisObjectives,
  type GoalTarget,
} from "@/lib/nex-intelligence/goals/types";
import { getGoalDefinition } from "@/lib/nex-intelligence/goals/definitions";
import { ni } from "@/components/nex/intelligence/intelligence-theme";
import { Check } from "lucide-react";

type Props = {
  value: AnalysisObjectives;
  onChange: (next: AnalysisObjectives) => void;
  resultEventLabel?: string | null;
  resultEventKey?: string | null;
  disabled?: boolean;
};

function toggleGoal(selected: AnalysisGoal[], goal: AnalysisGoal): AnalysisGoal[] {
  if (selected.includes(goal)) {
    return selected.filter((item) => item !== goal);
  }
  return [...selected, goal];
}

function syncPrimary(selected: AnalysisGoal[], primary: AnalysisGoal): AnalysisGoal {
  if (selected.length === 0) return primary;
  if (selected.length === 1) return selected[0]!;
  return selected.includes(primary) ? primary : selected[0]!;
}

function upsertTarget(
  targets: GoalTarget[] | undefined,
  goal: AnalysisGoal,
  raw: string,
): GoalTarget[] | undefined {
  const def = getGoalDefinition(goal);
  const next = [...(targets ?? [])].filter((row) => row.goal !== goal);
  const trimmed = raw.trim().replace(",", ".");
  if (!trimmed) return next.length ? next : undefined;
  const targetValue = Number(trimmed);
  if (!Number.isFinite(targetValue) || targetValue <= 0) return next.length ? next : undefined;
  next.push({ goal, targetValue, unit: def.defaultTargetUnit });
  return next;
}

function targetValueFor(targets: GoalTarget[] | undefined, goal: AnalysisGoal): string {
  const hit = targets?.find((row) => row.goal === goal);
  return hit ? String(hit.targetValue) : "";
}

export function AnalysisObjectivesPicker({
  value,
  onChange,
  resultEventLabel,
  resultEventKey,
  disabled = false,
}: Props) {
  const selected = value.selectedGoals;

  return (
    <section className={`${ni.card} p-4`}>
      <h3 className={ni.title}>O que você deseja melhorar?</h3>
      <p className={`mt-1 ${ni.muted}`}>
        Selecione um ou mais objetivos para orientar a análise e identificar oportunidades de
        otimização.
      </p>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {ANALYSIS_GOALS.map((goal) => {
          const active = selected.includes(goal);
          return (
            <button
              key={goal}
              type="button"
              disabled={disabled}
              onClick={() => {
                const selectedGoals = toggleGoal(selected, goal);
                if (!selectedGoals.length) return;
                onChange({
                  ...value,
                  selectedGoals,
                  primaryGoal: syncPrimary(selectedGoals, value.primaryGoal),
                  targets: value.targets?.filter((row) => selectedGoals.includes(row.goal)),
                });
              }}
              className={`flex items-start gap-3 rounded-xl border px-3 py-3 text-left transition-colors ${
                active
                  ? "border-[#1d6feb] bg-[#1d6feb]/15 text-white"
                  : "border-[#1e3a5f] bg-[#07111f] text-[#d5e0ef] hover:border-[#2a4060]"
              } disabled:opacity-50`}
            >
              <span
                className={`mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-md border ${
                  active ? "border-[#3ecbff] bg-[#1d6feb] text-white" : "border-[#2a4060] text-transparent"
                }`}
              >
                <Check className="size-3.5" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium">{ANALYSIS_GOAL_LABELS[goal]}</span>
                <span className="mt-0.5 block text-[11px] text-[#8fa3bf]">{goal}</span>
              </span>
            </button>
          );
        })}
      </div>

      {selected.length > 1 ? (
        <label className={`${ni.field} mt-4 max-w-md`}>
          <span className={ni.label}>Objetivo prioritário</span>
          <select
            className={ni.input}
            disabled={disabled}
            value={value.primaryGoal}
            onChange={(event) =>
              onChange({
                ...value,
                primaryGoal: event.target.value as AnalysisGoal,
              })
            }
          >
            {selected.map((goal) => (
              <option key={goal} value={goal}>
                {ANALYSIS_GOAL_LABELS[goal]}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {selected.length ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {selected.map((goal) => {
            const def = getGoalDefinition(goal);
            const placeholder =
              def.defaultTargetUnit === "PERCENT"
                ? "ex.: 4"
                : def.defaultTargetUnit === "BRL"
                  ? "ex.: 6,00"
                  : "ex.: 50";
            return (
              <label key={goal} className={ni.field}>
                <span className={ni.label}>
                  Meta opcional — {ANALYSIS_GOAL_LABELS[goal]} ({def.defaultTargetUnit})
                </span>
                <input
                  className={ni.input}
                  disabled={disabled}
                  inputMode="decimal"
                  placeholder={placeholder}
                  value={targetValueFor(value.targets, goal)}
                  onChange={(event) =>
                    onChange({
                      ...value,
                      targets: upsertTarget(value.targets, goal, event.target.value),
                    })
                  }
                />
              </label>
            );
          })}
        </div>
      ) : null}

      <p className={`mt-4 text-sm text-[#c5d3e6]`}>
        Resultado analisado:{" "}
        <span className="font-medium text-white">
          {resultEventLabel?.trim() || "Conversões (definir pelo export Meta)"}
        </span>
        {resultEventKey ? (
          <span className="mt-1 block font-mono text-[11px] text-[#8fa3bf]">{resultEventKey}</span>
        ) : null}
      </p>
    </section>
  );
}

export {
  defaultAnalysisObjectives,
  defaultDailyAnalysisObjectives,
} from "@/lib/nex-intelligence/goals/defaults";
