import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { deleteChatbotTagFn, listChatbotTagsFn, saveChatbotTagFn } from "@/lib/chatbot.functions";
import { tagInk, type ChatbotTag } from "@/lib/chatbot-evo";
import { Field, PageHeading } from "./common";

const tagColors = ["#6F02FD", "#16A34A", "#2563EB", "#D97706", "#DC2626", "#DB2777", "#0F766E", "#111827"];

export function TagSettings() {
  const [tags, setTags] = useState<ChatbotTag[]>([]);
  const [name, setName] = useState("");
  const [color, setColor] = useState(tagColors[0]);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    const result = await listChatbotTagsFn();
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    setTags(result.data);
  }

  useEffect(() => {
    void load();
  }, []);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    const result = await saveChatbotTagFn({ data: { name, color } });
    setSaving(false);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    setName("");
    setMessage("");
    await load();
  }

  async function remove(tagId: string) {
    const result = await deleteChatbotTagFn({ data: { tagId } });
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    setMessage("");
    await load();
  }

  const preview = name.trim() || "Etiqueta";

  return (
    <main className="page">
      <PageHeading title="Etiquetas" description="Nome e cor usados no cadastro do contato." />
      {message ? <p className="info-note mb-5">{message}</p> : null}
      <form className="tag-form" onSubmit={(event) => void save(event)}>
        <Field label="Nome">
          <input value={name} maxLength={32} onChange={(event) => setName(event.target.value)} placeholder="Ex.: Quente" />
        </Field>
        <Field label="Cor">
          <input className="tag-color" type="color" value={color} onChange={(event) => setColor(event.target.value)} />
        </Field>
        <div className="tag-swatches" aria-label="Cores prontas">
          {tagColors.map((item) => (
            <button key={item} type="button" className={`tag-swatch${item.toLowerCase() === color.toLowerCase() ? " selected" : ""}`} style={{ background: item }} aria-label={item} onClick={() => setColor(item)} />
          ))}
        </div>
        <div className="tag-live">
          <span>Prévia</span>
          <span className="tag-chip selected" style={{ background: color, color: tagInk(color), borderColor: color }}>
            {preview}
          </span>
        </div>
        <Button type="submit" disabled={saving || name.trim().length < 2}>
          {saving ? "Salvando" : "Gravar etiqueta"}
        </Button>
      </form>
      {tags.length ? (
        <ul className="tag-list">
          {tags.map((item) => (
            <li key={item.id}>
              <span className="tag-chip selected" style={{ background: item.color, color: tagInk(item.color), borderColor: item.color }}>
                {item.name}
              </span>
              <Button type="button" variant="ghost" size="sm" onClick={() => void remove(item.id)}>
                Excluir
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="info-note">Nenhuma etiqueta gravada ainda. A prévia acima mostra como ela ficará no contato.</p>
      )}
    </main>
  );
}
