import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Brand } from "@/components/nex/Brand";
import { Button } from "@/components/ui/button";
import { completeMetaOAuthFn } from "@/lib/meta.functions";

export const Route = createFileRoute("/auth/meta/callback")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Conexão Meta — NEX Ads" },
      { name: "description", content: "Conclusão da autorização com a Meta." },
    ],
  }),
  component: CallbackPage,
});

function CallbackPage() {
  const [message, setMessage] = useState("Concluindo a conexão com a Meta...");
  const [failed, setFailed] = useState(false);
  const [login, setLogin] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code") ?? "";
    const state = params.get("state") ?? "";
    const error = params.get("error") ?? "";
    const errorReason = params.get("error_reason") ?? "";
    const loginFlow = state.startsWith("login.");
    const source = loginFlow ? "nex-facebook-login" : "nex-meta";
    window.history.replaceState({}, "", "/auth/meta/callback");
    if (loginFlow) {
      setLogin(true);
      setMessage("Concluindo o login no Facebook...");
    }
    const notify = (ok: boolean, text?: string, organizationId?: string) => {
      if (!window.opener) return;
      const payload: {
        source: string;
        ok: boolean;
        message?: string;
        organizationId?: string;
      } = { source, ok };
      if (text) payload.message = text;
      if (organizationId) payload.organizationId = organizationId;
      window.opener.postMessage(payload, window.location.origin);
    };
    void (async () => {
      const data: { code?: string; state?: string; error?: string; errorReason?: string } = {};
      if (code) data.code = code;
      if (state) data.state = state;
      if (error) data.error = error;
      if (errorReason) data.errorReason = errorReason;
      try {
        const result = await completeMetaOAuthFn({ data });
        if (!result.ok) {
          notify(false, result.message);
          setFailed(true);
          setMessage(result.message);
          return;
        }
        if (loginFlow || result.data.purpose === "login") {
          notify(true);
          setMessage("Login concluído. Volte para a janela do NEX.");
          window.close();
          return;
        }
        const popupFlow = window.name === "nex-meta-connect";
        if (popupFlow || window.opener) {
          notify(true, undefined, result.data.organizationId);
          if (window.opener) window.close();
          setMessage("Conexão concluída. Volte para a janela do NEX e escolha o portfólio.");
          return;
        }
        window.location.assign(`/dashboard?org=${encodeURIComponent(result.data.organizationId)}`);
      } catch {
        notify(false, "Entre novamente no NEX e repita a conexão com a Meta.");
        setFailed(true);
        setMessage(
          loginFlow
            ? "Entre novamente no NEX e repita o login no Facebook."
            : "Entre novamente no NEX e repita a conexão com a Meta.",
        );
      }
    })();
  }, []);

  return (
    <main className="grid min-h-screen place-items-center bg-muted/40 px-4">
      <div className="w-full max-w-md rounded-xl border bg-card p-7 shadow-panel">
        <Brand />
        <h1 className="mt-8 font-display text-2xl font-bold">
          {login ? "Login no Facebook" : "Conexão Meta"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">{message}</p>
        {failed && login && (
          <Button type="button" className="mt-5 w-full" onClick={() => window.close()}>
            Fechar
          </Button>
        )}
        {failed && !login && (
          <Button asChild className="mt-5 w-full">
            <Link to="/dashboard">Voltar para a visão geral</Link>
          </Button>
        )}
      </div>
    </main>
  );
}
