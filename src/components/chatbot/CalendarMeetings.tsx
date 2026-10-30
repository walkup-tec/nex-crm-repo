import { useEffect, useRef, useState, type FocusEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import { CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, CircleX, Clock3, Plus } from "lucide-react";
import { MeetingDialog } from "@/components/chatbot/MeetingDialog";
import { DashboardKpiCard } from "@/components/nex/DashboardKpiCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { callChatbotContactFn } from "@/lib/chatbot.functions";
import {
  cancelLeadMeetingFn,
  disconnectGoogleCalendarFn,
  googleCalendarConnectionFn,
  listAgendaBoardFn,
  listLeadMeetingsFn,
  startGoogleCalendarConnectFn,
} from "@/lib/google-calendar.functions";
import {
  agendaClock,
  agendaDisplayStatus,
  agendaWeekStart,
  meetingOnContactCard,
  meetingWhen,
  type AgendaBoardView,
  type AgendaDisplayStatus,
  type GoogleCalendarConnectionView,
  type LeadMeetingView,
  type MeetingWindow,
} from "@/lib/google-calendar";
import { cn } from "@/lib/utils";

const openConversationKey = "nex-kanban-conversation";

const statusTone: Record<AgendaDisplayStatus, string> = {
  confirmed: "border-emerald-500/40 bg-emerald-500/15 text-emerald-300",
  pending: "border-amber-500/40 bg-amber-500/15 text-amber-200",
  cancelled: "border-red-500/40 bg-red-500/15 text-red-300",
};

const eventTone: Record<AgendaDisplayStatus, string> = {
  confirmed: "border-emerald-500/30 bg-[#064e3b]",
  pending: "border-amber-500/35 bg-[#78350f]",
  cancelled: "border-red-500/35 bg-[#7f1d1d]",
};

const eventDot: Record<AgendaDisplayStatus, string> = {
  confirmed: "bg-emerald-500 shadow-[0_0_8px_#22c55e]",
  pending: "bg-amber-500 shadow-[0_0_8px_#f59e0b]",
  cancelled: "bg-red-500 shadow-[0_0_8px_#ef4444]",
};

function shiftWeek(weekStart: string, weeks: number) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(weekStart);
  if (!match) return weekStart;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + weeks * 7));
  return date.toISOString().slice(0, 10);
}

