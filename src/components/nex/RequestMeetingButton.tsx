import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { listMeetingCalendarFn, requestClientMeetingContextFn, requestClientMeetingFn } from "@/lib/google-calendar.functions";
import { cleanEmail, meetingChoices, meetingSlot } from "@/lib/google-calendar";

function slotLabel(time: string) {
  const hour = Number(time.slice(0, 2)) + 1;
  return `${time}–${String(hour).padStart(2, "0")}:00`;
}

export function RequestMeetingButton() {
  const requestId = useRef("");
  const savingRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [choices, setChoices] = useState(meetingChoices());
  const [slotsReady, setSlotsReady] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [attendees, setAttendees] = useState("");
  const [meet, setMeet] = useState(true);
  const [connected, setConnected] = useState(true);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState("");
  const times = choices.find((day) => day.date === date)?.times ?? [];
  const ready = Boolean(meetingSlot({ date, time })) && Boolean(cleanEmail(email));

  useEffect(() => {
    if (!open || savingRef.current) return;
    requestId.current = crypto.randomUUID();
    setNote("");
    setSaving(false);
    setSlotsReady(false);
    setAttendees("");
    setMeet(true);
    let active = true;
    void (async () => {
      const [calendar, context] = await Promise.all([listMeetingCalendarFn(), requestClientMeetingContextFn()]);
      if (!active) return;
      if (calendar.ok) {
        const next = meetingChoices(Date.now(), calendar.data);
        const day = next[0];
        setChoices(next);
        setDate(day?.date ?? "");
        setTime(day?.times[0] ?? "");
      } else {
        setChoices([]);
        setDate("");
        setTime("");
        setNote(calendar.message);
      }
      setSlotsReady(true);
      if (!context.ok) {
        setNote(context.message);
        setConnected(false);
        return;
      }
      setName(context.data.name);
      setEmail(context.data.email);
      setConnected(context.data.connected);
    })();
    return () => {
      active = false;
    };
  }, [open]);

  async function confirm() {
    if (saving || !ready) return;
    savingRef.current = true;
    setSaving(true);
    setNote("");
    try {
      const result = await requestClientMeetingFn({
        data: { requestId: requestId.current, attendees, date, time, meet },
      });
      if (!result.ok) {
        setNote(result.message);
        return;
      }
      setOpen(false);
    } catch {
      setNote("A resposta não voltou. Confira a agenda antes de solicitar de novo.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  return (
    <>
      <Button type="button" size="sm" className="h-8 px-2.5 text-xs" onClick={() => setOpen(true)}>
        Solicitar Reunião
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="chatbot-app meeting-dialog sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Solicitar reunião</DialogTitle>
          </DialogHeader>
          <form
            className="meeting-form"
            onSubmit={(event) => {
              event.preventDefault();
              void confirm();
            }}
          >
            <label>
              Nome
              <input value={name} readOnly disabled aria-label="Nome do usuário" />
            </label>
            <label>
              E-mail do lead
              <input value={email} type="email" readOnly disabled aria-label="E-mail do lead" />
            </label>
            {!slotsReady ? (
              <p className="meeting-zone">Carregando horários.</p>
            ) : choices.length ? (
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
              <p className="composer-error">Não há horário disponível nas próximas 4 semanas.</p>
            )}
            <p className="meeting-zone">Horário de Brasília.</p>
            <label>
              Participantes adicionais
              <input value={attendees} maxLength={500} disabled={saving} placeholder="emails separados por vírgula" aria-label="Participantes adicionais" onChange={(event) => setAttendees(event.target.value)} />
            </label>
            <label className="meeting-check">
              <input type="checkbox" checked={meet} disabled={saving} onChange={(event) => setMeet(event.target.checked)} />
              Gerar Google Meet
            </label>
            {!connected ? (
              <p className="composer-error">
                Conecte o Google Calendar em <Link to="/chatbot/agendamentos">Agendamentos</Link>.
              </p>
            ) : null}
            {note ? <p className="composer-error">{note}</p> : null}
            <div className="modal-actions">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving || !ready || !connected}>
                {saving ? "Salvando" : "Confirmar agendamento"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
