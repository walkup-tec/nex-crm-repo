import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Brand } from "@/components/nex/Brand";
import { Button } from "@/components/ui/button";
import { completeGoogleCalendarOAuthFn } from "@/lib/google-calendar.functions";

export const Route = createFileRoute("/auth/google/callback")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Google Calendar — NEX" },
      { name: "description", content: "Conclusão da autorização com o Google Calendar." },
    ],
  }),
  component: CallbackPage,
});

function CallbackPage() {
  const [message, setMessage] = useState("Concluindo a conexão com o Google Calendar...");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code") ?? "";
    const state = params.get("state") ?? "";
    const error = params.get("error") ?? "";
    window.history.replaceState({}, "", "/auth/google/callback");
    const notify = (ok: boolean, text?: string) => {
      if (!window.opener) return;
      const payload: { source: string; ok: boolean; message?: string } = { source: "nex-google-calendar", ok };
      if (text) payload.message = text;
      window.opener.postMessage(payload, window.location.origin);
    };
    void (async () => {
      try {
        const result = await completeGoogleCalendarOAuthFn({ data: { code, state, error } });
        if (!result.ok) {
          notify(false, result.message);
          setFailed(true);
          setMessage(result.message);
          return;
        }
        notify(true);
        setMessage("Google Calendar conectado. Volte para a janela do NEX.");
        if (window.opener) window.close();
        else window.location.assign("/chatbot/agendamentos");
      } catch {
        notify(false, "Entre novamente no NEX e repita a conexão com o Google Calendar.");
        setFailed(true);
        setMessage("Entre novamente no NEX e repita a conexão com o Google Calendar.");
      }
    })();
  }, []);

  return (
    <main className="grid min-h-screen place-items-center bg-muted/40 px-4">
      <div className="w-full max-w-md rounded-xl border bg-card p-7 shadow-panel">
        <Brand />
        <h1 className="mt-8 font-display text-2xl font-bold">Google Calendar</h1>
        <p className="mt-2 text-sm text-muted-foreground">{message}</p>
        {failed ? (
          <Button asChild className="mt-5 w-full">
            <Link to="/chatbot/agendamentos">Voltar para Agendamentos</Link>
          </Button>
        ) : null}
      </div>
    </main>
  );
}
