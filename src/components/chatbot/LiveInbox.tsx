import { MessageSquare, Bot, ExternalLink, Filter, Pause, Pin, Play, Plus, Search, Send, UserRound } from "lucide-react";
import { useEffect, useRef, useState, type MouseEvent } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  chatbotMessageMediaFn,
  chatbotSnapshotFn,
  chatbotTransferTargetsFn,
  finishChatbotConversationFn,
  markChatbotConversationReadFn,
  saveChatbotContactMediaFn,
  sendChatbotArtesFn,
  sendChatbotAssinaturaFn,
  sendChatbotCadastroFn,
  sendChatbotMinutaFn,
  sendChatbotPropostaFn,
  sendChatbotMessageFn,
  startChatbotConversationFn,
  startChatbotFlowFn,
  listChatbotQuickRepliesFn,
  listChatbotFlowsFn,
  setChatbotContactBotsFn,
  scheduleChatbotReturnFn,
  setChatbotConversationPinFn,
  transferChatbotConversationFn,
} from "@/lib/chatbot.functions";
import { ContactRecord } from "@/components/chatbot/ContactRecord";
import { contractingButtonText, contractingFormUrl } from "@/lib/contracting";
import { acceptSnapshot, attendanceLabel, attendanceMark, audioDurationLabel, audioWaveBars, clientPhoneLabel, composerSendsOnEnter, defaultReturnSlot, headerAttendant, inboxContactLane, inboxFiltersActive, inboxList, inboxOrder, inboxPollNotice, messageClock, minutaFileName, pendingOutgoing, propostaFileName, propostaMessages, returnInstant, returnMonthCells, saoPauloToday, stickToLatestMessage, tagInk, waitingForHuman, type ChatbotQuickReply, type ChatbotSnapshot, type InboxLane, type InboxListFilters } from "@/lib/chatbot-evo";

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
        <span className="message-text">{item.text === "[áudio]" ? "Áudio indisponível" : item.text}</span>
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
      <img src={avatarUrl} alt="" referrerPolicy="no-referrer" onError={() => setHidden(true)} />
    </span>
  );
}

