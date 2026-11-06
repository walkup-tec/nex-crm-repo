import {
  ANALYSIS_GOAL_HINTS,
  ANALYSIS_GOAL_LABELS,
  ANALYSIS_GOAL_SHORT_LABELS,
  ANALYSIS_GOALS,
  type AnalysisGoal,
  type AnalysisObjectives,
} from "@/lib/nex-intelligence/goals/types";
import { ni } from "@/components/nex/intelligence/intelligence-theme";

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
      className="rounded-lg border border-[#1e3a5f]/70 bg-[#0b1729] px-3 py-2"
      aria-label="Objetivos da análise"
      data-testid="analysis-objectives-picker"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className={`${ni.label} shrink-0`}>Objetivos:</span>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {ANALYSIS_GOALS.map((goal) => {
            const active = selected.includes(goal);
            const id = `objective-${goal}`;
            return (
              <label
                key={goal}
                htmlFor={id}
                title={ANALYSIS_GOAL_HINTS[goal]}
                className={`inline-flex cursor-pointer items-center gap-1.5 text-xs ${
                  active ? "text-white" : "text-[#c5d3e6]"
                } ${disabled ? "cursor-not-allowed opacity-50" : "hover:text-white"}`}
              >
                <input
                  id={id}
                  type="checkbox"
                  className="size-3.5 shrink-0 rounded border-[#2a4060] bg-[#07111f] text-[#1d6feb] focus-visible:ring-[#2f7cf6]"
                  checked={active}
                  disabled={disabled}
                  onChange={() => {
                    const selectedGoals = toggleGoal(selected, goal);
                    if (!selectedGoals.length) return;
                    onChange({
                      ...value,
                      selectedGoals,
                      primaryGoal: syncPrimary(selectedGoals, value.primaryGoal),
                      targets: undefined,
                    });
                  }}
                />
                {ANALYSIS_GOAL_SHORT_LABELS[goal]}
              </label>
            );
          })}
        </div>

        {selected.length > 1 ? (
          <>
            <span className="hidden h-4 w-px bg-[#1e3a5f] sm:block" aria-hidden />
            <label className="inline-flex min-w-[11rem] items-center gap-2">
              <span className={`${ni.label} shrink-0`}>Prioridade</span>
              <select
                className={`${ni.input} h-8 max-w-[14rem] px-3 pr-8 text-xs`}
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
          </>
        ) : null}

        <span className="hidden h-4 w-px bg-[#1e3a5f] md:block" aria-hidden />
        <span
          className="text-[11px] leading-none text-[#8fa3bf]"
          title="CTR = taxa de cliques (cliques ÷ impressões). CPC = custo por clique."
        >
          CTR · CPC
        </span>
      </div>
    </section>
  );
}

export {
  defaultAnalysisObjectives,
  defaultDailyAnalysisObjectives,
} from "@/lib/nex-intelligence/goals/defaults";
