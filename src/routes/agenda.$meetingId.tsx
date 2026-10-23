import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { publicMeetingCardFn } from "@/lib/google-calendar.functions";

type MeetingCard = {
  name: string;
  title: string;
  when: string;
  email: string;
  meetUrl: string;
  calendarUrl: string;
};

export const Route = createFileRoute("/agenda/$meetingId")({
  ssr: false,
  head: () => ({ meta: [{ title: "Confirmar agendamento — NEX" }] }),
  component: AgendaConfirmPage,
});

function AgendaConfirmPage() {
  const { meetingId } = Route.useParams();
  const [card, setCard] = useState<MeetingCard | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let active = true;
    void publicMeetingCardFn({ data: { meetingId } }).then((result) => {
      if (!active) return;
      if (!result.ok || !result.data) {
        setMissing(true);
        return;
      }
      setCard(result.data);
    });
    return () => {
      active = false;
    };
  }, [meetingId]);

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-6 px-6 py-10">
      <div>
        <p className="text-sm font-semibold text-primary">NEX Marketing Digital</p>
        <h1 className="mt-2 text-3xl font-bold">Confirmar agendamento</h1>
      </div>
      {missing ? <p className="text-sm text-muted-foreground">Esse horário não está mais disponível.</p> : null}
      {!missing && !card ? <p className="text-sm text-muted-foreground">Carregando o agendamento.</p> : null}
      {card ? (
        <section className="grid gap-4 rounded-xl border bg-card p-5">
          <p className="text-lg font-semibold">{card.name || "Sua reunião"}</p>
          <dl className="grid gap-3 text-sm">
            <div>
              <dt className="text-muted-foreground">Assunto</dt>
              <dd>{card.title}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Quando</dt>
              <dd>{card.when} · Horário de Brasília</dd>
            </div>
            {card.email ? (
              <div>
                <dt className="text-muted-foreground">E-mail</dt>
                <dd>{card.email}</dd>
              </div>
            ) : null}
          </dl>
          <p className="text-sm text-muted-foreground">
            Abra o Google Calendar com o e-mail do convite para confirmar o horário. O especialista fica reservado para você nesse período.
          </p>
          {card.calendarUrl ? (
            <a className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground" href={card.calendarUrl} target="_blank" rel="noreferrer">
              Confirmar no Google Calendar
            </a>
          ) : (
            <p className="text-sm">A confirmação também foi enviada para o seu e-mail.</p>
          )}
          {card.meetUrl ? (
            <a className="text-sm font-semibold text-primary" href={card.meetUrl} target="_blank" rel="noreferrer">
              Abrir Google Meet
            </a>
          ) : null}
        </section>
      ) : null}
    </main>
  );
}
