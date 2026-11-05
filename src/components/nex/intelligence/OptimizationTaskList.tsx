import type { SuggestedTask } from "@/lib/nex-intelligence/dashboard/types";
import { ni } from "@/components/nex/intelligence/intelligence-theme";
import { formatShortDate } from "@/lib/nex-intelligence/dashboard/format";
import { CheckCircle2 } from "lucide-react";

type Props = {
  title?: string;
  tasks: SuggestedTask[];
  onApply?: (task: SuggestedTask) => void;
  onReject?: (task: SuggestedTask) => void;
  busyId?: string | null;
};

function priorityClass(priority: SuggestedTask["priority"]) {
  if (priority === "high") return ni.badgePriHigh;
  if (priority === "medium") return ni.badgePriMed;
  return ni.badgePriLow;
}

function priorityLabel(priority: SuggestedTask["priority"]) {
  if (priority === "high") return "Alta";
  if (priority === "medium") return "Média";
  return "Baixa";
}

export function OptimizationTaskList({
  title = "Otimizações sugeridas",
  tasks,
  onApply,
  onReject,
  busyId,
}: Props) {
  return (
    <div className={`${ni.card} overflow-hidden`}>
      <div className="border-b border-[#1e3a5f]/70 px-4 py-3">
        <h3 className={ni.title}>{title}</h3>
      </div>
      {tasks.length === 0 ? (
        <p className={`px-4 py-6 ${ni.muted}`}>
          Nenhuma recomendação validada (E2/E3) disponível nesta execução.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-[#07111f] text-[#8fa3bf]">
              <tr>
                <th className="px-4 py-2 font-medium">Tarefa</th>
                <th className="px-4 py-2 font-medium">Motivo</th>
                <th className="px-4 py-2 font-medium">Prioridade</th>
                <th className="px-4 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => (
                <tr key={task.id} className="border-t border-[#1e3a5f]/50">
                  <td className="px-4 py-3 align-top">
                    <p className="font-medium text-white">{task.title}</p>
                    <p className="mt-1 text-xs text-[#8fa3bf]">
                      {task.kind} · {task.evidenceLevel ?? "—"}
                      {task.entityId ? ` · ${task.entityLevel}:${task.entityId}` : ""}
                    </p>
                  </td>
                  <td className="px-4 py-3 align-top text-[#c5d3e6]">
                    {task.justification || "—"}
                  </td>
                  <td className="px-4 py-3 align-top">
                    <span className={priorityClass(task.priority)}>
                      {priorityLabel(task.priority)}
                    </span>
                  </td>
                  <td className="px-4 py-3 align-top">
                    {task.status === "APPLIED" ? (
                      <span className={`inline-flex items-center gap-1.5 ${ni.badgePos}`}>
                        <CheckCircle2 className="size-3.5" />
                        Aplicado
                        {task.appliedAt ? ` em ${formatShortDate(task.appliedAt)}` : ""}
                      </span>
                    ) : task.status === "REJECTED" ? (
                      <span className={ni.badgeNeu}>Rejeitado</span>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className={ni.btnGhost}
                          disabled={busyId === task.id}
                          onClick={() => onApply?.(task)}
                        >
                          Aplicar
                        </button>
                        <button
                          type="button"
                          className={ni.btnGhost}
                          disabled={busyId === task.id}
                          onClick={() => onReject?.(task)}
                        >
                          Rejeitar
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
