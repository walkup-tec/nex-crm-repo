import type { SuggestedTask } from "@/lib/nex-intelligence/dashboard/types";

/** Tarefas manuais previstas pelo produto (mesmo catálogo visual da lista). */
export type ManualTaskPreset = {
  id: string;
  title: string;
  kind: SuggestedTask["kind"];
};

export const MANUAL_TASK_PRESETS: ManualTaskPreset[] = [
  { id: "audience", title: "Ajustar público (segmentação)", kind: "test" },
  { id: "creative", title: "Atualizar criativo (arte e copy)", kind: "test" },
  { id: "placement", title: "Revisar posicionamentos", kind: "action" },
  { id: "budget", title: "Ajustar orçamento", kind: "action" },
  { id: "pause", title: "Pausar entrega", kind: "action" },
  { id: "monitor", title: "Monitorar indicadores", kind: "monitor" },
  { id: "hypothesis", title: "Hipótese a investigar", kind: "hypothesis" },
  { id: "test", title: "Teste estratégico", kind: "test" },
];

export function findManualTaskPreset(id: string): ManualTaskPreset | null {
  return MANUAL_TASK_PRESETS.find((row) => row.id === id) ?? null;
}
