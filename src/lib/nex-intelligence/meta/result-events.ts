import { numberOrNull, textOrNull } from "@/lib/nex-intelligence/meta/normalize";

export type InsightAction = { action_type?: string; value?: string | number };

/** Seleciona o resultado preferido a partir de actions[] da Meta. */
export function resultsFromActions(
  actions: InsightAction[] | undefined,
  preferredTypes: string[],
): { results: number | null; result_metric: string | null } {
  if (!actions?.length) return { results: null, result_metric: null };
  for (const type of preferredTypes) {
    const found = actions.find((entry) => entry.action_type === type);
    const value = numberOrNull(found?.value);
    if (found && value != null && value > 0) return { results: value, result_metric: type };
  }
  let best: { results: number; result_metric: string } | null = null;
  for (const entry of actions) {
    const type = textOrNull(entry.action_type);
    const value = numberOrNull(entry.value);
    if (!type || value == null || value <= 0) continue;
    if (!best || value > best.results) best = { results: value, result_metric: type };
  }
  return best ?? { results: null, result_metric: null };
}
