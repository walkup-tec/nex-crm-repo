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
      className="rounded-xl border border-[#1e3a5f]/70 bg-[#0b1729] px-3 py-3"
      aria-label="Objetivos da análise"
      data-testid="analysis-objectives-picker"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className={`${ni.label} shrink-0`}>Objetivos</span>
        <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
          {ANALYSIS_GOALS.map((goal) => {
            const active = selected.includes(goal);
            return (
              <button
                key={goal}
                type="button"
                disabled={disabled}
                title={ANALYSIS_GOAL_HINTS[goal]}
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
                className={`inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors ${
                  active
                    ? "border-[#1d6feb] bg-[#1d6feb]/15 text-white"
                    : "border-[#1e3a5f] bg-[#07111f] text-[#c5d3e6] hover:border-[#2a4060]"
                } disabled:opacity-50`}
              >
                <span
                  className={`inline-flex size-3.5 shrink-0 items-center justify-center rounded border ${
                    active
                      ? "border-[#3ecbff] bg-[#1d6feb] text-white"
                      : "border-[#2a4060] text-transparent"
                  }`}
                >
                  <Check className="size-2.5" />
                </span>
                {ANALYSIS_GOAL_LABELS[goal]}
              </button>
            );
          })}
        </div>

        {selected.length > 1 ? (
          <label className="inline-flex min-w-[12rem] max-w-xs flex-1 items-center gap-2 sm:flex-none">
            <span className={`${ni.label} shrink-0`}>Prioridade</span>
            <select
              className={`${ni.input} h-8 px-3 pr-8 text-xs`}
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
      </div>

      <p className="mt-2 text-[11px] leading-snug text-[#8fa3bf]">
        CTR = taxa de cliques (cliques ÷ impressões) · CPC = custo por clique
      </p>
    </section>
  );
}

export {
  defaultAnalysisObjectives,
  defaultDailyAnalysisObjectives,
} from "@/lib/nex-intelligence/goals/defaults";
