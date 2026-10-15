import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { deleteChatbotQuickReplyFn, listChatbotQuickRepliesFn, saveChatbotQuickReplyFn } from "@/lib/chatbot.functions";
import type { ChatbotQuickReply } from "@/lib/chatbot-evo";
import { Field } from "./common";

export function QuickReplies() {
  const [replies, setReplies] = useState<ChatbotQuickReply[]>([]);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [editingId, setEditingId] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    const result = await listChatbotQuickRepliesFn();
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    setReplies(result.data);
  }

  useEffect(() => {
    void load();
  }, []);

  function reset() {
    setTitle("");
    setText("");
    setEditingId("");
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    const result = await saveChatbotQuickReplyFn({ data: { title, text, replyId: editingId } });
    setSaving(false);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    reset();
    setMessage("");
    await load();
  }

  async function remove(replyId: string) {
    const result = await deleteChatbotQuickReplyFn({ data: { replyId } });
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    if (editingId === replyId) reset();
    setMessage("");
    await load();
  }

  return (
    <>
      {message ? <p className="info-note mb-5">{message}</p> : null}
      <form className="tag-form" onSubmit={(event) => void save(event)}>
        <Field label="Título">
          <input value={title} maxLength={80} onChange={(event) => setTitle(event.target.value)} placeholder="Ex.: Saudação" />
        </Field>
        <Field label="Texto">
          <textarea value={text} maxLength={1000} rows={4} onChange={(event) => setText(event.target.value)} placeholder="Texto enviado ao contato" />
        </Field>
        <div className="quick-reply-actions">
          {editingId ? (
            <Button type="button" variant="ghost" onClick={reset}>
              Cancelar
            </Button>
          ) : null}
          <Button type="submit" disabled={saving || title.trim().length < 2 || text.trim().length < 2}>
            {saving ? "Salvando" : editingId ? "Atualizar resposta" : "Gravar resposta"}
          </Button>
        </div>
      </form>
      {replies.length ? (
        <ul className="quick-reply-list">
          {replies.map((item) => (
            <li key={item.id}>
              <strong>{item.title}</strong>
              <p>{item.text}</p>
              <div className="quick-reply-actions">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setEditingId(item.id);
                    setTitle(item.title);
                    setText(item.text);
                    setMessage("");
                  }}
                >
                  Editar
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => void remove(item.id)}>
                  Excluir
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="info-note">Nenhuma resposta rápida gravada ainda.</p>
      )}
    </>
  );
}
