import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { listChatbotStagesFn, saveChatbotStagesFn } from "@/lib/chatbot.functions";
import { kanbanStageName, moveKanbanStage } from "@/lib/chatbot-evo";
import { useWorkspace } from "@/lib/chatbot/store";
import { Field } from "./common";

export function KanbanStages() {
  const { update } = useWorkspace();
  const [stages, setStages] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [ready, setReady] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void listChatbotStagesFn().then((result) => {
      if (!result.ok) {
        setMessage(result.message);
        return;
      }
      const names = result.data.stages.map((item) => item.name);
      setStages(names);
      setReady(result.data.ready);
      update((current) => ({ ...current, stages: names }));
    });
  }, []);

  async function persist(next: string[], previousName = "", replacement = "") {
    if (!ready) {
      setMessage("A migração das etapas do kanban ainda não foi aplicada no Supabase.");
      return false;
    }
    setSaving(true);
    const result = await saveChatbotStagesFn({ data: { names: next } });
    setSaving(false);
    if (!result.ok) {
      setMessage(result.message);
      return false;
    }
    const names = result.data.map((item) => item.name);
    setStages(names);
    setMessage("");
    update((current) => ({
      ...current,
      stages: names,
      opportunities: current.opportunities.map((item) => (previousName && item.stage === previousName ? { ...item, stage: replacement } : item)),
    }));
    return true;
  }

  async function add(event: FormEvent) {
    event.preventDefault();
    const nextName = kanbanStageName(name);
    if (!nextName) {
      setMessage("A etapa precisa de um nome com 2 a 40 caracteres.");
      return;
    }
    if (stages.some((item) => item.toLowerCase() === nextName.toLowerCase())) {
      setMessage("Já existe uma etapa com esse nome.");
      return;
    }
    if (await persist([...stages, nextName])) setName("");
  }

  async function remove(index: number) {
    if (stages.length < 2) {
      setMessage("O kanban precisa de ao menos uma etapa.");
      return;
    }
    const removed = stages[index];
    if (!removed) return;
    const next = stages.filter((_, item) => item !== index);
    const fallback = next[Math.max(0, index - 1)] ?? next[0] ?? "";
    await persist(next, removed, fallback);
  }

  return (
    <div>
      {message ? <p className="info-note mb-5">{message}</p> : null}
      <form className="tag-form" onSubmit={(event) => void add(event)}>
        <Field label="Nome da etapa">
          <input value={name} maxLength={40} disabled={!ready || saving} onChange={(event) => setName(event.target.value)} placeholder="Ex.: Contrato enviado" />
        </Field>
        <Button type="submit" disabled={!ready || saving || name.trim().length < 2}>
          {saving ? "Salvando" : "Gravar etapa"}
        </Button>
      </form>
      <ol className="stage-list">
        {stages.map((item, index) => (
          <li key={item}>
            <span>
              {index + 1}. {item}
            </span>
            <span className="stage-actions">
              <Button type="button" variant="ghost" size="sm" disabled={!ready || saving || index === 0} onClick={() => void persist(moveKanbanStage(stages, index, -1))}>
                Subir
              </Button>
              <Button type="button" variant="ghost" size="sm" disabled={!ready || saving || index === stages.length - 1} onClick={() => void persist(moveKanbanStage(stages, index, 1))}>
                Descer
              </Button>
              <Button type="button" variant="ghost" size="sm" disabled={!ready || saving} onClick={() => void remove(index)}>
                Excluir
              </Button>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
