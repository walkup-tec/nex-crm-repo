import { useEffect, useState } from "react";
import { Check, Copy, Loader2, X } from "lucide-react";
import type { PipelineProgress, PipelineStepState } from "@/lib/nex-intelligence/pipeline/progress";

type OverallTone = "running" | "completed" | "error" | "interrupted" | "idle";

function StepIcon({ status }: { status: PipelineStepState["status"] }) {
  if (status === "running") {
    return (
      <Loader2
        className="size-3.5 shrink-0 animate-spin text-[#3ecbff]"
        aria-hidden
      />
    );
  }
  if (status === "completed") {
    return <Check className="size-3.5 shrink-0 text-emerald-400" aria-hidden strokeWidth={2.5} />;
  }
  if (status === "error") {
    return <X className="size-3.5 shrink-0 text-rose-400" aria-hidden strokeWidth={2.5} />;
  }
  return (
    <span
      className="inline-block size-3.5 shrink-0 rounded-full border border-[#2a3f5c] bg-[#0a1524]"
      aria-hidden
    />
  );
}

function stepStatusLabel(status: PipelineStepState["status"]) {
  if (status === "running") return "Andamento";
  if (status === "completed") return "Concluído";
  if (status === "error") return "Erro";
  return "Pendente";
}

function overallBadge(tone: OverallTone, label: string) {
  const className =
    tone === "running"
      ? "border-[#1d6feb]/35 bg-[#1d6feb]/10 text-[#9ec5ff]"
      : tone === "completed"
        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
        : tone === "error"
          ? "border-rose-500/30 bg-rose-500/10 text-rose-200"
          : tone === "interrupted"
            ? "border-amber-500/30 bg-amber-500/10 text-amber-200"
            : "border-[#1e3a5f] bg-[#07111f] text-[#8fa3bf]";
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${className}`}
    >
      {label}
    </span>
  );
}

export function ExecutionPipelineStatus({
  executionId,
  protocolVersion,
  overallTone,
  overallLabel,
  pipelineProgress,
  footnote,
  onRefresh,
}: {
  executionId: string | null;
  protocolVersion: string | null;
  overallTone: OverallTone;
  overallLabel: string;
  pipelineProgress: PipelineProgress | null;
  footnote?: string | null;
  onRefresh?: (() => void) | null;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1600);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const copyId = async () => {
    if (!executionId) return;
    try {
      await navigator.clipboard.writeText(executionId);
      setCopied(true);
    } catch {
      try {
        const area = document.createElement("textarea");
        area.value = executionId;
        area.setAttribute("readonly", "");
        area.style.position = "fixed";
        area.style.left = "-9999px";
        document.body.appendChild(area);
        area.select();
        document.execCommand("copy");
        document.body.removeChild(area);
        setCopied(true);
      } catch {
        setCopied(false);
      }
    }
  };

  if (!executionId && overallTone === "idle") return null;

  return (
    <div className="space-y-2 rounded-lg border border-[#1e3a5f] bg-[#07111f]/60 px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#8fa3bf]">
        {overallTone === "running" ? (
          <Loader2 className="size-3.5 shrink-0 animate-spin text-[#3ecbff]" aria-hidden />
        ) : overallTone === "completed" ? (
          <Check className="size-3.5 shrink-0 text-emerald-400" aria-hidden strokeWidth={2.5} />
        ) : overallTone === "error" ? (
          <X className="size-3.5 shrink-0 text-rose-400" aria-hidden strokeWidth={2.5} />
        ) : null}
        <span className="text-[#d5e0ef]">Execução</span>
        {executionId ? (
          <button
            type="button"
            onClick={() => void copyId()}
            title="Clique para copiar o ID"
            aria-label={copied ? "ID copiado" : "Copiar ID da execução"}
            className="inline-flex max-w-full items-center gap-1 rounded bg-[#0a1524] px-1.5 py-0.5 font-mono text-[11px] text-[#7eb6ff] transition hover:bg-[#102038] hover:text-[#a8ccff] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#3ecbff]/50"
          >
            <code className="truncate">{executionId}</code>
            {copied ? (
              <Check className="size-3 shrink-0 text-emerald-400" aria-hidden />
            ) : (
              <Copy className="size-3 shrink-0 opacity-70" aria-hidden />
            )}
          </button>
        ) : (
          <span className="text-[#6b7f9a]">preparando…</span>
        )}
        {protocolVersion ? <span>· protocolo {protocolVersion}</span> : null}
        {overallBadge(overallTone, overallLabel)}
        {copied ? <span className="text-emerald-300">ID copiado</span> : null}
        {onRefresh ? (
          <button
            type="button"
            className="text-[#7eb6ff] underline-offset-2 hover:underline"
            onClick={onRefresh}
          >
            Atualizar execução
          </button>
        ) : null}
      </div>

      {pipelineProgress?.steps?.length ? (
        <ul className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-4">
          {pipelineProgress.steps.map((step) => (
            <li
              key={step.id}
              className="flex items-start gap-2 rounded-md border border-[#15263d] bg-[#050d18]/80 px-2.5 py-1.5"
            >
              <StepIcon status={step.status} />
              <div className="min-w-0">
                <p className="truncate text-[11px] font-medium text-[#d5e0ef]">{step.label}</p>
                <p
                  className={
                    step.status === "error"
                      ? "text-[10px] text-rose-300"
                      : step.status === "completed"
                        ? "text-[10px] text-emerald-300/90"
                        : step.status === "running"
                          ? "text-[10px] text-[#9ec5ff]"
                          : "text-[10px] text-[#6b7f9a]"
                  }
                >
                  {stepStatusLabel(step.status)}
                  {step.status === "error" && step.error ? ` — ${step.error}` : ""}
                </p>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {footnote ? <p className="text-[11px] text-[#6b7f9a]">{footnote}</p> : null}
      <span className="sr-only">
        {overallLabel}
        {executionId ? ` · ID ${executionId}` : ""}
      </span>
    </div>
  );
}