function AgendaWindow({
  slot,
  meeting,
  calling,
  onCall,
}: {
  slot: MeetingWindow;
  meeting: LeadMeetingView | null;
  calling: string;
  onCall: (leadId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const timer = useRef(0);
  const text = `${slot.label}${slot.note ? ` · ${slot.note}` : ""}`;
  function show() {
    window.clearTimeout(timer.current);
    setOpen(true);
  }
  function hide() {
    timer.current = window.setTimeout(() => setOpen(false), 160);
  }
  function hideFocus(event: FocusEvent<HTMLDivElement>) {
    const next = event.relatedTarget;
    if (next instanceof Node && event.currentTarget.contains(next)) return;
    setOpen(false);
  }
  useEffect(() => () => window.clearTimeout(timer.current), []);
  if (!meeting) {
    return (
      <span className={`agenda-window is-${slot.state}`} title={slot.note || (slot.state === "occupied" ? "Ocupado" : slot.state === "past" ? "Encerrado" : "Livre")}>
        {text}
      </span>
    );
  }
  const meet = /^https:\/\//.test(meeting.meetUrl) ? meeting.meetUrl : "";
  return (
    <div className={`agenda-window agenda-slot is-${slot.state}`} onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hideFocus}>
      {text}
      {open ? (
        <div className="agenda-hover" role="dialog" aria-label="Informações da agenda" onMouseEnter={show} onMouseLeave={hide}>
          <strong>{meeting.title || "Reunião"}</strong>
          <p>{meeting.leadName || "Lead"}</p>
          <p>{meetingWhen(meeting.startAt, meeting.endAt)}</p>
          {meeting.attendeeEmail ? <p>{meeting.attendeeEmail}</p> : null}
          {meeting.attendees.length ? <p>{meeting.attendees.join(", ")}</p> : null}
          {meet ? (
            <a href={meet} target="_blank" rel="noreferrer">
              {meet}
            </a>
          ) : (
            <p>O link do Meet ainda não está disponível.</p>
          )}
          <div className="agenda-hover-actions">
            {meet ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  void navigator.clipboard
                    .writeText(meet)
                    .then(() => {
                      setCopied(true);
                      window.setTimeout(() => setCopied(false), 1600);
                    })
                    .catch(() => setCopied(false));
                }}
              >
                {copied ? "Link copiado" : "Copiar link"}
              </Button>
            ) : null}
            <Button type="button" size="sm" disabled={!meeting.leadId || calling === meeting.leadId} onClick={() => onCall(meeting.leadId)}>
              {calling === meeting.leadId ? "Abrindo" : "Chamar"}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MeetingCards({ meetings, empty, onChanged }: { meetings: LeadMeetingView[]; empty: string; onChanged: () => void }) {
  const [editing, setEditing] = useState<LeadMeetingView | null>(null);
  const [cancelId, setCancelId] = useState("");
  const [pending, setPending] = useState("");
  const [note, setNote] = useState("");

  async function cancel(meetingId: string) {
    setPending(meetingId);
    setNote("");
    const result = await cancelLeadMeetingFn({ data: { meetingId } });
    setPending("");
    setCancelId("");
    if (!result.ok) {
      setNote(result.message);
      return;
    }
    onChanged();
  }

  if (!meetings.length) return <p className="meeting-empty">{empty}</p>;
  return (
    <>
      <div className="meeting-list">
        {meetings.map((meeting) => (
          <article className="meeting-card" key={meeting.id}>
            <strong>{meeting.title}</strong>
            <p>
              {meeting.leadName}
              {meeting.ownerName && !meeting.mine ? ` · ${meeting.ownerName}` : ""}
              {meeting.status === "cancelled" ? " · Cancelada" : ""}
            </p>
            <p>{meetingWhen(meeting.startAt, meeting.endAt)}</p>
            <div className="meeting-links">
              {meeting.meetUrl ? (
                <a href={meeting.meetUrl} target="_blank" rel="noreferrer">
                  Google Meet
                </a>
              ) : null}
              {meeting.calendarUrl ? (
                <a href={meeting.calendarUrl} target="_blank" rel="noreferrer">
                  Google Calendar
                </a>
              ) : null}
            </div>
            {meeting.canManage && meeting.status === "scheduled" ? (
              <div className="meeting-actions">
                <Button type="button" size="sm" variant="outline" disabled={pending === meeting.id} onClick={() => setEditing(meeting)}>
                  Reagendar
                </Button>
                {cancelId === meeting.id ? (
                  <Button type="button" size="sm" variant="destructive" disabled={pending === meeting.id} onClick={() => void cancel(meeting.id)}>
                    {pending === meeting.id ? "Cancelando" : "Confirmar cancelamento"}
                  </Button>
                ) : (
                  <Button type="button" size="sm" variant="outline" onClick={() => setCancelId(meeting.id)}>
                    Cancelar
                  </Button>
                )}
              </div>
            ) : null}
          </article>
        ))}
      </div>
      {note ? <p className="composer-error">{note}</p> : null}
      <MeetingDialog
        open={Boolean(editing)}
        leadId={editing?.leadId ?? ""}
        leadName={editing?.leadName ?? ""}
        meeting={editing}
        onOpenChange={(next) => {
          if (!next) setEditing(null);
        }}
        onSaved={() => {
          setEditing(null);
          onChanged();
        }}
      />
    </>
  );
}

export function LeadMeetings({ leadId, tick }: { leadId: string; tick: number }) {
  const [meetings, setMeetings] = useState<LeadMeetingView[]>([]);
  const [note, setNote] = useState("");
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!leadId) return;
    let active = true;
    void listLeadMeetingsFn({ data: { leadId } }).then((result) => {
      if (!active) return;
      if (!result.ok) {
        setNote(result.message);
        setMeetings([]);
        return;
      }
      setNote("");
      setMeetings(result.data);
    });
    return () => {
      active = false;
    };
  }, [leadId, tick, version]);

  if (!leadId) return null;
  const visible = meetings.filter((meeting) => meetingOnContactCard(meeting.status, meeting.startAt));
  if (!visible.length && !note) return null;
  return (
    <section className="contact-section">
      <h3>Reuniões</h3>
      {note ? <p className="composer-error">{note}</p> : null}
      <MeetingCards
        meetings={visible}
        empty="Nenhuma reunião agendada."
        onChanged={() => setVersion((value) => value + 1)}
      />
    </section>
  );
}

function GoogleMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H24v7.1h11.3C33.7 32.8 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.7 1.1 7.8 2.9l5.3-5.3C33.6 6.2 29.1 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 5.9 4.3C13.8 15.1 18.5 12 24 12c3 0 5.7 1.1 7.8 2.9l5.3-5.3C33.6 6.2 29.1 4 24 4 16.3 4 9.6 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.1C29.2 35.5 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-5.9 4.5C10.5 39.6 16.7 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H24v7.1h11.3c-1.1 3.1-3.5 5.5-6.1 6.7l.1.1 6.2 5.1C38.3 37.2 44 32 44 24c0-1.2-.1-2.3-.4-3.5z" />
    </svg>
  );
}

function MeetingBlock({ meeting, onOpen }: { meeting: LeadMeetingView; onOpen: (meeting: LeadMeetingView) => void }) {
  const tone = agendaDisplayStatus(meeting.status);
  const start = agendaClock(meeting.startAt);
  const end = agendaClock(meeting.endAt);
  return (
    <button
      type="button"
      className={cn(
        "grid w-full grid-cols-[8px_minmax(0,1fr)] items-start gap-x-2 rounded-[10px] border px-2.5 py-2.5 text-left transition hover:brightness-110",
        eventTone[tone],
      )}
      onClick={() => onOpen(meeting)}
    >
      <span className={cn("mt-1 size-2 rounded-full", eventDot[tone])} aria-hidden />
      <span className="min-w-0">
        <span className="block text-[11px] font-medium text-white/90">
          {start} - {end}
        </span>
        <span className="mt-0.5 block truncate text-[12.5px] font-semibold text-white">{meeting.leadName || meeting.title}</span>
      </span>
    </button>
  );
}

function StatusFilter({
  tone,
  label,
  checked,
  onToggle,
}: {
  tone: AgendaDisplayStatus;
  label: string;
  checked: boolean;
  onToggle: () => void;
}) {
  const color =
    tone === "confirmed" ? "text-emerald-400 border-emerald-400/50 bg-emerald-500/20" : tone === "pending" ? "text-amber-400 border-amber-400/50 bg-amber-500/20" : "text-red-400 border-red-400/50 bg-red-500/20";
  return (
    <button type="button" onClick={onToggle} className={cn("inline-flex items-center gap-1.5 text-[12.5px]", color.split(" ")[0])}>
      <span className={cn("grid size-3.5 place-items-center rounded border", color)}>
        {checked ? (
          <svg viewBox="0 0 24 24" className="size-2.5" fill="none" stroke="currentColor" strokeWidth="3">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        ) : null}
      </span>
      {label}
    </button>
  );
}

function dayMeetingGroups(meetings: LeadMeetingView[]) {
  const morning = meetings.filter((meeting) => agendaClock(meeting.startAt) < "13:00");
  const afternoon = meetings.filter((meeting) => agendaClock(meeting.startAt) >= "13:00");
  return { morning, afternoon, gap: morning.length > 0 && afternoon.length > 0 };
}

