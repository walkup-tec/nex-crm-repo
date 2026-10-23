import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { MeetingDialog } from "@/components/chatbot/MeetingDialog";
import {
  cancelLeadMeetingFn,
  disconnectGoogleCalendarFn,
  googleCalendarConnectionFn,
  listLeadMeetingsFn,
  startGoogleCalendarConnectFn,
} from "@/lib/google-calendar.functions";
import { meetingWhen, type GoogleCalendarConnectionView, type LeadMeetingView } from "@/lib/google-calendar";

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
      <MeetingCards meetings={meetings} empty="Nenhuma reunião agendada." onChanged={() => setVersion((value) => value + 1)} />
    </>
  );
}

export function CalendarMeetings() {
  const [connection, setConnection] = useState<GoogleCalendarConnectionView | null>(null);
  const [meetings, setMeetings] = useState<LeadMeetingView[]>([]);
  const [note, setNote] = useState("");
  const [pending, setPending] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [version, setVersion] = useState(0);

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
      const [linked, list] = await Promise.all([
        googleCalendarConnectionFn(),
        listLeadMeetingsFn({ data: {} }),
      ]);
      if (!active) return;
      if (!linked.ok) setNote(linked.message);
      else setConnection(linked.data);
      if (!list.ok) setNote(list.message);
      else setMeetings(list.data);
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
      <MeetingCards meetings={meetings} empty="Nenhuma reunião próxima." onChanged={() => setVersion((value) => value + 1)} />
    </section>
  );
}
