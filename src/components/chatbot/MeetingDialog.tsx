import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { createLeadMeetingFn, leadMeetingContextFn, rescheduleLeadMeetingFn } from "@/lib/google-calendar.functions";
import {
  cleanEmail,
  meetingChoices,
  meetingFields,
  meetingSlot,
  type LeadMeetingView,
} from "@/lib/google-calendar";

function slotLabel(time: string) {
  const hour = Number(time.slice(0, 2)) + 1;
  return `${time}–${String(hour).padStart(2, "0")}:00`;
}

export function MeetingDialog({
  open,
  leadId,
  leadName,
  meeting,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  leadId: string;
  leadName: string;
  meeting?: LeadMeetingView | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const requestId = useRef("");
  const choices = meetingChoices();
  const [email, setEmail] = useState("");
  const [date, setDate] = useState(choices[0]?.date ?? "");
  const [time, setTime] = useState(choices[0]?.times[0] ?? "");
  const [attendees, setAttendees] = useState("");
  const [meet, setMeet] = useState(true);
  const [connected, setConnected] = useState(true);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState("");
  const editing = Boolean(meeting);
  const times = choices.find((day) => day.date === date)?.times ?? [];

  useEffect(() => {
    if (!open) return;
    requestId.current = crypto.randomUUID();
    setNote("");
    setSaving(false);
    const nextChoices = meetingChoices();
    const current = meeting ? meetingFields(meeting.startAt) : null;
    const day = nextChoices.find((item) => item.date === current?.date && item.times.includes(current.time)) ?? nextChoices[0];
    setDate(day?.date ?? "");
    setTime(current && day?.times.includes(current.time) ? current.time : day?.times[0] ?? "");
    if (meeting) return;
    setAttendees("");
    setMeet(true);
    setEmail("");
    setConnected(true);
    if (!leadId) return;
    let active = true;
    void leadMeetingContextFn({ data: { leadId } }).then((result) => {
      if (!active) return;
      if (!result.ok) {
        setNote(result.message);
        return;
      }
      if (result.data.email) setEmail(result.data.email);
      setConnected(result.data.connected);
    });
    return () => {
      active = false;
    };
  }, [open, leadId, leadName, meeting]);

  const ready = Boolean(meetingSlot({ date, time })) && (editing || Boolean(cleanEmail(email)));

  async function confirm() {
    if (saving || !ready) return;
    setSaving(true);
    setNote("");
    const result = editing && meeting
      ? await rescheduleLeadMeetingFn({ data: { meetingId: meeting.id, date, time } })
      : await createLeadMeetingFn({
          data: { leadId, requestId: requestId.current, email, attendees, date, time, meet },
        });
    setSaving(false);
    if (!result.ok) {
      setNote(result.message);
      return;
    }
    onSaved();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="chatbot-app meeting-dialog sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "Reagendar reunião" : "Agendar reunião"}</DialogTitle>
        </DialogHeader>
        <form
          className="meeting-form"
          onSubmit={(event) => {
            event.preventDefault();
            void confirm();
          }}
        >
          <label>
            Nome do lead
            <input value={leadName || meeting?.leadName || ""} readOnly aria-label="Nome do lead" />
          </label>
          {editing ? null : (
            <label>
              E-mail do lead
              <input value={email} type="email" maxLength={160} disabled={saving} aria-label="E-mail do lead" onChange={(event) => setEmail(event.target.value)} />
            </label>
          )}
          {choices.length ? (
            <>
              <label>
                Data
                <select aria-label="Data da reunião" value={date} disabled={saving} onChange={(event) => {
                  const next = event.target.value;
                  const nextTimes = choices.find((day) => day.date === next)?.times ?? [];
                  setDate(next);
                  setTime(nextTimes[0] ?? "");
                }}>
                  {choices.map((day) => (
                    <option key={day.date} value={day.date}>
                      {day.title}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Horário
                <select aria-label="Horário da reunião" value={time} disabled={saving} onChange={(event) => setTime(event.target.value)}>
                  {times.map((item) => (
                    <option key={item} value={item}>
                      {slotLabel(item)}
                    </option>
                  ))}
                </select>
              </label>
            </>
          ) : (
            <p className="composer-error">Não há horário disponível nos próximos 30 dias.</p>
          )}
          <p className="meeting-zone">Horário de Brasília.</p>
          {editing ? null : (
            <>
              <label>
                Participantes adicionais
                <input value={attendees} maxLength={500} disabled={saving} placeholder="emails separados por vírgula" aria-label="Participantes adicionais" onChange={(event) => setAttendees(event.target.value)} />
              </label>
              <label className="meeting-check">
                <input type="checkbox" checked={meet} disabled={saving} onChange={(event) => setMeet(event.target.checked)} />
                Gerar Google Meet
              </label>
            </>
          )}
          {!editing && !connected ? (
            <p className="composer-error">
              Conecte o Google Calendar em <Link to="/chatbot/agendamentos">Agendamentos</Link>.
            </p>
          ) : null}
          {note ? <p className="composer-error">{note}</p> : null}
          <div className="modal-actions">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving || !ready || (!editing && !connected)}>
              {saving ? "Salvando" : "Confirmar agendamento"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
