import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { deleteChatbotProductFn, listChatbotProductsFn, saveChatbotProductFn } from "@/lib/chatbot.functions";
import type { ChatbotCatalogItem } from "@/lib/chatbot-evo";
import { Field, PageHeading } from "./common";

export function LiveProducts({ embedded = false }: { embedded?: boolean }) {
  const [products, setProducts] = useState<ChatbotCatalogItem[]>([]);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    const result = await listChatbotProductsFn();
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    setProducts(result.data);
  }

  useEffect(() => {
    void load();
  }, []);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    const result = await saveChatbotProductFn({ data: { name } });
    setSaving(false);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    setName("");
    setMessage("");
    await load();
  }

  async function remove(productId: string) {
    const result = await deleteChatbotProductFn({ data: { productId } });
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    setMessage("");
    await load();
  }

  const body = (
    <>
      {message ? <p className="info-note mb-5">{message}</p> : null}
      <form className="tag-form" onSubmit={(event) => void save(event)}>
        <Field label="Produto ou serviço">
          <input value={name} maxLength={80} onChange={(event) => setName(event.target.value)} placeholder="Ex.: Consórcio" />
        </Field>
        <Button type="submit" disabled={saving || name.trim().length < 2}>
          {saving ? "Salvando" : "Gravar"}
        </Button>
      </form>
      {products.length ? (
        <ul className="tag-list">
          {products.map((item) => (
            <li key={item.id}>
              <strong>{item.name}</strong>
              <Button type="button" variant="ghost" size="sm" onClick={() => void remove(item.id)}>
                Excluir
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="info-note">Nenhum produto gravado. Eles aparecem no cadastro do contato, na caixa de entrada.</p>
      )}
    </>
  );
  if (embedded) return body;
  return (
    <main className="page">
      <PageHeading title="Produtos" description="Produtos e serviços que podem ser vinculados ao contato." />
      {body}
    </main>
  );
}
