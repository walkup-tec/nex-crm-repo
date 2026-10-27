import { useEffect, useRef, useState, type FocusEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { MeetingDialog } from "@/components/chatbot/MeetingDialog";
import { callChatbotContactFn } from "@/lib/chatbot.functions";
import {
  cancelLeadMeetingFn,
  disconnectGoogleCalendarFn,
  googleCalendarConnectionFn,
  listLeadMeetingsFn,
  listMeetingCalendarFn,
  startGoogleCalendarConnectFn,
} from "@/lib/google-calendar.functions";
import { meetingForWindow, meetingOnContactCard, meetingWhen, type GoogleCalendarConnectionView, type LeadMeetingView, type MeetingCalendarDay, type MeetingWindow } from "@/lib/google-calendar";

const openConversationKey = "nex-kanban-conversation";

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
                  void navigator.clipboard.writeText(meet).then(() => {
                    setCopied(true);
                    window.setTimeout(() => setCopied(false), 1600);
                  }).catch(() => setCopied(false));
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
      <MeetingCards meetings={meetings.filter((meeting) => meetingOnContactCard(meeting.status))} empty="Nenhuma reunião agendada." onChanged={() => setVersion((value) => value + 1)} />
    </>
  );
}

export function CalendarMeetings() {
  const navigate = useNavigate();
  const [connection, setConnection] = useState<GoogleCalendarConnectionView | null>(null);
  const [meetings, setMeetings] = useState<LeadMeetingView[]>([]);
  const [days, setDays] = useState<MeetingCalendarDay[]>([]);
  const [note, setNote] = useState("");
  const [pending, setPending] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [version, setVersion] = useState(0);
  const [calling, setCalling] = useState("");

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
      const [linked, list, calendar] = await Promise.all([
        googleCalendarConnectionFn(),
        listLeadMeetingsFn({ data: {} }),
        listMeetingCalendarFn(),
      ]);
      if (!active) return;
      if (!linked.ok) setNote(linked.message);
      else setConnection(linked.data);
      if (!list.ok) setNote(list.message);
      else setMeetings(list.data);
      if (!calendar.ok) setNote(calendar.message);
      else setDays(calendar.data);
      setLoaded(true);
    })();
    return () => {
      active = false;
    };
  }, [version]);

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

  const connected = connection?.status === "connected";
  if (!loaded) return <p className="meeting-empty">Carregando agendamentos.</p>;
  if (!connection?.enabled) return <p className="meeting-empty">{note || "Nenhum agendamento."}</p>;
  return (
    <section className="calendar-board">
      <header className="calendar-toolbar">
        <div>
          <strong>{connected ? connection.email || "Google Calendar" : "Google Calendar"}</strong>
          <p>{connected ? "Conta conectada. As próximas reuniões aparecem abaixo." : "Conecte a conta para criar reuniões com Google Meet."}</p>
        </div>
        {connected ? (
          <Button type="button" variant="outline" disabled={pending === "disconnect"} onClick={() => void disconnect()}>
            {pending === "disconnect" ? "Desconectando" : "Desconectar"}
          </Button>
        ) : (
          <Button type="button" disabled={pending === "connect"} onClick={connect}>
            {pending === "connect" ? "Aguardando Google" : "Conectar Google Calendar"}
          </Button>
        )}
      </header>
      {note ? <p className="composer-error">{note}</p> : null}
      <div className="agenda-legend">
        <span className="is-available">Livre</span>
        <span className="is-occupied">Ocupado</span>
        <span className="is-past">Encerrado</span>
      </div>
      <p className="meeting-zone">Próximos 30 dias, no horário de Brasília.</p>
      <div className="agenda-month">
        {days.map((day) => (
          <article className={`agenda-day${day.closed ? " is-closed" : ""}`} key={day.date}>
            <header>{day.title}</header>
            {day.closed ? <p>Sem expediente</p> : null}
            {day.windows.map((slot) => (
              <AgendaWindow key={slot.start} slot={slot} meeting={meetingForWindow(meetings, slot.start, slot.end)} calling={calling} onCall={(leadId) => void call(leadId)} />
            ))}
          </article>
        ))}
      </div>
      <MeetingCards meetings={meetings} empty="Nenhuma reunião próxima." onChanged={() => setVersion((value) => value + 1)} />
    </section>
  );
}
