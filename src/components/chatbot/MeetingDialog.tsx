import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { createLeadMeetingFn, leadMeetingContextFn, rescheduleLeadMeetingFn } from "@/lib/google-calendar.functions";
import { defaultReturnSlot } from "@/lib/chatbot-evo";
import {
  cleanEmail,
  cleanMeetingTitle,
  meetingDurations,
  meetingFields,
  meetingLength,
  meetingSlot,
  type LeadMeetingView,
} from "@/lib/google-calendar";

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
  const slot = defaultReturnSlot();
  const [email, setEmail] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(slot.date);
  const [time, setTime] = useState(`${String(slot.hour).padStart(2, "0")}:${String(slot.minute).padStart(2, "0")}`);
  const [duration, setDuration] = useState<(typeof meetingDurations)[number]>(30);
  const [attendees, setAttendees] = useState("");
  const [meet, setMeet] = useState(true);
  const [connected, setConnected] = useState(true);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState("");
  const editing = Boolean(meeting);

  useEffect(() => {
    if (!open) return;
    requestId.current = crypto.randomUUID();
    setNote("");
    setSaving(false);
    if (meeting) {
      const fields = meetingFields(meeting.startAt);
      setDate(fields.date);
      setTime(fields.time);
      setDuration(meetingLength(meeting.startAt, meeting.endAt));
      return;
    }
    const next = defaultReturnSlot();
    setTitle(leadName ? `Reunião com ${leadName}` : "");
    setDescription("");
    setAttendees("");
    setMeet(true);
    setDate(next.date);
    setTime(`${String(next.hour).padStart(2, "0")}:00`);
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
      if (result.data.leadName) setTitle((current) => current || `Reunião com ${result.data.leadName}`);
    });
    return () => {
      active = false;
    };
  }, [open, leadId, leadName, meeting]);

  const ready = Boolean(meetingSlot({ date, time, duration })) && (editing || (Boolean(cleanMeetingTitle(title)) && Boolean(cleanEmail(email))));

  async function confirm() {
    if (saving || !ready) return;
    setSaving(true);
    setNote("");
    const result = editing && meeting
      ? await rescheduleLeadMeetingFn({ data: { meetingId: meeting.id, date, time, duration } })
      : await createLeadMeetingFn({
          data: { leadId, requestId: requestId.current, title, description, email, attendees, date, time, duration, meet },
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
            <>
              <label>
                E-mail do lead
                <input value={email} type="email" maxLength={160} disabled={saving} aria-label="E-mail do lead" onChange={(event) => setEmail(event.target.value)} />
              </label>
              <label>
                Assunto
                <input value={title} maxLength={120} disabled={saving} aria-label="Assunto da reunião" onChange={(event) => setTitle(event.target.value)} />
              </label>
              <label>
                Descrição
                <textarea value={description} maxLength={2000} disabled={saving} aria-label="Descrição da reunião" onChange={(event) => setDescription(event.target.value)} />
              </label>
            </>
          )}
          <label>
            Data
            <input value={date} type="date" disabled={saving} aria-label="Data da reunião" onChange={(event) => setDate(event.target.value)} />
          </label>
          <label>
            Horário inicial
            <input value={time} type="time" disabled={saving} aria-label="Horário inicial" onChange={(event) => setTime(event.target.value)} />
          </label>
          <label>
            Duração
            <select aria-label="Duração" value={duration} disabled={saving} onChange={(event) => setDuration(Number(event.target.value) as (typeof meetingDurations)[number])}>
              {meetingDurations.map((minutes) => (
                <option key={minutes} value={minutes}>
                  {minutes} minutos
                </option>
              ))}
            </select>
          </label>
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
