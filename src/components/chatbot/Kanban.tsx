import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Plus, MessageSquare, Columns3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { listChatbotStagesFn } from "@/lib/chatbot.functions";
import { useWorkspace, uid } from "@/lib/chatbot/store";
import { money } from "@/lib/chatbot/model";
import { Modal, Field, SaveActions } from "./common";

export function Kanban() {
  const { data, update } = useWorkspace();
  const navigate = useNavigate();
  const [modal, setModal] = useState(false);
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState("");
  const funnel = data.funnels[0] || "Funil principal";

  useEffect(() => {
    void listChatbotStagesFn().then((result) => {
      if (!result.ok) return;
      const stages = result.data.stages.map((item) => item.name);
      if (stages.length) update((current) => ({ ...current, stages }));
    });
  }, []);

  function move(id: string, stage: string) {
    update((current) => ({
      ...current,
      opportunities: current.opportunities.map((item) => (item.id === id ? { ...item, stage } : item)),
    }));
  }

  return (
    <main className="page kanban-page">
      <div className="table-toolbar mb-5 rounded-md border bg-card">
        <input placeholder="Buscar oportunidade ou cliente" value={search} onChange={(event) => setSearch(event.target.value)} aria-label="Buscar oportunidade ou cliente" />
      </div>
      <div className="kanban-board">
        {data.stages.map((stage) => {
          const items = data.opportunities.filter((item) => {
            const contact = data.contacts.find((person) => person.id === item.contactId)?.name ?? "";
            return item.stage === stage && item.funnel === funnel && `${item.title} ${contact}`.toLowerCase().includes(search.toLowerCase());
          });
          return (
            <section
              key={stage}
              className="kanban-column"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                move(event.dataTransfer.getData("opportunity"), stage);
              }}
            >
              <h2>
                {stage}
                <span className="count">{items.length}</span>
              </h2>
              <p className="column-total">{money(items.reduce((sum, item) => sum + item.value, 0))}</p>
              {items.map((item) => {
                const contact = data.contacts.find((person) => person.id === item.contactId);
                return (
                  <article key={item.id} className="kanban-card" draggable onDragStart={(event) => event.dataTransfer.setData("opportunity", item.id)}>
                    <strong>{contact?.name}</strong>
                    <p>{item.title}</p>
                    <p>{data.products.find((product) => product.id === item.productId)?.name || "Sem produto vinculado"}</p>
                    <select value={item.stage} onChange={(event) => move(item.id, event.target.value)} aria-label={`Etapa de ${item.title}`}>
                      {data.stages.map((option) => (
                        <option key={option}>{option}</option>
                      ))}
                    </select>
                    <footer>
                      <strong>{money(item.value)}</strong>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Abrir conversa do cliente"
                        onClick={() => {
                          const conversation = data.conversations.find((entry) => entry.contactId === item.contactId);
                          if (conversation) {
                            update((current) => ({ ...current, activeConversationId: conversation.id }));
                            void navigate({ to: "/chatbot" });
                          } else setNotice("Este cliente ainda não possui uma conversa. Crie uma na caixa de entrada.");
                        }}
                      >
                        <MessageSquare />
                      </Button>
                    </footer>
                  </article>
                );
              })}
              {!items.length ? (
                <div className="text-center text-xs text-muted-foreground py-10">
                  <Columns3 className="mx-auto mb-3 size-5 opacity-40" />
                  Nenhuma oportunidade
                </div>
              ) : null}
              <Button variant="ghost" className="w-full text-xs" onClick={() => setModal(true)}>
                <Plus />
                Adicionar oportunidade
              </Button>
            </section>
          );
        })}
      </div>
      {notice ? <p className="info-note mt-4">{notice}</p> : null}
      <Modal title="Nova oportunidade" open={modal} onClose={() => setModal(false)}>
        <form
          className="modal-form"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            update((current) => ({
              ...current,
              opportunities: [
                ...current.opportunities,
                {
                  id: uid(),
                  title: String(form.get("title")),
                  contactId: String(form.get("contact")),
                  productId: String(form.get("product")),
                  value: Number(form.get("value")),
                  stage: String(form.get("stage")),
                  funnel,
                },
              ],
            }));
            setModal(false);
          }}
        >
          <Field label="Título da oportunidade">
            <input name="title" required />
          </Field>
          <Field label="Cliente">
            <select name="contact" required>
              <option value="">Selecione</option>
              {data.contacts.map((contact) => (
                <option key={contact.id} value={contact.id}>
                  {contact.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Produto / serviço">
            <select name="product">
              <option value="">Sem produto</option>
              {data.products
                .filter((product) => product.active)
                .map((product) => (
                  <option value={product.id} key={product.id}>
                    {product.name}
                  </option>
                ))}
            </select>
          </Field>
          <div className="form-grid">
            <Field label="Valor estimado (R$)">
              <input name="value" type="number" min="0" step="0.01" required />
            </Field>
            <Field label="Etapa">
              <select name="stage">
                {data.stages.map((stage) => (
                  <option key={stage}>{stage}</option>
                ))}
              </select>
            </Field>
          </div>
          <SaveActions onClose={() => setModal(false)} />
        </form>
      </Modal>
    </main>
  );
}
