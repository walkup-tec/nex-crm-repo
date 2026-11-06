import { useState } from "react";
import type { SuggestedTask } from "@/lib/nex-intelligence/dashboard/types";
import {
  MANUAL_TASK_PRESETS,
  findManualTaskPreset,
} from "@/lib/nex-intelligence/dashboard/manual-task-presets";
import { ni } from "@/components/nex/intelligence/intelligence-theme";
import { formatDateTime } from "@/lib/nex-intelligence/dashboard/format";
import { TaskTypeIcon } from "@/components/nex/intelligence/task-type-icon";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Check, CheckCircle2, Plus, X } from "lucide-react";

type ManualAddInput = {
  title: string;
  kind: SuggestedTask["kind"];
  justification: string;
  decision: "PENDING" | "APPLIED" | "REJECTED";
};

type Props = {
  title?: string;
  tasks: SuggestedTask[];
  onApply?: (task: SuggestedTask) => void;
  onReject?: (task: SuggestedTask) => void;
  onAdd?: (input: ManualAddInput) => void | Promise<void>;
  busyId?: string | null;
  adding?: boolean;
  canAdd?: boolean;
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
  onAdd,
  busyId,
  adding = false,
  canAdd = true,
}: Props) {
  const [draftOpen, setDraftOpen] = useState(false);
  const [presetId, setPresetId] = useState("");
  const [motivo, setMotivo] = useState("");

  const preset = presetId ? findManualTaskPreset(presetId) : null;
  const canDecide = Boolean(preset && motivo.trim() && !adding && onAdd);

  const resetDraft = () => {
    setDraftOpen(false);
    setPresetId("");
    setMotivo("");
  };

  const commitDraft = async (decision: ManualAddInput["decision"]) => {
    if (!preset || !motivo.trim() || !onAdd) return;
    await onAdd({
      title: preset.title,
      kind: preset.kind,
      justification: motivo.trim(),
      decision,
    });
    resetDraft();
  };

  return (
    <div className={`${ni.card} overflow-hidden`}>
      <div className="flex items-center justify-between gap-3 border-b border-[#1e3a5f]/70 px-4 py-3">
        <h3 className={ni.title}>{title}</h3>
        {onAdd ? (
          <button
            type="button"
            className={ni.btnGhost}
            disabled={!canAdd || adding || draftOpen}
            onClick={() => setDraftOpen(true)}
          >
            <Plus className="size-3.5" />
            Adicionar
          </button>
        ) : null}
      </div>
      {tasks.length === 0 && !draftOpen ? (
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
                <th className="px-4 py-2 text-center font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => (
                <tr key={task.id} className="border-t border-[#1e3a5f]/50">
                  <td className="px-4 py-3 align-middle">
                    <div className="flex items-center gap-2.5">
                      <TaskTypeIcon
                        title={task.title}
                        kind={task.kind}
                        className="size-[18px] shrink-0 stroke-[1.75] text-[#3ecbff]"
                      />
                      <div className="min-w-0">
                        <p className="font-medium leading-snug text-white">{task.title}</p>
                        <p className="mt-0.5 text-xs text-[#8fa3bf]">
                          {task.kind} · {task.evidenceLevel ?? "—"}
                          {task.entityId ? ` · ${task.entityLevel}:${task.entityId}` : ""}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 align-middle text-[#c5d3e6]">
                    {task.justification || "—"}
                  </td>
                  <td className="px-4 py-3 align-middle">
                    <span className={priorityClass(task.priority)}>
                      {priorityLabel(task.priority)}
                    </span>
                  </td>
                  <td className="px-4 py-3 align-middle">
                    <div className="flex min-h-8 items-center justify-center">
                      {task.status === "APPLIED" ? (
                        <div className="inline-flex items-center gap-2 whitespace-nowrap">
                          <span className="inline-flex h-7 items-center gap-1.5 rounded-md bg-emerald-500/20 px-2.5 text-xs font-semibold text-emerald-300">
                            <CheckCircle2 className="size-3.5" />
                            Aplicado
                          </span>
                          {task.appliedAt ? (
                            <span className="text-xs text-[#c5d3e6]">
                              em {formatDateTime(task.appliedAt)}
                            </span>
                          ) : null}
                        </div>
                      ) : task.status === "REJECTED" ? (
                        <span className={ni.badgeNeu}>Rejeitado</span>
                      ) : (
                        <div className="inline-flex h-7 overflow-hidden rounded-md border border-[#2a4060] bg-[#07111f]">
                          <button
                            type="button"
                            className="inline-flex h-full items-center gap-1 border-r border-[#2a4060] px-2.5 text-xs font-medium text-emerald-300 transition-colors hover:bg-emerald-500/15 disabled:opacity-50"
                            disabled={busyId === task.id}
                            onClick={() => onApply?.(task)}
                          >
                            <Check className="size-3.5" />
                            Aplicar
                          </button>
                          <button
                            type="button"
                            className="inline-flex h-full items-center gap-1 px-2.5 text-xs font-medium text-[#9db0c9] transition-colors hover:bg-[#122038] hover:text-white disabled:opacity-50"
                            disabled={busyId === task.id}
                            onClick={() => onReject?.(task)}
                          >
                            <X className="size-3.5" />
                            Rejeitar
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}

              {draftOpen ? (
                <tr className="border-t border-[#1e3a5f]/50 bg-[#07111f]/40">
                  <td className="px-4 py-3 align-middle">
                    <div className="flex min-w-[220px] items-center gap-2.5">
                      {preset ? (
                        <TaskTypeIcon
                          title={preset.title}
                          kind={preset.kind}
                          className="size-[18px] shrink-0 stroke-[1.75] text-[#3ecbff]"
                        />
                      ) : null}
                      <Select value={presetId || undefined} onValueChange={setPresetId}>
                        <SelectTrigger
                          className="h-9 w-full min-w-[200px] border-[#1e3a5f] bg-[#050c1a] text-sm text-white"
                          aria-label="Selecionar tarefa"
                        >
                          <SelectValue placeholder="Selecionar tarefa…" />
                        </SelectTrigger>
                        <SelectContent>
                          {MANUAL_TASK_PRESETS.map((row) => (
                            <SelectItem key={row.id} value={row.id}>
                              {row.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {preset ? (
                      <p className="mt-1 text-xs text-[#8fa3bf]">
                        {preset.kind} · manual · prioridade alta
                      </p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 align-middle">
                    {preset ? (
                      <input
                        className={`${ni.input} h-9`}
                        value={motivo}
                        placeholder="Escreva o motivo…"
                        autoFocus
                        onChange={(event) => setMotivo(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" && canDecide) {
                            event.preventDefault();
                            void commitDraft("PENDING");
                          }
                          if (event.key === "Escape") resetDraft();
                        }}
                      />
                    ) : (
                      <span className="text-xs text-[#6b7f9a]">Selecione a tarefa primeiro</span>
                    )}
                  </td>
                  <td className="px-4 py-3 align-middle">
                    <span className={priorityClass("high")}>Alta</span>
                  </td>
                  <td className="px-4 py-3 align-middle">
                    <div className="flex min-h-8 flex-col items-center justify-center gap-1">
                      <div className="inline-flex h-7 overflow-hidden rounded-md border border-[#2a4060] bg-[#07111f]">
                        <button
                          type="button"
                          className="inline-flex h-full items-center gap-1 border-r border-[#2a4060] px-2.5 text-xs font-medium text-emerald-300 transition-colors hover:bg-emerald-500/15 disabled:opacity-50"
                          disabled={!canDecide}
                          onClick={() => void commitDraft("APPLIED")}
                        >
                          <Check className="size-3.5" />
                          {adding ? "…" : "Aplicar"}
                        </button>
                        <button
                          type="button"
                          className="inline-flex h-full items-center gap-1 px-2.5 text-xs font-medium text-[#9db0c9] transition-colors hover:bg-[#122038] hover:text-white disabled:opacity-50"
                          disabled={!canDecide}
                          onClick={() => void commitDraft("REJECTED")}
                        >
                          <X className="size-3.5" />
                          Rejeitar
                        </button>
                      </div>
                      <button
                        type="button"
                        className="text-[11px] text-[#6b7f9a] hover:text-[#9db0c9]"
                        disabled={adding}
                        onClick={resetDraft}
                      >
                        Cancelar
                      </button>
                    </div>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
