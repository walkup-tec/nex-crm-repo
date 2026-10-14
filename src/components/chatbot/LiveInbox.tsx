import { MessageSquare, Pause, Pin, Play, Send } from "lucide-react";
import { useEffect, useRef, useState, type MouseEvent } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  chatbotMessageMediaFn,
  chatbotSnapshotFn,
  finishChatbotConversationFn,
  markChatbotConversationReadFn,
  saveChatbotContactMediaFn,
  sendChatbotMessageFn,
  setChatbotConversationPinFn,
} from "@/lib/chatbot.functions";
import { ContactRecord } from "@/components/chatbot/ContactRecord";
import { acceptSnapshot, attendanceLabel, audioDurationLabel, audioWaveBars, composerSendsOnEnter, headerAttendant, messageClock, pendingOutgoing, stickToLatestMessage, whatsappMask, type ChatbotSnapshot } from "@/lib/chatbot-evo";

type InboxMessage = ChatbotSnapshot["messages"][number];
type OutgoingPreview = { id: string; conversationId: string; text: string; createdAt: string };
type LoadedMedia = { url: string; mime: string; base64: string; kind: "image" | "video" | "audio" };
const loadedMedia = new Map<string, LoadedMedia | { none: true }>();

function mediaCaption(text: string) {
  if (text === "[mensagem]" || text === "[imagem]" || text === "[vídeo]" || text === "[áudio]") return "";
  return text;
}

function expectsMedia(item: InboxMessage) {
  return item.mediaKind === "image" || item.mediaKind === "video" || item.mediaKind === "audio" || item.text === "[mensagem]" || item.text === "[imagem]" || item.text === "[vídeo]" || item.text === "[áudio]";
}

function downloadMedia(file: LoadedMedia) {
  const bytes = Uint8Array.from(atob(file.base64), (char) => char.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: file.mime }));
  const link = document.createElement("a");
  link.href = url;
  link.download = file.kind === "video" ? "video.mp4" : file.kind === "audio" ? "audio.ogg" : "imagem.jpg";
  link.click();
  URL.revokeObjectURL(url);
}

function VoiceNote({ file, sentAt, outgoing }: { file: LoadedMedia; sentAt: string; outgoing: boolean }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);
  const [bars, setBars] = useState<number[]>(() => Array.from({ length: 32 }, () => 0.22));

  useEffect(() => {
    let active = true;
    const bytes = Uint8Array.from(atob(file.base64), (char) => char.charCodeAt(0));
    const context = new AudioContext();
    void context
      .decodeAudioData(bytes.buffer.slice(0))
      .then((buffer) => {
        if (!active) return;
        setDuration(buffer.duration);
        setBars(audioWaveBars(buffer.getChannelData(0), 32));
      })
      .catch(() => undefined)
      .finally(() => void context.close().catch(() => undefined));
    return () => {
      active = false;
    };
  }, [file.base64]);

  const progress = duration > 0 ? Math.min(1, current / duration) : 0;
  const total = audioDurationLabel(duration);
  const elapsed = audioDurationLabel(current);

  function toggle() {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) void audio.play();
    else audio.pause();
  }

  function seek(event: MouseEvent<HTMLButtonElement>) {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(audio.duration)) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    audio.currentTime = ratio * audio.duration;
    setCurrent(audio.currentTime);
  }

  return (
    <div className={`voice-note${outgoing ? " out" : ""}`}>
      <button type="button" className={`voice-play${playing ? " playing" : ""}`} onClick={toggle} aria-label={playing ? "Pausar áudio" : "Reproduzir áudio"}>
        {playing ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" />}
      </button>
      <button type="button" className="voice-wave" onClick={seek} aria-label="Posição do áudio">
        {bars.map((height, index) => (
          <span key={index} className={index / bars.length < progress ? "played" : ""} style={{ height: `${Math.round(4 + height * 18)}px` }} />
        ))}
      </button>
      <span className="voice-time">{playing ? `${elapsed} / ${total}` : total}</span>
      <audio
        ref={audioRef}
        src={file.url}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setCurrent(0);
        }}
        onTimeUpdate={(event) => setCurrent(event.currentTarget.currentTime)}
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
      />
      <time dateTime={sentAt}>{messageClock(sentAt)}</time>
    </div>
  );
}

