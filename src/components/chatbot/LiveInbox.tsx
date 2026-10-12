import { useEffect, useState } from "react";
import { MessageSquare, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { chatbotSnapshotFn, sendChatbotMessageFn } from "@/lib/chatbot.functions";
import type { ChatbotSnapshot } from "@/lib/chatbot-evo";

export function LiveInbox() {
  const [data, setData] = useState<ChatbotSnapshot | null>(null);
  const [selected, setSelected] = useState("");
  const [draft, setDraft] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function load() {
    const result = await chatbotSnapshotFn();
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    setData(result.data);
    setMessage("");
    setSelected((current) =>
      result.data.conversations.some((item) => item.id === current) ? current : "",
    );
  }

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 5000);
    return () => window.clearInterval(timer);
  }, []);

  const conversation = data?.conversations.find((item) => item.id === selected);
  const contact = data?.contacts.find((item) => item.id === conversation?.contactId);
  const messages = data?.messages.filter((item) => item.conversationId === selected) ?? [];

  async function send() {
    if (!selected) return;
    setPending(true);
    const result = await sendChatbotMessageFn({ data: { conversationId: selected, text: draft } });
    setPending(false);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    setDraft("");
    await load();
  }

  return (
    <main className="page">
      <div className="page-heading">
        <div>
          <h1>Caixa de Entrada</h1>
          <p>Mensagens reais da empresa, recebidas pela Evolution API.</p>
        </div>
      </div>
      {message ? <p className="info-note mb-5">{message}</p> : null}
      <div className={`inbox-layout${selected ? " chat-selected" : ""}`}>
        <section className="conversation-list">
          <div className="list-tools">
            <h2>
              Conversas <span className="count">{data?.conversations.length ?? 0}</span>
            </h2>
          </div>
          {data?.conversations.length ? (
            data.conversations.map((item) => {
              const person = data.contacts.find((contact) => contact.id === item.contactId);
              return (
                <Button
                  key={item.id}
                  variant="ghost"
                  className={`conversation-row ${item.id === selected ? "selected" : ""}`}
                  onClick={() => setSelected(item.id)}
                >
                  <span className="avatar">{person?.name.slice(0, 2).toUpperCase()}</span>
                  <div>
                    <strong>{person?.name}</strong>
                    <p>{person?.phone}</p>
                    <span className="status-pill">{item.status === "queue" ? "Em fila" : item.status === "closed" ? "Encerrado" : "Em atendimento"}</span>
                  </div>
                </Button>
              );
            })
          ) : (
            <div className="list-empty">
              <MessageSquare size={27} />
              <strong>Nenhuma conversa por aqui</strong>
              <p>As mensagens aparecem quando um WhatsApp conectado receber um contato.</p>
            </div>
          )}
        </section>
        <section className="chat-area">
          <div className="chat-top">
            <Button variant="ghost" size="sm" className="lg:hidden" onClick={() => setSelected("")}>
              Conversas
            </Button>
            <span>
              <MessageSquare size={15} />
              {contact?.name || "Nenhuma conversa selecionada"}
            </span>
          </div>
          {conversation ? (
            <>
              <div className="message-history">
                {messages.map((item) => (
                  <div className="message-bubble" key={item.id} style={item.direction === "in" ? { alignSelf: "flex-start", background: "var(--card)", color: "var(--foreground)" } : undefined}>
                    {item.text}
                  </div>
                ))}
              </div>
              <form
                className="composer"
                onSubmit={(event) => {
                  event.preventDefault();
                  void send();
                }}
              >
                <textarea value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Digite sua mensagem..." aria-label="Mensagem" />
                <footer>
                  <Button disabled={pending || !draft.trim()} type="submit">
                    <Send />
                    {pending ? "Enviando" : "Enviar"}
                  </Button>
                </footer>
              </form>
            </>
          ) : (
            <div className="chat-empty">
              <h2>Conecte um WhatsApp para começar</h2>
              <p>O QR Code fica no menu Conexão.</p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
