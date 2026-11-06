import {
  ANALYSIS_GOAL_HINTS,
  ANALYSIS_GOAL_LABELS,
  ANALYSIS_GOALS,
  type AnalysisGoal,
  type AnalysisObjectives,
} from "@/lib/nex-intelligence/goals/types";
import { ni } from "@/components/nex/intelligence/intelligence-theme";
import { Check } from "lucide-react";

type Props = {
  value: AnalysisObjectives;
  onChange: (next: AnalysisObjectives) => void;
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

export function AnalysisObjectivesPicker({
  value,
  onChange,
  disabled = false,
}: Props) {
  const selected = Array.isArray(value?.selectedGoals) ? value.selectedGoals : [];

  return (
    <section
      className={`${ni.card} border-[#1d6feb]/40 p-4`}
      aria-label="Objetivos da análise"
      data-testid="analysis-objectives-picker"
    >
      <h3 className={ni.title}>O que você deseja melhorar?</h3>
      <p className={`mt-1 ${ni.muted}`}>
        Obrigatório — selecione um ou mais objetivos para orientar a análise e identificar
        oportunidades de otimização.
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
                  targets: undefined,
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
                <span className="mt-0.5 block text-[11px] leading-snug text-[#8fa3bf]">
                  {ANALYSIS_GOAL_HINTS[goal]}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {selected.length > 1 ? (
        <label className={`${ni.field} mt-4 max-w-md`}>
          <span className={ni.label}>Objetivo prioritário</span>
          <select
            className={`${ni.input} px-3 pr-8`}
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
    </section>
  );
}

export {
  defaultAnalysisObjectives,
  defaultDailyAnalysisObjectives,
} from "@/lib/nex-intelligence/goals/defaults";