export function CalendarMeetings() {
  const navigate = useNavigate();
  const [connection, setConnection] = useState<GoogleCalendarConnectionView | null>(null);
  const [board, setBoard] = useState<AgendaBoardView | null>(null);
  const [weekStart, setWeekStart] = useState(() => agendaWeekStart());
  const [preset, setPreset] = useState("this");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [version, setVersion] = useState(0);
  const [calling, setCalling] = useState("");
  const [selected, setSelected] = useState<LeadMeetingView | null>(null);
  const [editing, setEditing] = useState<LeadMeetingView | null>(null);
  const [statusFilter, setStatusFilter] = useState<Record<AgendaDisplayStatus, boolean>>({
    confirmed: true,
    pending: true,
    cancelled: true,
  });

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data as { source?: string; ok?: boolean; message?: string };
      if (data.source !== "nex-google-calendar") return;
      setPending("");
      if (!data.ok) setNote(data.message || "A autorização do Google não foi concluída.");
      else setNote("");
      setVersion((value) => value + 1);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      const [linked, agenda] = await Promise.all([
        googleCalendarConnectionFn(),
        listAgendaBoardFn({ data: { weekStart } }),
      ]);
      if (!active) return;
      if (!linked.ok) setNote(linked.message);
      else setConnection(linked.data);
      if (!agenda.ok) setNote(agenda.message);
      else {
        setBoard(agenda.data);
        if (agenda.data.weekStart !== weekStart) setWeekStart(agenda.data.weekStart);
      }
      setLoaded(true);
    })();
    return () => {
      active = false;
    };
  }, [version, weekStart]);

  function connect() {
    setNote("");
    const width = 520;
    const height = 720;
    const left = window.screenX + Math.max(0, (window.outerWidth - width) / 2);
    const top = window.screenY + Math.max(0, (window.outerHeight - height) / 2);
    const popup = window.open("about:blank", "nex-google-calendar", `popup=yes,width=${width},height=${height},left=${left},top=${top}`);
    if (!popup) {
      setNote("O navegador bloqueou a janela do Google. Permita pop-ups neste site e tente de novo.");
      return;
    }
    setPending("connect");
    void (async () => {
      const result = await startGoogleCalendarConnectFn();
      if (!result.ok) {
        popup.close();
        setPending("");
        setNote(result.message);
        return;
      }
      popup.location.href = result.data.url;
    })();
  }

  async function call(leadId: string) {
    if (!leadId || calling) return;
    setCalling(leadId);
    setNote("");
    const result = await callChatbotContactFn({ data: { contactId: leadId } });
    setCalling("");
    if (!result.ok) {
      setNote(result.message);
      return;
    }
    sessionStorage.setItem(openConversationKey, result.data.conversationId);
    void navigate({ to: "/chatbot" });
  }

  async function disconnect() {
    setPending("disconnect");
    setNote("");
    const result = await disconnectGoogleCalendarFn();
    setPending("");
    if (!result.ok) {
      setNote(result.message);
      return;
    }
    setConnection(result.data);
    setVersion((value) => value + 1);
  }

  function goToday() {
    setPreset("this");
    setWeekStart(agendaWeekStart());
  }

  function applyPreset(value: string) {
    setPreset(value);
    const today = agendaWeekStart();
    if (value === "prev") setWeekStart(shiftWeek(today, -1));
    else if (value === "next") setWeekStart(shiftWeek(today, 1));
    else setWeekStart(today);
  }

  const stats = board?.stats;
  const confirmedShare = stats && stats.total ? Math.round((stats.confirmed / stats.total) * 100) : 0;
  const pendingShare = stats && stats.total ? Math.round((stats.pending / stats.total) * 100) : 0;
  const cancelledShare = stats && stats.total ? Math.round((stats.cancelled / stats.total) * 100) : 0;
  const delta = stats?.totalDeltaPercent;
  const connected = connection?.status === "connected";

  const selectedTone = selected ? agendaDisplayStatus(selected.status) : null;

  if (!loaded) return <p className="text-sm text-muted-foreground">Carregando agendamentos...</p>;
  if (!connection?.enabled) return <p className="text-sm text-muted-foreground">{note || "Nenhum agendamento."}</p>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <div className="inline-flex h-[38px] items-center gap-2 rounded-[10px] border border-slate-400/20 bg-[#0d1628] px-3 text-[13px]">
          <CalendarDays className="size-3.5 opacity-70" />
          {board?.rangeLabel ?? "—"}
        </div>
        <Select value={preset} onValueChange={applyPreset}>
          <SelectTrigger className="h-[38px] w-44 rounded-[10px] border-slate-400/20 bg-[#0d1628]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="this">Esta semana</SelectItem>
            <SelectItem value="prev">Semana anterior</SelectItem>
            <SelectItem value="next">Próxima semana</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="border-slate-400/15 bg-gradient-to-b from-[#101a2e] to-[#0d1527] shadow-[0_8px_24px_-12px_rgba(0,0,0,0.55)]">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-10 flex-none place-items-center rounded-[10px] bg-white">
              <GoogleMark />
            </span>
            <div className="min-w-0">
              <p className="truncate font-semibold text-white">{connected ? connection.email || "Google Calendar" : "Google Calendar"}</p>
              <p className="mt-0.5 text-[13px] text-slate-400">
                {connected ? "Conta conectada. As próximas reuniões aparecem abaixo." : "Conecte a conta para criar reuniões com Google Meet."}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {connected ? (
              <>
                <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/35 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
                  <span className="size-1.5 rounded-full bg-emerald-400" />
                  Conectado
                </span>
                <Button type="button" variant="outline" className="h-[34px] border-slate-400/30 bg-[#0d1628]" disabled={pending === "disconnect"} onClick={() => void disconnect()}>
                  {pending === "disconnect" ? "Desconectando" : "Desconectar"}
                </Button>
              </>
            ) : (
              <Button type="button" disabled={pending === "connect"} onClick={connect}>
                {pending === "connect" ? "Aguardando Google" : "Conectar Google Calendar"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {note ? <p className="text-sm text-destructive">{note}</p> : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <DashboardKpiCard
          label="Total de agendamentos"
          value={String(stats?.total ?? 0)}
          icon={CalendarDays}
          accentColor="#3b82f6"
          trend={
            delta == null
              ? undefined
              : {
                  direction: delta >= 0 ? "up" : "down",
                  text: `${delta}%`,
                  tone: delta >= 0 ? "positive" : "negative",
                }
          }
          comparison={delta == null ? undefined : "vs. semana anterior"}
        />
        <DashboardKpiCard label="Confirmados" value={String(stats?.confirmed ?? 0)} icon={CheckCircle2} accentColor="#22c55e" subValue={`${confirmedShare}% do total`} />
        <DashboardKpiCard label="Pendentes" value={String(stats?.pending ?? 0)} icon={Clock3} accentColor="#f59e0b" subValue={`${pendingShare}% do total`} />
        <DashboardKpiCard label="Cancelados" value={String(stats?.cancelled ?? 0)} icon={CircleX} accentColor="#ef4444" subValue={`${cancelledShare}% do total`} />
      </div>

      <Card className="border-slate-400/15 bg-[#101a2e]">
        <CardContent className="space-y-4 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" size="sm" className="h-[34px] border-slate-400/20 bg-[#0d1628]" onClick={goToday}>
                Hoje
              </Button>
              <Button type="button" variant="outline" size="icon" className="size-[34px] border-slate-400/20 bg-[#0d1628]" aria-label="Semana anterior" onClick={() => setWeekStart((value) => shiftWeek(value, -1))}>
                <ChevronLeft className="size-4" />
              </Button>
              <Button type="button" variant="outline" size="icon" className="size-[34px] border-slate-400/20 bg-[#0d1628]" aria-label="Próxima semana" onClick={() => setWeekStart((value) => shiftWeek(value, 1))}>
                <ChevronRight className="size-4" />
              </Button>
              <div className="ml-1 flex flex-wrap items-center gap-3.5">
                <StatusFilter tone="confirmed" label="Confirmado" checked={statusFilter.confirmed} onToggle={() => setStatusFilter((value) => ({ ...value, confirmed: !value.confirmed }))} />
                <StatusFilter tone="pending" label="Pendente" checked={statusFilter.pending} onToggle={() => setStatusFilter((value) => ({ ...value, pending: !value.pending }))} />
                <StatusFilter tone="cancelled" label="Cancelado" checked={statusFilter.cancelled} onToggle={() => setStatusFilter((value) => ({ ...value, cancelled: !value.cancelled }))} />
              </div>
            </div>
            <Button type="button" className="bg-violet-500 shadow-[0_8px_20px_-10px_rgba(139,92,246,0.8)] hover:bg-violet-500/90" onClick={() => void navigate({ to: "/chatbot" })}>
              <Plus className="size-4" />
              Novo agendamento
            </Button>
          </div>

          <div className="overflow-x-auto pb-1">
            <div className="grid min-w-[980px] grid-cols-5 gap-3 items-start">
              {(board?.days ?? []).map((day) => {
                const visible = day.meetings.filter((meeting) => statusFilter[agendaDisplayStatus(meeting.status)]);
                const groups = dayMeetingGroups(visible);
                return (
                  <section key={day.date} className="flex min-h-[560px] flex-col overflow-hidden rounded-xl border border-slate-400/15 bg-[#0c1424]">
                    <header className="relative border-b border-slate-400/10 px-2.5 pb-2.5 pt-3 text-center">
                      <p className="text-[13px] font-semibold capitalize text-white">{day.weekday}</p>
                      <p className="mt-0.5 text-xs font-medium text-slate-300">{day.dayMonth}</p>
                      <span className="absolute right-2.5 top-3 grid h-[22px] min-w-[22px] place-items-center rounded-md border border-blue-400/30 bg-blue-500/15 px-1.5 text-[11px] font-bold text-blue-300">
                        {visible.length}
                      </span>
                    </header>
                    <div className="flex flex-1 flex-col gap-2 p-2.5">
                      {groups.morning.map((meeting) => (
                        <MeetingBlock key={meeting.id} meeting={meeting} onOpen={setSelected} />
                      ))}
                      {groups.gap ? <div className="h-[18px]" aria-hidden /> : null}
                      {groups.afternoon.map((meeting) => (
                        <MeetingBlock key={meeting.id} meeting={meeting} onOpen={setSelected} />
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          </div>

          {!board?.meetings.length ? (
            <p className="text-sm text-muted-foreground">Nenhum agendamento nesta semana. Abra um lead na caixa de entrada para criar um novo.</p>
          ) : null}
        </CardContent>
      </Card>

      {selected ? (
        <Card>
          <CardContent className="space-y-3 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Detalhe do horário</p>
                <h3 className="mt-1 text-lg font-semibold">{selected.title || "Reunião"}</h3>
                <p className="text-sm text-muted-foreground">
                  {selected.leadName} · {meetingWhen(selected.startAt, selected.endAt)}
                </p>
              </div>
              {selectedTone ? (
                <span className={`rounded-full border px-3 py-1 text-xs font-medium ${statusTone[selectedTone]}`}>
                  {selectedTone === "confirmed" ? "Confirmado" : selectedTone === "pending" ? "Pendente" : "Cancelado"}
                </span>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              {selected.meetUrl ? (
                <Button asChild variant="outline" size="sm">
                  <a href={selected.meetUrl} target="_blank" rel="noreferrer">
                    Google Meet
                  </a>
                </Button>
              ) : null}
              {selected.calendarUrl ? (
                <Button asChild variant="outline" size="sm">
                  <a href={selected.calendarUrl} target="_blank" rel="noreferrer">
                    Google Calendar
                  </a>
                </Button>
              ) : null}
              {selected.canManage && selected.status === "scheduled" ? (
                <>
                  <Button type="button" size="sm" variant="outline" disabled={calling === selected.leadId} onClick={() => void call(selected.leadId)}>
                    {calling === selected.leadId ? "Abrindo..." : "Chamar no WhatsApp"}
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => setEditing(selected)}>
                    Reagendar
                  </Button>
                </>
              ) : null}
              <Button type="button" size="sm" variant="ghost" onClick={() => setSelected(null)}>
                Fechar
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <MeetingDialog
        open={Boolean(editing)}
        leadId={editing?.leadId ?? ""}
        leadName={editing?.leadName ?? ""}
        meeting={editing}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        onSaved={() => {
          setEditing(null);
          setSelected(null);
          setVersion((value) => value + 1);
        }}
      />
    </div>
  );
}
