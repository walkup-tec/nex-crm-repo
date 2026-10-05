import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Brand } from "@/components/nex/Brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { checkAccessEmailFn, createAccessPasswordFn } from "@/lib/activation.functions";

const missingMessage = "Entre em contato com o administrador da NEX e solicite seu cadastro de usuário";

export const Route = createFileRoute("/primeiro-acesso")({
  head: () => ({
    meta: [
      { title: "Criar senha — NEX Ads" },
      { name: "description", content: "Ative seu acesso ao NEX criando uma senha." },
    ],
  }),
  component: Page,
});

function Page() {
  const nav = useNavigate();
  const [email, setEmail] = useState(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("email") ?? "";
  });
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [step, setStep] = useState<"email" | "password">("email");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const checkEmail = async (event: React.FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError("");
    const result = await checkAccessEmailFn({ data: { email } });
    setPending(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    if (result.data.state === "missing") {
      setError(missingMessage);
      return;
    }
    if (result.data.state === "blocked") {
      setError("Este acesso está bloqueado.");
      return;
    }
    if (result.data.state === "active") {
      setError("Este acesso já possui senha. Entre na tela de login.");
      return;
    }
    setStep("password");
  };

  const createPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password.length < 8) {
      setError("Use pelo menos 8 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("As senhas não são iguais.");
      return;
    }
    setPending(true);
    setError("");
    const created = await createAccessPasswordFn({ data: { email, password } });
    if (!created.ok) {
      setPending(false);
      setError(created.message);
      return;
    }
    const { error: signError } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    setPending(false);
    if (signError) {
      setError("A senha foi criada. Entre com seu e-mail e senha.");
      return;
    }
    nav({ to: "/auth" });
  };

  return (
    <main className="grid min-h-screen place-items-center bg-muted/40 px-4">
      <div className="w-full max-w-md rounded-xl border bg-card p-7 shadow-panel">
        <Brand />
        <h1 className="mt-8 font-display text-2xl font-bold">Criar minha senha</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Informe o e-mail cadastrado pela equipe NEX. Se ele estiver no sistema, você cria a senha e entra em seguida.
        </p>
        {step === "email" ? (
          <form onSubmit={checkEmail} className="mt-6 space-y-4">
            <div>
              <label htmlFor="access-email" className="text-sm font-medium">
                E-mail
              </label>
              <Input
                id="access-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-2 h-11"
                placeholder="voce@empresa.com.br"
                required
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "Verificando..." : "Continuar"}
            </Button>
          </form>
        ) : (
          <form onSubmit={createPassword} className="mt-6 space-y-4">
            <p className="text-sm text-muted-foreground">{email}</p>
            <div>
              <label htmlFor="access-password" className="text-sm font-medium">
                Senha
              </label>
              <Input
                id="access-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-2 h-11"
                required
                minLength={8}
              />
            </div>
            <div>
              <label htmlFor="access-confirm" className="text-sm font-medium">
                Repetir senha
              </label>
              <Input
                id="access-confirm"
                type="password"
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                className="mt-2 h-11"
                required
                minLength={8}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "Criando acesso..." : "Criar minha senha"}
            </Button>
          </form>
        )}
        <p className="mt-5 text-center text-sm text-muted-foreground">
          <Link to="/auth" className="font-medium text-primary hover:underline">
            Ir para o login
          </Link>
        </p>
      </div>
    </main>
  );
}
