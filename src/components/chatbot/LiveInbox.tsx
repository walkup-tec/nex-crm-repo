import { MessageSquare, Send } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { chatbotMessageMediaFn, chatbotSnapshotFn, saveChatbotContactMediaFn, sendChatbotMessageFn } from "@/lib/chatbot.functions";
import { attendanceLabel, whatsappMask, type ChatbotSnapshot } from "@/lib/chatbot-evo";

type InboxMessage = ChatbotSnapshot["messages"][number];
type LoadedMedia = { url: string; mime: string; base64: string; kind: "image" | "video" };
const loadedMedia = new Map<string, LoadedMedia | { none: true }>();

function mediaCaption(text: string) {
  if (text === "[mensagem]" || text === "[imagem]" || text === "[vídeo]") return "";
  return text;
}

function expectsMedia(item: InboxMessage) {
  return item.mediaKind === "image" || item.mediaKind === "video" || item.text === "[mensagem]" || item.text === "[imagem]" || item.text === "[vídeo]";
}

function downloadMedia(file: LoadedMedia) {
  const bytes = Uint8Array.from(atob(file.base64), (char) => char.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: file.mime }));
  const link = document.createElement("a");
  link.href = url;
  link.download = file.kind === "video" ? "video.mp4" : "imagem.jpg";
  link.click();
  URL.revokeObjectURL(url);
}

function ChatMedia({ item }: { item: InboxMessage }) {
  const cached = loadedMedia.get(item.id);
  const [file, setFile] = useState<LoadedMedia | null>(cached && !("none" in cached) ? cached : null);
  const [missing, setMissing] = useState(Boolean(cached && "none" in cached));
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(item.saved);

  useEffect(() => setSaved(item.saved), [item.saved]);

  useEffect(() => {
    const current = loadedMedia.get(item.id);
    if (current) {
      if ("none" in current) setMissing(true);
      else setFile(current);
      return;
    }
    let active = true;
    void chatbotMessageMediaFn({ data: { messageId: item.id } }).then((result) => {
      if (!active) return;
      if (!result.ok) {
        setError(result.message);
        return;
      }
      if (!result.data.kind) {
        loadedMedia.set(item.id, { none: true });
        setMissing(true);
        return;
      }
      const next = {
        url: `data:${result.data.mime};base64,${result.data.base64}`,
        mime: result.data.mime,
        base64: result.data.base64,
        kind: result.data.kind,
      };
      loadedMedia.set(item.id, next);
      setFile(next);
    });
    return () => {
      active = false;
    };
  }, [item.id]);

  if (missing) {
    return <div className={`message-bubble ${item.direction === "in" ? "in" : "out"}`}>{item.text}</div>;
  }
  if (!file) {
    return <div className="message-bubble media">{error || "Carregando mídia"}</div>;
  }
  const caption = mediaCaption(item.text);
  return (
    <div className={`message-bubble media ${item.direction}`}>
      {file.kind === "video" ? <video src={file.url} controls /> : <img src={file.url} alt="" />}
      {caption ? <p>{caption}</p> : null}
      <div className="media-actions">
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(true)}>
          Abrir
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={saving || saved}
          onClick={() => {
            setSaving(true);
            void saveChatbotContactMediaFn({ data: { messageId: item.id } }).then((result) => {
              setSaving(false);
              if (!result.ok) {
                setError(result.message);
                return;
              }
              setSaved(true);
              setError("");
            });
          }}
        >
          {saved ? "Salvo no contato" : saving ? "Salvando" : "Salvar"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => downloadMedia(file)}>
          Baixar
        </Button>
      </div>
      {error ? <p>{error}</p> : null}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>{file.kind === "video" ? "Vídeo" : "Imagem"}</DialogTitle>
          </DialogHeader>
          {file.kind === "video" ? <video className="media-frame" src={file.url} controls autoPlay /> : <img className="media-frame" src={file.url} alt="" />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ContactAvatar({ name, avatarUrl }: { name: string; avatarUrl: string }) {
  const [hidden, setHidden] = useState(false);
  const initials = (name || "?").slice(0, 2).toUpperCase();
  useEffect(() => setHidden(false), [avatarUrl]);
  if (!avatarUrl || hidden) return <span className="avatar">{initials}</span>;
  return (
    <span className="avatar">
      <img src={avatarUrl} alt="" onError={() => setHidden(true)} />
    </span>
  );
}

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
  const channel = data?.connections.find((item) => item.id === conversation?.connectionId)?.name ?? "";
  const messages = data?.messages.filter((item) => item.conversationId === selected) ?? [];

  function labelFor(conversationId: string) {
    const current = data?.conversations.find((item) => item.id === conversationId);
    if (!current || !data) return "Em fila";
    const botSpoke = data.messages.some((item) => item.conversationId === conversationId && item.direction === "out");
    return attendanceLabel({
      assigneeName: current.assigneeName,
      botPaused: current.botPaused,
      botSpoke,
      closed: current.status === "closed",
    });
  }

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
              const channel = data.connections.find((connection) => connection.id === item.connectionId)?.name ?? "";
              return (
                <Button
                  key={item.id}
                  variant="ghost"
                  className={`conversation-row ${item.id === selected ? "selected" : ""}`}
                  onClick={() => setSelected(item.id)}
                >
                  <ContactAvatar name={person?.name ?? ""} avatarUrl={person?.avatarUrl ?? ""} />
                  <div>
                    <strong>{person?.name}</strong>
                    <p>{whatsappMask(person?.phone ?? "") || person?.phone}</p>
                    <div className="conversation-tags">
                      {channel ? <span className="status-pill">{channel}</span> : null}
                      <span className="status-pill">{labelFor(item.id)}</span>
                    </div>
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
              {channel ? <span className="status-pill">{channel}</span> : null}
              {conversation ? <span className="status-pill">{labelFor(conversation.id)}</span> : null}
            </span>
          </div>
          {conversation ? (
            <>
              <div className="message-history">
                {messages.map((item) =>
                  expectsMedia(item) ? (
                    <ChatMedia item={item} key={item.id} />
                  ) : (
                    <div className={`message-bubble ${item.direction === "in" ? "in" : "out"}`} key={item.id}>
                      {item.text}
                    </div>
                  ),
                )}
              </div>
              <form
                className="composer"
                onSubmit={(event) => event.preventDefault()}
              >
                <textarea
                  value={draft}
                  disabled={pending}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter" || event.shiftKey || pending || !draft.trim()) return;
                    event.preventDefault();
                    void send();
                  }}
                  placeholder="Escreva a resposta para este contato..."
                  aria-label="Resposta"
                  rows={3}
                />
                <footer className="composer-actions">
                  <Button type="button">
                    <Send />
                    Enviar
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
