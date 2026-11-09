import { Fragment, useState } from "react";
import type { SuggestedTask } from "@/lib/nex-intelligence/dashboard/types";
import { entityLevelLabel } from "@/lib/nex-intelligence/dashboard/entity-labels";
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
import { Check, CheckCircle2, ChevronDown, ChevronUp, Loader2, Plus, X } from "lucide-react";

function formatDetailValue(value: number | null, unit: string): string {
  if (value == null || !Number.isFinite(value)) return "indisponível";
  if (unit === "currency") {
    return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }
  if (unit === "ratio_pct") {
    return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
  }
  return value.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}

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
  onAdd?: (input: ManualAddInput) => boolean | Promise<boolean>;
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
  const [editingMotivo, setEditingMotivo] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const preset = presetId ? findManualTaskPreset(presetId) : null;
  const motivoTrimmed = motivo.trim();
  const canDecide = Boolean(preset && motivoTrimmed && !adding && onAdd);
  const showMotivoFormatted = Boolean(preset && motivoTrimmed && !editingMotivo);

  const resetDraft = () => {
    setDraftOpen(false);
    setPresetId("");
    setMotivo("");
    setEditingMotivo(true);
  };

  const commitDraft = async (decision: ManualAddInput["decision"]) => {
    if (!preset || !motivo.trim() || !onAdd) return;
    try {
      const saved = await onAdd({
        title: preset.title,
        kind: preset.kind,
        justification: motivo.trim(),
        decision,
      });
      if (saved) resetDraft();
    } catch {
      // Mantém o rascunho aberto para correção/retry; o pai limpa `adding` no finally.
    }
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
              {tasks.map((task) => {
                const expanded = expandedId === task.id;
                const detail = task.detail;
                return (
                  <Fragment key={task.id}>
                    <tr className="border-t border-[#1e3a5f]/50">
                      <td className="px-4 py-3 align-middle">
                        <div className="flex items-start gap-2.5">
                          <TaskTypeIcon
                            title={task.title}
                            kind={task.kind}
                            className="mt-0.5 size-[18px] shrink-0 stroke-[1.75] text-[#3ecbff]"
                          />
                          <div className="min-w-0">
                            <p className="font-medium leading-snug text-white">{task.title}</p>
                            <div className="mt-0.5 space-y-0.5 text-xs text-[#8fa3bf]">
                              {task.campaignName &&
                              (task.entityLevel === "ad" || task.entityLevel === "adset") ? (
                                <p>
                                  Campanha:{" "}
                                  <span className="text-[#c5d3e6]">{task.campaignName}</span>
                                </p>
                              ) : null}
                              {task.adsetName && task.entityLevel === "ad" ? (
                                <p>
                                  Conjunto:{" "}
                                  <span className="text-[#c5d3e6]">{task.adsetName}</span>
                                </p>
                              ) : null}
                              <p>
                                {task.evidenceLevel ?? "—"}
                                {task.entityName || task.entityId
                                  ? ` · ${entityLevelLabel(task.entityLevel)}: ${task.entityName ?? task.entityId}`
                                  : ""}
                              </p>
                            </div>
                            {detail ? (
                              <button
                                type="button"
                                className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-[#3ecbff] hover:text-white"
                                onClick={() =>
                                  setExpandedId(expanded ? null : task.id)
                                }
                              >
                                {expanded ? (
                                  <>
                                    Ocultar justificativa <ChevronUp className="size-3.5" />
                                  </>
                                ) : (
                                  <>
                                    Ver justificativa <ChevronDown className="size-3.5" />
                                  </>
                                )}
                              </button>
                            ) : null}
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
                    {expanded && detail ? (
                      <tr className="border-t border-[#1e3a5f]/30 bg-[#07111f]/55">
                        <td colSpan={4} className="px-4 py-4">
                          <div className="grid gap-4 text-sm text-[#c5d3e6] xl:grid-cols-2">
                            <section>
                              <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-[#8fa3bf]">
                                1. Diagnóstico
                              </h4>
                              <p>{detail.detectedProblem || detail.diagnosisSummary}</p>
                              {detail.opportunity ? (
                                <p className="mt-2 text-[#9db0c9]">{detail.opportunity}</p>
                              ) : null}
                            </section>
                            <section>
                              <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-[#8fa3bf]">
                                2. Comparativo
                              </h4>
                              {detail.metricRows.length ? (
                                <div className="overflow-x-auto rounded-md border border-[#1e3a5f]/70">
                                  <table className="w-full min-w-[360px] text-left text-xs">
                                    <thead className="bg-[#050c1a] text-[#8fa3bf]">
                                      <tr>
                                        <th className="px-2 py-1.5">Indicador</th>
                                        {detail.metricRows[0]?.cells.map((cell) => (
                                          <th key={cell.entityId} className="px-2 py-1.5">
                                            {cell.entityName}
                                          </th>
                                        ))}
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {detail.metricRows.slice(0, 8).map((row) => (
                                        <tr key={row.metric} className="border-t border-[#1e3a5f]/40">
                                          <td className="px-2 py-1.5 text-white">{row.label}</td>
                                          {row.cells.map((cell) => (
                                            <td key={cell.entityId} className="px-2 py-1.5 tabular-nums">
                                              {formatDetailValue(cell.value, row.unit)}
                                            </td>
                                          ))}
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              ) : (
                                <p className={ni.muted}>Sem métricas verificáveis para a tabela.</p>
                              )}
                            </section>
                            <section>
                              <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-[#8fa3bf]">
                                3. Por que pode melhorar
                              </h4>
                              <p>{detail.mechanism}</p>
                              {detail.expectedDirection ? (
                                <p className="mt-2 text-[#9db0c9]">Direção esperada: {detail.expectedDirection}</p>
                              ) : null}
                            </section>
                            <section>
                              <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-[#8fa3bf]">
                                4. O que fazer
                              </h4>
                              <ol className="list-decimal space-y-1 pl-4">
                                {detail.actionSteps.map((step) => (
                                  <li key={step}>{step}</li>
                                ))}
                              </ol>
                            </section>
                            <section>
                              <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-[#8fa3bf]">
                                5. Riscos e pré-requisitos
                              </h4>
                              <ul className="list-disc space-y-1 pl-4">
                                {[...detail.prerequisites, ...detail.limitations].map((item) => (
                                  <li key={item}>{item}</li>
                                ))}
                              </ul>
                            </section>
                            <section>
                              <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-[#8fa3bf]">
                                6–7. Validação e confiança
                              </h4>
                              <ul className="list-disc space-y-1 pl-4">
                                {detail.successCriteria.map((item) => (
                                  <li key={item}>{item}</li>
                                ))}
                              </ul>
                              <p className="mt-2 text-xs text-[#8fa3bf]">
                                Confiança: {detail.confidenceStatus ?? "—"} · Guardrails:{" "}
                                {detail.guardrailMetrics.join(", ") || "—"}.
                              </p>
                              <ul className="mt-1 list-disc space-y-1 pl-4 text-xs text-[#9db0c9]">
                                {detail.confidenceReasons.map((item) => (
                                  <li key={item}>{item}</li>
                                ))}
                              </ul>
                            </section>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}

              {draftOpen ? (
                <tr className="border-t border-[#1e3a5f]/50 bg-[#07111f]/35">
                  <td className="px-4 py-3 align-middle">
                    <div className="flex h-8 min-w-[240px] items-center gap-2.5">
                      {preset ? (
                        <TaskTypeIcon
                          title={preset.title}
                          kind={preset.kind}
                          className="size-[18px] shrink-0 stroke-[1.75] text-[#3ecbff]"
                        />
                      ) : (
                        <span className="size-[18px] shrink-0" aria-hidden />
                      )}
                      <Select
                        value={presetId || undefined}
                        onValueChange={(value) => {
                          setPresetId(value);
                          setEditingMotivo(true);
                        }}
                      >
                        <SelectTrigger
                          className="h-8 w-full min-w-[220px] border-[#1e3a5f] bg-[#050c1a] text-sm font-medium text-white"
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
                  </td>
                  <td className="px-4 py-3 align-middle">
                    {!preset ? (
                      <span className="text-sm text-[#6b7f9a]">Selecione a tarefa primeiro</span>
                    ) : showMotivoFormatted ? (
                      <button
                        type="button"
                        className="w-full text-left text-sm text-[#c5d3e6] hover:text-white"
                        title="Clique para editar o motivo"
                        onClick={() => setEditingMotivo(true)}
                      >
                        {motivoTrimmed}
                      </button>
                    ) : (
                      <input
                        className="h-8 w-full min-w-[180px] rounded-md border border-[#1e3a5f] bg-transparent px-2.5 text-sm text-[#c5d3e6] outline-none placeholder:text-[#6b7f9a] focus:border-[#2f7cf6]"
                        value={motivo}
                        placeholder="Escreva o motivo…"
                        autoFocus
                        onChange={(event) => setMotivo(event.target.value)}
                        onBlur={() => {
                          if (motivo.trim()) setEditingMotivo(false);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            if (motivo.trim()) setEditingMotivo(false);
                          }
                          if (event.key === "Escape") resetDraft();
                        }}
                      />
                    )}
                  </td>
                  <td className="px-4 py-3 align-middle">
                    <span className={priorityClass("high")}>Alta</span>
                  </td>
                  <td className="px-4 py-3 align-middle">
                    <div className="flex h-8 items-center justify-center gap-2">
                      <div className="inline-flex h-7 overflow-hidden rounded-md border border-[#2a4060] bg-[#07111f]">
                        <button
                          type="button"
                          className="inline-flex h-full items-center gap-1 border-r border-[#2a4060] px-2.5 text-xs font-medium text-emerald-300 transition-colors hover:bg-emerald-500/15 disabled:opacity-50"
                          disabled={!canDecide}
                          onClick={() => void commitDraft("APPLIED")}
                        >
                          {adding ? (
                            <Loader2 className="size-3.5 animate-spin" aria-hidden />
                          ) : (
                            <Check className="size-3.5" />
                          )}
                          {adding ? "Salvando" : "Aplicar"}
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
                        className="inline-flex size-7 items-center justify-center rounded-md text-[#6b7f9a] hover:bg-[#122038] hover:text-white disabled:opacity-50"
                        disabled={adding}
                        aria-label="Cancelar"
                        title="Cancelar"
                        onClick={resetDraft}
                      >
                        <X className="size-3.5" />
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
