import { useEffect, useRef, useState, type FocusEvent, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowDownRight, ArrowUpRight, CalendarDays, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { MeetingDialog } from "@/components/chatbot/MeetingDialog";
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
  meetingsInHour,
  meetingWhen,
  type AgendaBoardView,
  type AgendaDisplayStatus,
  type GoogleCalendarConnectionView,
  type LeadMeetingView,
  type MeetingWindow,
} from "@/lib/google-calendar";

const openConversationKey = "nex-kanban-conversation";

const statusTone: Record<AgendaDisplayStatus, string> = {
  confirmed: "border-emerald-500/40 bg-emerald-500/15 text-emerald-300",
  pending: "border-amber-500/40 bg-amber-500/15 text-amber-200",
  cancelled: "border-red-500/40 bg-red-500/15 text-red-300",
};

const statusDot: Record<AgendaDisplayStatus, string> = {
  confirmed: "bg-emerald-400",
  pending: "bg-amber-400",
  cancelled: "bg-red-400",
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
  return (
    <>
      {note ? <p className="composer-error">{note}</p> : null}
      <MeetingCards
        meetings={meetings.filter((meeting) => meetingOnContactCard(meeting.status))}
        empty="Nenhuma reunião agendada."
        onChanged={() => setVersion((value) => value + 1)}
      />
    </>
  );
}

function MeetingBlock({
  meeting,
  calling,
  onOpen,
  onCall,
}: {
  meeting: LeadMeetingView;
  calling: string;
  onOpen: (meeting: LeadMeetingView) => void;
  onCall: (leadId: string) => void;
}) {
  const tone = agendaDisplayStatus(meeting.status);
  const start = agendaClock(meeting.startAt);
  const end = agendaClock(meeting.endAt);
  return (
    <button
      type="button"
      className={`w-full rounded-md border px-2 py-1.5 text-left text-[11px] leading-tight transition hover:brightness-110 ${statusTone[tone]}`}
      onClick={() => onOpen(meeting)}
    >
      <p className="font-semibold">
        {start} - {end}
      </p>
      <p className="mt-0.5 truncate">{meeting.leadName || meeting.title}</p>
      {meeting.canManage && meeting.status === "scheduled" ? (
        <span
          className="mt-1 inline-flex text-[10px] underline"
          onClick={(event) => {
            event.stopPropagation();
            onCall(meeting.leadId);
          }}
        >
          {calling === meeting.leadId ? "Abrindo..." : "Chamar"}
        </span>
      ) : null}
    </button>
  );
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
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="icon" aria-label="Semana anterior" onClick={() => setWeekStart((value) => shiftWeek(value, -1))}>
            <ChevronLeft className="size-4" />
          </Button>
          <div className="rounded-md border px-3 py-2 text-sm font-medium">{board?.rangeLabel ?? "—"}</div>
          <Button type="button" variant="outline" size="icon" aria-label="Próxima semana" onClick={() => setWeekStart((value) => shiftWeek(value, 1))}>
            <ChevronRight className="size-4" />
          </Button>
          <Select value={preset} onValueChange={applyPreset}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="this">Esta semana</SelectItem>
              <SelectItem value="prev">Semana anterior</SelectItem>
              <SelectItem value="next">Próxima semana</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="grid size-10 place-items-center rounded-lg bg-secondary">
              <CalendarDays className="size-5 text-primary" />
            </span>
            <div>
              <p className="font-semibold">{connected ? connection.email || "Google Calendar" : "Google Calendar"}</p>
              <p className="text-sm text-muted-foreground">
                {connected ? "Conta conectada. As próximas reuniões aparecem abaixo." : "Conecte a conta para criar reuniões com Google Meet."}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {connected ? (
              <>
                <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
                  <span className="size-2 rounded-full bg-emerald-400" />
                  Conectado
                </span>
                <Button type="button" variant="outline" disabled={pending === "disconnect"} onClick={() => void disconnect()}>
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
        <StatCard
          label="Total de agendamentos"
          value={String(stats?.total ?? 0)}
          detail={
            delta == null ? null : (
              <span className={`inline-flex items-center gap-1 ${delta >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {delta >= 0 ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
                {delta > 0 ? "+" : ""}
                {delta}% vs. semana anterior
              </span>
            )
          }
        />
        <StatCard label="Confirmados" value={String(stats?.confirmed ?? 0)} detail={`${confirmedShare}% do total`} tone="text-emerald-400" />
        <StatCard label="Pendentes" value={String(stats?.pending ?? 0)} detail={`${pendingShare}% do total`} tone="text-amber-400" />
        <StatCard label="Cancelados" value={String(stats?.cancelled ?? 0)} detail={`${cancelledShare}% do total`} tone="text-red-400" />
      </div>

      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={goToday}>
                Hoje
              </Button>
              <Button type="button" variant="outline" size="icon" aria-label="Semana anterior" onClick={() => setWeekStart((value) => shiftWeek(value, -1))}>
                <ChevronLeft className="size-4" />
              </Button>
              <Button type="button" variant="outline" size="icon" aria-label="Próxima semana" onClick={() => setWeekStart((value) => shiftWeek(value, 1))}>
                <ChevronRight className="size-4" />
              </Button>
              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <span className={`size-2 rounded-full ${statusDot.confirmed}`} /> Confirmado
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className={`size-2 rounded-full ${statusDot.pending}`} /> Pendente
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className={`size-2 rounded-full ${statusDot.cancelled}`} /> Cancelado
                </span>
              </div>
            </div>
            <Button type="button" onClick={() => void navigate({ to: "/chatbot" })}>
              <Plus className="size-4" />
              Novo agendamento
            </Button>
          </div>

          <div className="overflow-x-auto">
            <div className="min-w-[860px]">
              <div className="grid grid-cols-[64px_repeat(5,minmax(0,1fr))] gap-2 border-b pb-3">
                <div />
                {(board?.days ?? []).map((day) => (
                  <div key={day.date} className="rounded-lg border bg-muted/20 px-3 py-2 text-center">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">{day.weekday}</p>
                    <p className="mt-1 text-sm font-semibold">{day.dayMonth}</p>
                    <span className="mt-2 inline-flex rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-semibold text-primary">
                      {day.count}
                    </span>
                  </div>
                ))}
              </div>

              <div className="divide-y">
                {(board?.hours ?? []).map((hour) => (
                  <div key={hour} className="grid grid-cols-[64px_repeat(5,minmax(0,1fr))] gap-2 py-2">
                    <div className="pt-2 text-xs text-muted-foreground">{hour}</div>
                    {(board?.days ?? []).map((day) => {
                      const items = meetingsInHour(day.meetings, hour);
                      return (
                        <div key={`${day.date}-${hour}`} className="min-h-14 space-y-1 rounded-md border border-transparent bg-muted/10 p-1">
                          {items.map((meeting) => (
                            <MeetingBlock key={meeting.id} meeting={meeting} calling={calling} onOpen={setSelected} onCall={(leadId) => void call(leadId)} />
                          ))}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
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
                  <Button type="button" size="sm" variant="outline" onClick={() => void call(selected.leadId)}>
                    Chamar no WhatsApp
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

function StatCard({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail?: ReactNode;
  tone?: string;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-sm text-muted-foreground">{label}</p>
        <strong className={`mt-3 block font-display text-3xl ${tone ?? ""}`}>{value}</strong>
        {detail ? <div className="mt-2 text-xs text-muted-foreground">{detail}</div> : null}
      </CardContent>
    </Card>
  );
}