function ReturnCalendar({ value, onChange }: { value: string; onChange: (day: string) => void }) {
  const [month, setMonth] = useState(() => (value || saoPauloToday()).slice(0, 7));
  const today = saoPauloToday();
  const cells = returnMonthCells(month);
  const title = new Date(`${month}-01T12:00:00-03:00`).toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "America/Sao_Paulo" });
  function shift(delta: number) {
    const [year, mon] = month.split("-").map(Number);
    const next = new Date(Date.UTC(year ?? 2026, (mon ?? 1) - 1 + delta, 1));
    setMonth(`${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  return (
    <div className="return-calendar">
      <div className="return-calendar-bar">
        <button type="button" onClick={() => shift(-1)} aria-label="Mês anterior">‹</button>
        <strong>{title}</strong>
        <button type="button" onClick={() => shift(1)} aria-label="Próximo mês">›</button>
      </div>
      <div className="return-week">
        {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>
      <div className="return-days">
        {cells.map((day, index) =>
          day ? (
            <button key={day} type="button" disabled={day < today} aria-pressed={day === value} onClick={() => onChange(day)}>
              {Number(day.slice(-2))}
            </button>
          ) : (
            <span key={`vazio-${index}`} />
          ),
        )}
      </div>
    </div>
  );
}

export function LiveInbox({ expanded = false, conversationId = "" }: { expanded?: boolean; conversationId?: string }) {
  const [data, setData] = useState<ChatbotSnapshot | null>(null);
  const [selected, setSelected] = useState(conversationId);
  const [draft, setDraft] = useState("");
  const [message, setMessage] = useState("");
  const [signatureError, setSignatureError] = useState("");
  const [pending, setPending] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [blockingBots, setBlockingBots] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [botsOpen, setBotsOpen] = useState(false);
  const [quickReplies, setQuickReplies] = useState<ChatbotQuickReply[]>([]);
  const [quickNote, setQuickNote] = useState("");
  const [flows, setFlows] = useState<{ id: string; name: string }[]>([]);
  const [botsNote, setBotsNote] = useState("");
  const [transferOpen, setTransferOpen] = useState(false);
  const [targets, setTargets] = useState<{ id: string; name: string }[]>([]);
  const [targetId, setTargetId] = useState("");
  const [note, setNote] = useState("");
  const [transferring, setTransferring] = useState(false);
  const [outgoing, setOutgoing] = useState<OutgoingPreview[]>([]);
  const [savedMedia, setSavedMedia] = useState(0);
  const [lane, setLane] = useState<InboxLane>("atendimento");
  const [newOpen, setNewOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newConnectionId, setNewConnectionId] = useState("");
  const [newSaving, setNewSaving] = useState(false);
  const [newError, setNewError] = useState("");
  const [contactQuery, setContactQuery] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [listFilters, setListFilters] = useState<InboxListFilters>({ products: [], tags: [], stages: [] });
  const [returnOpen, setReturnOpen] = useState(false);
  const [returnDate, setReturnDate] = useState("");
  const [returnHour, setReturnHour] = useState(9);
  const [returnMinute, setReturnMinute] = useState(0);
  const [returnFlowId, setReturnFlowId] = useState("");
  const [returnFlows, setReturnFlows] = useState<{ id: string; name: string }[]>([]);
  const [returnNote, setReturnNote] = useState("");
  const [returnSaving, setReturnSaving] = useState(false);
  const selectedRef = useRef("");
  const pendingOpen = useRef("");
  const snapshotRequest = useRef(0);
  const appliedSnapshot = useRef(0);
  const inFlight = useRef(false);
  const loadAgain = useRef(false);
  const historyRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const stickToBottom = useRef(true);
  const sending = useRef(false);
  const lastSent = useRef("");
  const hasSnapshot = useRef(false);
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
          const notice = inboxPollNotice(error instanceof Error ? error.message : "", hasSnapshot.current);
          if (notice) setMessage(notice);
          continue;
        }
        if (!acceptSnapshot(requestId, appliedSnapshot.current)) continue;
        if (!result.ok) {
          appliedSnapshot.current = requestId;
          const notice = inboxPollNotice(result.message, hasSnapshot.current);
          if (notice) setMessage(notice);
          continue;
        }
        const openId = selectedRef.current;
        const conversations = result.data.conversations;
        appliedSnapshot.current = requestId;
        const next = { ...result.data, conversations };
        const opening = pendingOpen.current;
        if (opening) {
          const opened = next.conversations.find((item) => item.id === opening);
          const openedLane = opened ? inboxContactLane(next.conversations, opened.contactId) : "";
          if (openedLane) setLane(openedLane);
        }
        setOutgoing((current) => pendingOutgoing(next.messages, current));
        hasSnapshot.current = true;
        setData(next);
        setMessage((current) => (sending.current ? current : ""));
        setSelected((current) => {
          const wanted = current || pendingOpen.current;
          if (wanted && next.conversations.some((item) => item.id === wanted)) {
            pendingOpen.current = "";
            return wanted;
          }
          return next.conversations.some((item) => item.id === current) ? current : "";
        });
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
    pendingOpen.current = sessionStorage.getItem("nex-kanban-conversation") || conversationId;
    if (pendingOpen.current) {
      sessionStorage.removeItem("nex-kanban-conversation");
      setSelected(pendingOpen.current);
    }
    void load();
    const timer = window.setInterval(() => void load(), 2000);
    function openStored() {
      const id = sessionStorage.getItem("nex-kanban-conversation") ?? "";
      if (!id) return;
      pendingOpen.current = id;
      setSelected(id);
    }
    window.addEventListener("nex-open-conversation", openStored);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("nex-open-conversation", openStored);
    };
  }, []);

  useEffect(() => {
    stickToBottom.current = true;
    setTransferOpen(false);
    setQuickOpen(false);
    setBotsOpen(false);
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
  }, [messages.length, selected, signatureError]);

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

  function markFor(conversationId: string) {
    const current = data?.conversations.find((item) => item.id === conversationId);
    if (!current || !data) return "";
    const botSpoke = data.messages.some((item) => item.conversationId === conversationId && item.direction === "out");
    return attendanceMark({
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
    const nextPinned = !pinned;
    setData((current) =>
      current
        ? {
            ...current,
            conversations: inboxOrder(current.conversations.map((item) => (item.id === id ? { ...item, pinned: nextPinned } : item))),
          }
        : current,
    );
    const result = await setChatbotConversationPinFn({ data: { conversationId: id, pinned: nextPinned } });
    if (!result.ok) {
      setMessage(result.message);
      await load();
      return;
    }
    setMessage("");
    await load();
  }

  async function openTransfer(id: string) {
    setTransferOpen(true);
    setNote("");
    setTargets([]);
    setTargetId("");
    const result = await chatbotTransferTargetsFn({ data: { conversationId: id } });
    if (selectedRef.current !== id) return;
    if (!result.ok) {
      setTransferOpen(false);
      setMessage(result.message);
      return;
    }
    setTargets(result.data);
    setTargetId(result.data[0]?.id ?? "");
  }

  async function transfer(id: string) {
    const clean = note.trim();
    if (!targetId || transferring) return;
    if (clean.length > 500) {
      setMessage("A nota interna pode ter no máximo 500 caracteres.");
      return;
    }
    setTransferring(true);
    const result = await transferChatbotConversationFn({ data: { conversationId: id, attendantId: targetId, note: clean } });
    setTransferring(false);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    const attendant = targets.find((item) => item.id === targetId)?.name ?? "";
    setTransferOpen(false);
    setNote("");
    setTargets([]);
    setData((current) =>
      current
        ? {
            ...current,
            conversations: current.conversations.map((item) =>
              item.id === id ? { ...item, status: "active", assigneeName: attendant, mine: false, open: false, botPaused: true } : item,
            ),
          }
        : current,
    );
    setMessage("");
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

  async function toggleBots(contactId: string, disabled: boolean) {
    if (blockingBots) return;
    setBlockingBots(true);
    const result = await setChatbotContactBotsFn({ data: { contactId, disabled } });
    setBlockingBots(false);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    setData((current) =>
      current
        ? {
            ...current,
            contacts: current.contacts.map((item) => (item.id === contactId ? { ...item, botsDisabled: disabled } : item)),
            conversations: current.conversations.map((item) => {
              if (item.contactId !== contactId) return item;
              if (disabled || !item.assigneeName.trim()) return { ...item, botPaused: disabled };
              return item;
            }),
          }
        : current,
    );
    if (disabled) setBotsOpen(false);
    setMessage("");
    await load();
  }

  async function openQuickReplies() {
    setBotsOpen(false);
    const next = !quickOpen;
    setQuickOpen(next);
    if (!next) return;
    const result = await listChatbotQuickRepliesFn();
    if (!result.ok) {
      setQuickReplies([]);
      setQuickNote(result.message);
      return;
    }
    setQuickReplies(result.data);
    setQuickNote(result.data.length ? "" : "Nenhuma resposta rápida cadastrada.");
  }

  async function openReturn() {
    const slot = defaultReturnSlot();
    setReturnDate(slot.date);
    setReturnHour(slot.hour);
    setReturnMinute(slot.minute);
    setReturnFlowId("");
    setReturnNote("");
    setReturnOpen(true);
    const result = await listChatbotFlowsFn();
    if (!result.ok) {
      setReturnFlows([]);
      setReturnNote(result.message);
      return;
    }
    const saved = result.data
      .filter((item) => item.name.trim())
      .map((item) => ({ id: item.id, name: item.name }))
      .sort((left, right) => left.name.localeCompare(right.name, "pt-BR"));
    setReturnFlows(saved);
    if (!saved.length) setReturnNote("Nenhum bot salvo.");
  }

  async function saveReturn() {
    if (!selected || returnSaving) return;
    setReturnSaving(true);
    setReturnNote("");
    try {
      const result = await scheduleChatbotReturnFn({
        data: { conversationId: selected, flowId: returnFlowId, date: returnDate, hour: returnHour, minute: returnMinute },
      });
      if (!result.ok) {
        setReturnNote(result.message);
        return;
      }
      setReturnOpen(false);
      setMessage("Retorno agendado. O bot será enviado nesse horário.");
    } catch {
      setReturnNote("Não foi possível agendar o retorno.");
    } finally {
      setReturnSaving(false);
    }
  }

  async function openBots() {
    if (contact?.botsDisabled) return;
    setQuickOpen(false);
    const next = !botsOpen;
    setBotsOpen(next);
    if (!next) return;
    const result = await listChatbotFlowsFn();
    if (!result.ok) {
      setFlows([]);
      setBotsNote(result.message);
      return;
    }
    const saved = result.data
      .filter((item) => item.name.trim())
      .map((item) => ({ id: item.id, name: item.name }))
      .sort((left, right) => left.name.localeCompare(right.name, "pt-BR"));
    setFlows(saved);
    setBotsNote(saved.length ? "" : "Nenhum bot salvo.");
  }

  async function startBot(flowId: string) {
    if (!selected || sending.current || contact?.botsDisabled) return;
    sending.current = true;
    setBotsOpen(false);
    setPending(true);
    try {
      const result = await startChatbotFlowFn({ data: { conversationId: selected, flowId } });
      setMessage(result.ok ? "Bot enviado nesta conversa." : result.message);
      if (result.ok) await load();
    } catch {
      setMessage("Não foi possível enviar o bot nesta conversa.");
    } finally {
      sending.current = false;
      setPending(false);
    }
  }

  async function sendArtes() {
    if (!selected || !contact || !data?.contractingForm || sending.current) return;
    setQuickOpen(false);
    setBotsOpen(false);
    const preview: OutgoingPreview = {
      id: `local-${Date.now()}`,
      conversationId: selected,
      text: "Artes",
      createdAt: new Date().toISOString(),
    };
    sending.current = true;
    setOutgoing((current) => [...current, preview]);
    setPending(true);
    try {
      const result = await sendChatbotArtesFn({ data: { conversationId: selected } });
      if (!result.ok) {
        setOutgoing((current) => current.filter((item) => item.id !== preview.id));
        setMessage(result.message);
        return;
      }
      setMessage("");
      void load();
    } catch {
      setOutgoing((current) => current.filter((item) => item.id !== preview.id));
      setMessage("Não foi possível enviar as artes.");
    } finally {
      sending.current = false;
      setPending(false);
      composerRef.current?.focus();
    }
  }

  async function sendAssinatura() {
    if (!selected || !contact) {
      setSignatureError("Abra a conversa do contato antes de enviar o contrato para assinatura.");
      return;
    }
    if (!data?.contractingForm) {
      setSignatureError("A assinatura do contrato não está disponível nesta conta.");
      return;
    }
    if (sending.current) {
      setSignatureError("Aguarde o envio que já está em andamento.");
      return;
    }
    setQuickOpen(false);
    setBotsOpen(false);
    const preview: OutgoingPreview = {
      id: `local-${Date.now()}`,
      conversationId: selected,
      text: "Enviando o contrato para assinatura…",
      createdAt: new Date().toISOString(),
    };
    sending.current = true;
    setOutgoing((current) => [...current, preview]);
    setPending(true);
    setSignatureError("");
    try {
      const result = await sendChatbotAssinaturaFn({ data: { conversationId: selected } });
      if (!result.ok) {
        setOutgoing((current) => current.filter((item) => item.id !== preview.id));
        setSignatureError(result.message || "Não foi possível enviar o contrato para assinatura.");
        void load();
        return;
      }
      setSignatureError("");
      setMessage("");
      void load();
    } catch {
      setOutgoing((current) => current.filter((item) => item.id !== preview.id));
      setSignatureError("Não foi possível enviar o contrato para assinatura.");
    } finally {
      sending.current = false;
      setPending(false);
      composerRef.current?.focus();
    }
  }

  async function sendProposta() {
    if (!selected || !contact || !data?.contractingForm || sending.current) return;
    setQuickOpen(false);
    setBotsOpen(false);
    const started = Date.now();
    const previews: OutgoingPreview[] = [propostaFileName, ...propostaMessages].map((text, index) => ({
      id: `local-${started}-${index}`,
      conversationId: selected,
      text,
      createdAt: new Date(started + index).toISOString(),
    }));
    sending.current = true;
    setOutgoing((current) => [...current, ...previews]);
    setPending(true);
    try {
      const result = await sendChatbotPropostaFn({ data: { conversationId: selected } });
      if (!result.ok) {
        setOutgoing((current) => current.filter((item) => !previews.some((preview) => preview.id === item.id)));
        setMessage(result.message);
        return;
      }
      setMessage("");
      setSavedMedia((value) => value + 1);
      void load();
    } catch {
      setOutgoing((current) => current.filter((item) => !previews.some((preview) => preview.id === item.id)));
      setMessage("Não foi possível enviar a proposta.");
    } finally {
      sending.current = false;
      setPending(false);
      composerRef.current?.focus();
    }
  }

  async function sendMinuta() {
    if (!selected || !contact || !data?.contractingForm || sending.current) return;
    setQuickOpen(false);
    setBotsOpen(false);
    const preview: OutgoingPreview = {
      id: `local-${Date.now()}`,
      conversationId: selected,
      text: minutaFileName,
      createdAt: new Date().toISOString(),
    };
    sending.current = true;
    setOutgoing((current) => [...current, preview]);
    setPending(true);
    try {
      const result = await sendChatbotMinutaFn({ data: { conversationId: selected } });
      if (!result.ok) {
        setOutgoing((current) => current.filter((item) => item.id !== preview.id));
        setMessage(result.message);
        return;
      }
      setMessage("");
      setSavedMedia((value) => value + 1);
      void load();
    } catch {
      setOutgoing((current) => current.filter((item) => item.id !== preview.id));
      setMessage("Não foi possível enviar a minuta.");
    } finally {
      sending.current = false;
      setPending(false);
      composerRef.current?.focus();
    }
  }

  async function sendForm() {
    if (!selected || !contact || !data?.contractingForm || sending.current) return;
    setQuickOpen(false);
    setBotsOpen(false);
    const url = contractingFormUrl("https://app.nexmeta.com.br", contact.id);
    const text = contractingButtonText(url);
    const preview: OutgoingPreview = {
      id: `local-${Date.now()}`,
      conversationId: selected,
      text,
      createdAt: new Date().toISOString(),
    };
    sending.current = true;
    setOutgoing((current) => [...current, preview]);
    setPending(true);
    try {
      const result = await sendChatbotCadastroFn({ data: { conversationId: selected } });
      if (!result.ok) {
        setOutgoing((current) => current.filter((item) => item.id !== preview.id));
        setMessage(result.message);
        return;
      }
      setMessage("");
      void load();
    } catch {
      setOutgoing((current) => current.filter((item) => item.id !== preview.id));
      setMessage("Não foi possível enviar a mensagem.");
    } finally {
      sending.current = false;
      setPending(false);
      composerRef.current?.focus();
    }
  }

  async function send(text = draft) {
    const clean = text.trim();
    if (!selected || !clean) return false;
    if (sending.current && lastSent.current === clean) return false;
    const preview: OutgoingPreview = {
      id: `local-${Date.now()}`,
      conversationId: selected,
      text: clean,
      createdAt: new Date().toISOString(),
    };
    lastSent.current = clean;
    setOutgoing((current) => [...current, preview]);
    setDraft("");
    sending.current = true;
    composerRef.current?.focus();
    try {
      const result = await sendChatbotMessageFn({ data: { conversationId: selected, text: clean } });
      if (lastSent.current === clean) lastSent.current = "";
      if (!result.ok) {
        setOutgoing((current) => current.filter((item) => item.id !== preview.id));
        setDraft(clean);
        setMessage(result.message);
        return false;
      }
      setMessage("");
      void load();
      return true;
    } catch {
      if (lastSent.current === clean) lastSent.current = "";
      setOutgoing((current) => current.filter((item) => item.id !== preview.id));
      setDraft(clean);
      setMessage("Não foi possível enviar a mensagem.");
      return false;
    } finally {
      sending.current = false;
      composerRef.current?.focus();
    }
  }

  const conversations = data?.conversations ?? [];
  const visibleConversations = data ? inboxList(conversations, data.contacts, lane, contactQuery, listFilters) : [];
  const pinnedConversations = visibleConversations.filter((item) => item.pinned);
  const listedConversations = visibleConversations.filter((item) => !item.pinned);
  const filtersOn = inboxFiltersActive(listFilters);
  const laneCount = (key: InboxLane) => (data ? inboxList(conversations, data.contacts, key, contactQuery, listFilters).length : 0);

  function toggleListFilter(kind: keyof InboxListFilters, name: string) {
    setListFilters((current) => {
      const values = current[kind];
      const next = values.includes(name) ? values.filter((item) => item !== name) : [...values, name];
      return { ...current, [kind]: next };
    });
  }

  function conversationCard(item: ChatbotSnapshot["conversations"][number]) {
    if (!data) return null;
    const person = data.contacts.find((contact) => contact.id === item.contactId);
    const channel = data.connections.find((connection) => connection.id === item.connectionId)?.name ?? "";
    const unread = item.unreadCount > 99 ? "99+" : String(item.unreadCount);
    const mark = markFor(item.id);
    const pending = waitingForHuman({ assigneeName: item.assigneeName, botPaused: item.botPaused, closed: item.status === "closed" });
    return (
      <div
        key={item.id}
        role="button"
        tabIndex={0}
        className={`conversation-row${item.pinned ? " pinned" : ""}${item.id === selected ? " selected" : ""}${item.unreadCount ? " unread" : ""}${pending ? " waiting-human" : ""}`}
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
          <strong className="conversation-name"><span>{person?.name}</span>{mark==="bot"?<Bot className="is-bot" size={14} aria-label="Atendido pelo bot"/>:mark==="human"?<UserRound className="is-human" size={14} aria-label="Atendimento humano"/>:null}</strong>
          <p>{clientPhoneLabel(person?.phone ?? "") || person?.phone}</p>
          <div className="conversation-tags">
            {channel ? <span className="status-pill">{channel}</span> : null}
            <span className={`status-pill${pending ? " waiting" : ""}`}>{labelFor(item.id)}</span>
            {(person?.tags ?? []).map((tag) => (
              <span key={tag.name} className="tag-chip conversation-tag" style={{ background: tag.color, color: tagInk(tag.color), borderColor: tag.color }}>
                {tag.name}
              </span>
            ))}
            {person?.stage ? <span className="status-pill stage">{person.stage}</span> : null}
          </div>
        </div>
        <div className="conversation-side">
          {item.unreadCount > 0 ? <span className="unread-count">{unread}</span> : null}
          <button
            type="button"
            className={`pin-toggle${item.pinned ? " pinned" : ""}`}
            aria-label={item.pinned ? "Desafixar conversa" : "Fixar conversa"}
            aria-pressed={item.pinned}
            onClick={(event) => {
              event.stopPropagation();
              void togglePin(item.id, item.pinned);
            }}
          >
            <Pin size={14} fill={item.pinned ? "currentColor" : "none"} />
          </button>
        </div>
      </div>
    );
  }

  function openNewConversation() {
    const connected = (data?.connections ?? []).filter((item) => item.status === "connected");
    setNewName("");
    setNewPhone("");
    setNewConnectionId((current) => (connected.some((item) => item.id === current) ? current : connected[0]?.id ?? ""));
    setNewError("");
    setNewOpen(true);
  }

  async function startNewConversation() {
    if (newSaving) return;
    setNewSaving(true);
    setNewError("");
    const result = await startChatbotConversationFn({ data: { name: newName, phone: newPhone, connectionId: newConnectionId } });
    setNewSaving(false);
    if (!result.ok) {
      setNewError(result.message);
      return;
    }
    pendingOpen.current = result.data.conversationId;
    setSelected(result.data.conversationId);
    setLane("atendimento");
    setNewOpen(false);
    setNewName("");
    setNewPhone("");
    await load();
  }

  const connectedChannels = (data?.connections ?? []).filter((item) => item.status === "connected");

  return (
    <main className="page">
      {message ? <p className="info-note mb-5">{message}</p> : null}
      <div className={`inbox-layout${selected ? " chat-selected" : ""}`}>
        <section className="conversation-list">
          <div className="list-tools">
            <div className="list-head">
              <div className="list-title">
                <button type="button" className="list-add" aria-label="Nova conversa" onClick={openNewConversation}>
                  <Plus size={16} />
                </button>
                <h2>
                  Conversas <span className="count">{visibleConversations.length}</span>
                </h2>
              </div>
              <button
                type="button"
                className={`list-filter${filtersOn ? " active" : ""}`}
                aria-label="Filtrar conversas"
                aria-expanded={filtersOpen}
                onClick={() => setFiltersOpen((open) => !open)}
              >
                <Filter size={15} />
              </button>
            </div>
            <label className="search-field list-search">
              <Search size={14} />
              <input
                value={contactQuery}
                onChange={(event) => setContactQuery(event.target.value)}
                placeholder="Nome ou WhatsApp"
                aria-label="Pesquisar contato por nome ou WhatsApp"
              />
            </label>
            <div className="list-lanes" role="tablist" aria-label="Situação do atendimento">
              {([
                ["atendimento", "Atendimento"],
                ["aguardando", "Aguardando"],
                ["robo", "Robô"],
              ] as const).map(([key, label]) => (
                <button key={key} type="button" role="tab" aria-selected={lane === key} className={key === "aguardando" && laneCount(key) > 0 ? "has-waiting" : undefined} onClick={() => setLane(key)}>
                  {label}
                  <span>{laneCount(key)}</span>
                </button>
              ))}
            </div>
            {filtersOpen ? (
              <div className="list-filter-panel">
                {(
                  [
                    ["products", "Produto", data?.catalogs.products.map((name) => ({ name })) ?? []],
                    ["tags", "Etiqueta", data?.catalogs.tags ?? []],
                    ["stages", "Kanban", data?.catalogs.stages.map((name) => ({ name })) ?? []],
                  ] as const
                ).map(([kind, title, options]) => (
                  <div key={kind}>
                    <strong>{title}</strong>
                    {options.length ? (
                      options.map((option) => (
                        <label key={option.name}>
                          <input
                            type="checkbox"
                            checked={listFilters[kind].includes(option.name)}
                            onChange={() => toggleListFilter(kind, option.name)}
                          />
                          {option.name}
                        </label>
                      ))
                    ) : (
                      <p>Nenhum cadastrado</p>
                    )}
                  </div>
                ))}
                {filtersOn ? (
                  <button type="button" onClick={() => setListFilters({ products: [], tags: [], stages: [] })}>
                    Limpar
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
          {conversations.length ? (
            visibleConversations.length ? (
            <>
              {pinnedConversations.length ? <div className="conversation-pinned">{pinnedConversations.map((item) => conversationCard(item))}</div> : null}
              <div className="conversation-scroll">{listedConversations.map((item) => conversationCard(item))}</div>
            </>
            ) : (
              <div className="list-empty">
                <MessageSquare size={27} />
                <strong>{contactQuery.trim() || filtersOn ? "Nenhum contato encontrado" : "Nenhuma conversa nesta aba"}</strong>
                <p>{contactQuery.trim() || filtersOn ? "A pesquisa e os filtros valem para a aba selecionada." : "Os contatos desta situação aparecem aqui."}</p>
              </div>
            )
          ) : (
            <div className="list-empty">
              <MessageSquare size={27} />
              <strong>Nenhuma conversa por aqui</strong>
              <p>As mensagens aparecem quando um WhatsApp conectado receber um contato.</p>
            </div>
          )}
        </section>
        <section className="chat-area">
          {expanded ? null : (
            <a
              className="chat-expand"
              href={selected ? `/chatbot/atendimento#${selected}` : "/chatbot/atendimento"}
              target="_blank"
              rel="noreferrer"
            >
              Expandir
              <ExternalLink aria-hidden="true" />
            </a>
          )}
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
              <div className="chat-actions">
                <button
                  type="button"
                  className={`bot-block${contact?.botsDisabled ? " blocked" : ""}`}
                  aria-pressed={contact?.botsDisabled === true}
                  aria-label={contact?.botsDisabled ? "Reativar bots deste contato" : "Desativar bots deste contato"}
                  title={contact?.botsDisabled ? "Bots desativados para este contato" : "Bots ativos para este contato"}
                  disabled={blockingBots || !contact}
                  onClick={() => contact && void toggleBots(contact.id, !contact.botsDisabled)}
                >
                  <Bot size={16} />
                </button>
                <Button type="button" size="sm" variant="outline" onClick={() => void openReturn()}>
                  Retorno
                </Button>
                {conversation.mine ? (
                  <Button type="button" size="sm" variant="outline" onClick={() => void openTransfer(conversation.id)}>
                    Transferir
                  </Button>
                ) : null}
                <Button type="button" size="sm" disabled={finishing || !conversation.assigneeName.trim()} onClick={() => void finish(conversation.id)}>
                  {finishing ? "Finalizando" : "Finalizar"}
                </Button>
              </div>
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
                      <span className="message-text">{item.text}</span>
                      <time className="message-when" dateTime={item.createdAt}>{messageClock(item.createdAt)}</time>
                    </div>
                  ),
                )}
                {signatureError ? (
                  <div className="internal-note signature-failure">
                    <span>Assinatura</span>
                    <p>{signatureError}</p>
                  </div>
                ) : null}
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
                  ref={composerRef}
                  value={draft}
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
                <p className="composer-hint">Shift + Enter para nova linha</p>
                {quickOpen ? (
                  <div className="composer-menu" role="listbox" aria-label="Respostas rápidas">
                    {quickNote ? <p>{quickNote}</p> : null}
                    {quickReplies.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        role="option"
                        disabled={pending}
                        onClick={() => {
                          setQuickOpen(false);
                          void send(item.text);
                        }}
                      >
                        {item.title}
                      </button>
                    ))}
                  </div>
                ) : null}
                {botsOpen && contact?.botsDisabled !== true ? (
                  <div className="composer-menu" role="listbox" aria-label="Bots">
                    {botsNote ? <p>{botsNote}</p> : null}
                    {flows.map((item) => (
                      <button key={item.id} type="button" role="option" disabled={pending} onClick={() => void startBot(item.id)}>
                        {item.name}
                      </button>
                    ))}
                  </div>
                ) : null}
                {signatureError ? <p className="composer-error">{signatureError}</p> : null}
                <footer className="composer-actions">
                  <div className="composer-tools">
                    <Button type="button" variant="outline" size="sm" disabled={pending} aria-expanded={quickOpen} onClick={() => void openQuickReplies()}>
                      Respostas rápidas
                    </Button>
                    <Button type="button" variant="outline" size="sm" disabled={pending || contact?.botsDisabled === true} title={contact?.botsDisabled ? "Bots desativados para este contato" : "Enviar um bot salvo"} aria-expanded={botsOpen} onClick={() => void openBots()}>
                      Bots
                    </Button>
                    {data?.contractingForm ? (
                      <Button type="button" variant="outline" size="sm" disabled={pending || !contact} onClick={() => void sendArtes()}>
                        Artes
                      </Button>
                    ) : null}
                    {data?.contractingForm ? (
                      <Button type="button" variant="outline" size="sm" disabled={pending || !contact} onClick={() => void sendProposta()}>
                        Proposta
                      </Button>
                    ) : null}
                    {data?.contractingForm ? (
                      <Button type="button" variant="outline" size="sm" disabled={pending || !contact} onClick={() => void sendMinuta()}>
                        Minuta
                      </Button>
                    ) : null}
                    {data?.contractingForm ? (
                      <Button type="button" variant="outline" size="sm" disabled={pending || !contact} onClick={() => void sendForm()}>
                        Form
                      </Button>
                    ) : null}
                    {data?.contractingForm ? (
                      <Button type="button" variant="outline" size="sm" disabled={pending || !contact} onClick={() => void sendAssinatura()}>
                        Assinatura Ctt
                      </Button>
                    ) : null}
                  </div>
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
        <Dialog open={returnOpen} onOpenChange={setReturnOpen}>
          <DialogContent className="chatbot-app return-dialog sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Retorno</DialogTitle>
            </DialogHeader>
            <form
              className="return-form"
              onSubmit={(event) => {
                event.preventDefault();
                void saveReturn();
              }}
            >
              <ReturnCalendar value={returnDate} onChange={setReturnDate} />
              <div className="return-clock">
                <label>
                  Hora
                  <select aria-label="Hora" value={returnHour} onChange={(event) => setReturnHour(Number(event.target.value))}>
                    {Array.from({ length: 24 }, (_, hour) => (
                      <option key={hour} value={hour}>
                        {String(hour).padStart(2, "0")}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Minuto
                  <select aria-label="Minuto" value={returnMinute} onChange={(event) => setReturnMinute(Number(event.target.value))}>
                    {Array.from({ length: 60 }, (_, minute) => (
                      <option key={minute} value={minute}>
                        {String(minute).padStart(2, "0")}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <p className="return-when">
                {returnInstant({ date: returnDate, hour: returnHour, minute: returnMinute })
                  ? new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "long", day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit" }).format(new Date(returnInstant({ date: returnDate, hour: returnHour, minute: returnMinute })))
                  : "Escolha uma data e um horário que ainda não passaram."}
              </p>
              <label>
                Bot
                <select aria-label="Bot" value={returnFlowId} disabled={!returnFlows.length || returnSaving} onChange={(event) => setReturnFlowId(event.target.value)}>
                  <option value="">{returnFlows.length ? "Escolha o bot" : "Nenhum bot salvo"}</option>
                  {returnFlows.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              {returnNote ? <p className="composer-error">{returnNote}</p> : null}
              <div className="modal-actions">
                <Button type="button" variant="outline" onClick={() => setReturnOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={returnSaving || !returnFlowId || !returnInstant({ date: returnDate, hour: returnHour, minute: returnMinute })}>
                  {returnSaving ? "Agendando" : "Agendar retorno"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
        <Dialog open={newOpen} onOpenChange={setNewOpen}>
          <DialogContent className="chatbot-app sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Nova conversa</DialogTitle>
            </DialogHeader>
            <form
              className="transfer-form"
              onSubmit={(event) => {
                event.preventDefault();
                void startNewConversation();
              }}
            >
              <label>
                Nome
                <input value={newName} maxLength={80} disabled={newSaving} placeholder="Nome do contato" aria-label="Nome do contato" onChange={(event) => setNewName(event.target.value)} />
              </label>
              <label>
                WhatsApp
                <input value={newPhone} inputMode="tel" disabled={newSaving} placeholder="(51) 99999-9999" aria-label="WhatsApp do contato" onChange={(event) => setNewPhone(event.target.value)} />
              </label>
              {connectedChannels.length > 1 ? (
                <label>
                  Canal
                  <select className="transfer-agent" aria-label="Canal de WhatsApp" value={newConnectionId} disabled={newSaving} onChange={(event) => setNewConnectionId(event.target.value)}>
                    {connectedChannels.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name || "Canal"} {clientPhoneLabel(item.phone)}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              {connectedChannels.length ? null : <p className="info-note">Conecte um canal de WhatsApp antes de iniciar a conversa.</p>}
              {newError ? <p className="info-note">{newError}</p> : null}
              <div className="modal-actions">
                <Button type="button" variant="outline" onClick={() => setNewOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={newSaving || !connectedChannels.length || !newName.trim() || !newPhone.trim()}>
                  {newSaving ? "Iniciando" : "Iniciar conversa"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
        <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
          <DialogContent className="chatbot-app sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Transferir atendimento</DialogTitle>
            </DialogHeader>
            <form
              className="transfer-form"
              onSubmit={(event) => {
                event.preventDefault();
                if (conversation) void transfer(conversation.id);
              }}
            >
              <label>
                Atendente
                <select className="transfer-agent" aria-label="Atendente" value={targetId} disabled={!targets.length || transferring} onChange={(event) => setTargetId(event.target.value)}>
                  {targets.length ? null : <option value="">Nenhum atendente neste canal</option>}
                  {targets.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Nota interna
                <textarea
                  value={note}
                  maxLength={500}
                  rows={4}
                  disabled={transferring}
                  placeholder="Visível só para os atendentes"
                  aria-label="Nota interna"
                  onChange={(event) => setNote(event.target.value)}
                />
                <span className="note-count">{note.trim().length}/500</span>
              </label>
              <div className="modal-actions">
                <Button type="button" variant="outline" onClick={() => setTransferOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={transferring || !targetId}>
                  {transferring ? "Transferindo" : "Transferir"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
        <ContactRecord
          contactId={contact?.id ?? ""}
          tick={savedMedia}
          preview={contact ? { name: contact.name, phone: contact.phone, avatarUrl: contact.avatarUrl } : null}
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
