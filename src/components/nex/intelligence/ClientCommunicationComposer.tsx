import { useEffect, useState } from "react";
import type { SuggestedTask } from "@/lib/nex-intelligence/dashboard/types";
import { ni } from "@/components/nex/intelligence/intelligence-theme";
import { Copy, MessageCircle, RefreshCw } from "lucide-react";

type Props = {
  clientName: string;
  campaignNames: string[];
  tasks: SuggestedTask[];
  sending?: boolean;
  onSend?: (text: string) => void | Promise<void>;
};

function formatCampaignBlock(names: string[]): string {
  const cleaned = names.map((name) => name.trim()).filter(Boolean);
  if (cleaned.length === 0) {
    return "Realizamos otimizações na campanha selecionada:";
  }
  const list = cleaned.map((name) => `- ${name}`).join("\n");
  return `Realizamos otimizações na campanha:\n${list}`;
}

function buildDraft(input: {
  clientName: string;
  campaignNames: string[];
  applied: SuggestedTask[];
}): string {
  if (!input.applied.length) {
    return "Nenhuma otimização concluída para comunicar. Aplique tarefas antes de gerar o texto.";
  }
  const items = input.applied
    .map((task) => {
      const reason = task.justification?.trim() || "sem motivo registrado";
      return `• Tarefa: ${task.title}\n  Motivo: ${reason}`;
    })
    .join("\n");
  return `Olá${input.clientName ? `, ${input.clientName}` : ""}!

${formatCampaignBlock(input.campaignNames)}

${items}

Continuaremos acompanhando os indicadores para avaliar o desempenho dessas alterações.`;
}

export function ClientCommunicationComposer({
  clientName,
  campaignNames,
  tasks,
  sending = false,
  onSend,
}: Props) {
  const applied = tasks.filter((task) => task.status === "APPLIED");
  const campaignNamesKey = campaignNames.join("|");
  const [text, setText] = useState(() =>
    buildDraft({ clientName, campaignNames, applied }),
  );
  const [editing, setEditing] = useState(false);
  const [copied, setCopied] = useState(false);

  const appliedKey = applied.map((task) => `${task.id}:${task.status}:${task.justification}`).join("|");

  useEffect(() => {
    if (!editing) {
      setText(buildDraft({ clientName, campaignNames, applied }));
    }
    // Regenera só quando o conjunto aplicado muda; edição manual não é sobrescrita.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientName, campaignNamesKey, appliedKey, editing]);

  return (
    <div className={`${ni.card} flex h-full flex-col`}>
      <div className="border-b border-[#1e3a5f]/70 px-4 py-3">
        <h3 className={ni.title}>Comunicação ao cliente</h3>
        <p className={`mt-1 ${ni.muted}`}>Sugestão a partir apenas de otimizações concluídas</p>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <textarea
          className={`${ni.input} min-h-[180px] flex-1 resize-y p-3`}
          value={text}
          readOnly={!editing}
          onChange={(event) => setText(event.target.value)}
        />
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={ni.btnGhost}
              onClick={() => {
                setEditing(false);
                setText(buildDraft({ clientName, campaignNames, applied }));
              }}
            >
              <RefreshCw className="size-3.5" />
              Gerar novo texto
            </button>
            <button
              type="button"
              className={ni.btnGhost}
              onClick={async () => {
                await navigator.clipboard.writeText(text);
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1500);
              }}
            >
              <Copy className="size-3.5" />
              {copied ? "Copiado" : "Copiar"}
            </button>
            <button type="button" className={ni.btnGhost} onClick={() => setEditing((v) => !v)}>
              {editing ? "Bloquear edição" : "Editar"}
            </button>
          </div>
          <button
            type="button"
            className={`${ni.btnPrimary} w-full justify-center`}
            disabled={!applied.length || sending}
            onClick={() => void onSend?.(text)}
          >
            <MessageCircle className="size-3.5" />
            {sending ? "Enviando…" : "Enviar ao cliente"}
          </button>
        </div>
        {!applied.length ? (
          <p className={ni.muted}>Envio bloqueado até haver ao menos uma tarefa aplicada.</p>
        ) : (
          <p className={ni.muted}>
            Ao enviar, a mensagem vai para o WhatsApp cadastrado do cliente (campanha, tarefa e
            motivo).
          </p>
        )}
      </div>
    </div>
  );
}