function ChatMedia({ item, onSaved }: { item: InboxMessage; onSaved?: () => void }) {
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
    return (
      <div className={`message-bubble ${item.direction === "in" ? "in" : "out"}`}>
        {item.text === "[áudio]" ? "Áudio indisponível" : item.text}
        <time className="message-when" dateTime={item.createdAt}>{messageClock(item.createdAt)}</time>
      </div>
    );
  }
  if (!file) {
    return <div className="message-bubble media">{error || "Carregando mídia"}</div>;
  }
  if (file.kind === "audio") {
    return (
      <div className={`message-bubble media voice ${item.direction}`}>
        <VoiceNote file={file} sentAt={item.createdAt} outgoing={item.direction === "out"} />
        {error ? <p>{error}</p> : null}
      </div>
    );
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
              onSaved?.();
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
      <time className="message-when" dateTime={item.createdAt}>{messageClock(item.createdAt)}</time>
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
  const [finishing, setFinishing] = useState(false);
  const [outgoing, setOutgoing] = useState<OutgoingPreview[]>([]);
  const [savedMedia, setSavedMedia] = useState(0);
  const selectedRef = useRef("");
  const snapshotRequest = useRef(0);
  const appliedSnapshot = useRef(0);
  const inFlight = useRef(false);
  const loadAgain = useRef(false);
  const historyRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const sending = useRef(false);
  selectedRef.current = selected;

  async function load() {
    if (inFlight.current) {
      loadAgain.current = true;
      return;
    }
    inFlight.current = true;
    try {
      do {
        loadAgain.current = false;
        const requestId = snapshotRequest.current + 1;
        snapshotRequest.current = requestId;
        let result: Awaited<ReturnType<typeof chatbotSnapshotFn>>;
        try {
          result = await chatbotSnapshotFn();
        } catch (error) {
          if (!acceptSnapshot(requestId, appliedSnapshot.current)) continue;
          appliedSnapshot.current = requestId;
          setMessage(error instanceof Error ? error.message : "Não foi possível carregar as conversas.");
          continue;
        }
        if (!acceptSnapshot(requestId, appliedSnapshot.current)) continue;
        if (!result.ok) {
          appliedSnapshot.current = requestId;
          setMessage(result.message);
          continue;
        }
        const openId = selectedRef.current;
        const conversations = result.data.conversations;
        appliedSnapshot.current = requestId;
        const next = { ...result.data, conversations };
        setOutgoing((current) => pendingOutgoing(next.messages, current));
        setData(next);
        setMessage((current) => (sending.current ? current : ""));
        setSelected((current) => (next.conversations.some((item) => item.id === current) ? current : ""));
        if (openId && conversations.some((item) => item.id === openId)) {
          void markChatbotConversationReadFn({ data: { conversationId: openId } }).then((marked) => {
            if (!marked.ok) return;
            setData((current) =>
              current
                ? {
                    ...current,
                    conversations: current.conversations.map((item) => (item.id === openId ? { ...item, unreadCount: 0 } : item)),
                  }
                : current,
            );
          });
        }
      } while (loadAgain.current);
    } finally {
      inFlight.current = false;
    }
  }

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 2000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    stickToBottom.current = true;
  }, [selected]);

  const conversation = data?.conversations.find((item) => item.id === selected);
  const contact = data?.contacts.find((item) => item.id === conversation?.contactId);
  const channel = data?.connections.find((item) => item.id === conversation?.connectionId)?.name ?? "";
  const storedMessages = data?.messages.filter((item) => item.conversationId === selected) ?? [];
  const messages: InboxMessage[] = [
    ...storedMessages,
    ...pendingOutgoing(data?.messages ?? [], outgoing)
      .filter((item) => item.conversationId === selected)
      .map((item) => ({
        id: item.id,
        conversationId: item.conversationId,
        text: item.text,
        direction: "out" as const,
        status: "pending" as const,
        createdAt: item.createdAt,
        mediaKind: "" as const,
        mediaMime: "",
        saved: false,
        internal: false,
      })),
  ];

  useEffect(() => {
    const box = historyRef.current;
    if (!box || !stickToBottom.current) return;
    box.scrollTop = box.scrollHeight;
  }, [messages.length, selected]);

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

  function openConversation(id: string) {
    selectedRef.current = id;
    setSelected(id);
    void load();
  }

  async function togglePin(id: string, pinned: boolean) {
    const result = await setChatbotConversationPinFn({ data: { conversationId: id, pinned: !pinned } });
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    await load();
  }

  async function finish(id: string) {
    if (finishing) return;
    setFinishing(true);
    const result = await finishChatbotConversationFn({ data: { conversationId: id } });
    setFinishing(false);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    setData((current) =>
      current
        ? {
            ...current,
            conversations: current.conversations.map((item) =>
              item.id === id ? { ...item, status: "closed", assigneeName: "", mine: false, open: true, botPaused: false } : item,
            ),
          }
        : current,
    );
    setMessage("");
    await load();
  }

  async function send(text = draft) {
    const clean = text.trim();
    if (!selected || !clean || sending.current) return;
    const preview: OutgoingPreview = {
      id: `local-${Date.now()}`,
      conversationId: selected,
      text: clean,
      createdAt: new Date().toISOString(),
    };
    setOutgoing((current) => [...current, preview]);
    setDraft("");
    sending.current = true;
    setPending(true);
    const result = await sendChatbotMessageFn({ data: { conversationId: selected, text: clean } });
    sending.current = false;
    setPending(false);
    if (!result.ok) {
      setOutgoing((current) => current.filter((item) => item.id !== preview.id));
      setDraft(clean);
      setMessage(result.message);
      return;
    }
    setMessage("");
    void load();
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
              const unread = item.unreadCount > 99 ? "99+" : String(item.unreadCount);
              return (
                <div
                  key={item.id}
                  role="button"
                  tabIndex={0}
                  className={`conversation-row ${item.id === selected ? "selected" : ""} ${item.unreadCount ? "unread" : ""}`}
                  onClick={() => openConversation(item.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      openConversation(item.id);
                    }
                  }}
                >
                  <ContactAvatar name={person?.name ?? ""} avatarUrl={person?.avatarUrl ?? ""} />
                  <div className="conversation-main">
                    <strong>{person?.name}</strong>
                    <p>{whatsappMask(person?.phone ?? "") || person?.phone}</p>
                    <div className="conversation-tags">
                      {channel ? <span className="status-pill">{channel}</span> : null}
                      <span className="status-pill">{labelFor(item.id)}</span>
                    </div>
                  </div>
                  <div className="conversation-side">
                    {item.unreadCount > 0 ? <span className="unread-count">{unread}</span> : null}
                    <button
                      type="button"
                      className={`pin-toggle${item.pinned ? " pinned" : ""}`}
                      aria-label={item.pinned ? "Desafixar conversa" : "Fixar conversa"}
                      onClick={(event) => {
                        event.stopPropagation();
                        void togglePin(item.id, item.pinned);
                      }}
                    >
                      <Pin size={14} />
                    </button>
                  </div>
                </div>
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
            {conversation ? (
              <div className="chat-identity">
                <span>
                  <small>Canal</small>
                  <strong>{channel || "Sem canal"}</strong>
                </span>
                <span>
                  <small>Atendente</small>
                  <strong>{headerAttendant(conversation.assigneeName)}</strong>
                </span>
              </div>
            ) : (
              <span>
                <MessageSquare size={15} />
                Nenhuma conversa selecionada
              </span>
            )}
            {conversation ? (
              <Button type="button" size="sm" disabled={finishing || !conversation.assigneeName.trim()} onClick={() => void finish(conversation.id)}>
                {finishing ? "Finalizando" : "Finalizar"}
              </Button>
            ) : null}
          </div>
          {conversation ? (
            <>
              <div
                className="message-history"
                ref={historyRef}
                onScroll={(event) => {
                  const box = event.currentTarget;
                  stickToBottom.current = stickToLatestMessage(box.scrollHeight - box.scrollTop - box.clientHeight);
                }}
              >
                {messages.map((item) =>
                  item.internal ? (
                    <div className="internal-note" key={item.id}>
                      <span>Nota interna</span>
                      <p>{item.text}</p>
                      <time className="message-when" dateTime={item.createdAt}>{messageClock(item.createdAt)}</time>
                    </div>
                  ) : expectsMedia(item) ? (
                    <ChatMedia item={item} key={item.id} onSaved={() => setSavedMedia((value) => value + 1)} />
                  ) : (
                    <div className={`message-bubble ${item.direction === "in" ? "in" : "out"}`} key={item.id}>
                      {item.text}
                      <time className="message-when" dateTime={item.createdAt}>{messageClock(item.createdAt)}</time>
                    </div>
                  ),
                )}
              </div>
              {conversation.open || conversation.mine ? (
              <form
                className="composer"
                onSubmit={(event) => {
                  event.preventDefault();
                  void send();
                }}
              >
                <textarea
                  value={draft}
                  disabled={pending}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.nativeEvent.isComposing) return;
                    if (!composerSendsOnEnter({ key: event.key, code: event.code, shiftKey: event.shiftKey, pending, text: event.currentTarget.value })) return;
                    event.preventDefault();
                    void send(event.currentTarget.value);
                  }}
                  placeholder="Escreva a resposta para este contato..."
                  aria-label="Resposta"
                  rows={3}
                />
                <footer className="composer-actions">
                  <Button type="submit" disabled={pending || !draft.trim()}>
                    <Send />
                    Enviar
                  </Button>
                </footer>
              </form>
              ) : (
                <p className="composer-locked">Esta conversa está com {conversation.assigneeName || "outro atendente"}.</p>
              )}
            </>
          ) : (
            <div className="chat-empty">
              <h2>Conecte um WhatsApp para começar</h2>
              <p>O QR Code fica no menu Conexão.</p>
            </div>
          )}
        </section>
        <ContactRecord
          contactId={contact?.id ?? ""}
          tick={savedMedia}
          onRenamed={(contactId, name) =>
            setData((current) =>
              current
                ? { ...current, contacts: current.contacts.map((item) => (item.id === contactId ? { ...item, name } : item)) }
                : current,
            )
          }
        />
      </div>
    </main>
  );
}
