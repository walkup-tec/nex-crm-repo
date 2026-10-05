import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Brand } from "@/components/nex/Brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Nova senha — NEX Ads" },
      { name: "description", content: "Defina uma nova senha para o NEX Ads." },
      { property: "og:title", content: "Nova senha — NEX Ads" },
      { property: "og:description", content: "Defina uma nova senha para o NEX Ads." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});

function Page() {
  const nav = useNavigate();
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setHasSession(Boolean(session));
      setReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!hasSession) {
      setError("Este link não é válido ou expirou.");
      return;
    }
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password"));
    if (password.length < 8) {
      setError("Use pelo menos 8 caracteres.");
      return;
    }
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError("Não foi possível atualizar a senha.");
      return;
    }
    nav({ to: "/dashboard" });
  };

  return (
    <main className="grid min-h-screen place-items-center bg-muted/40 px-4">
      <form onSubmit={submit} className="w-full max-w-md rounded-xl border bg-card p-7 shadow-panel">
        <Brand />
        <h1 className="mt-8 font-display text-2xl font-bold">Defina sua senha</h1>
        <p className="mt-2 text-sm text-muted-foreground">Escolha uma senha com pelo menos 8 caracteres.</p>
        <Input name="password" type="password" className="mt-6" required disabled={!ready || !hasSession} />
        {ready && !hasSession && <p className="mt-3 text-sm text-destructive">Este link não é válido ou expirou.</p>}
        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
        <Button className="mt-5 w-full" disabled={!ready || !hasSession}>
          Salvar senha
        </Button>
      </form>
    </main>
  );
}
