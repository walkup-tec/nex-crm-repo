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

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code") ?? "";
    const state = params.get("state") ?? "";
    const error = params.get("error") ?? "";
    const errorReason = params.get("error_reason") ?? "";
    window.history.replaceState({}, "", "/auth/meta/callback");
    void (async () => {
      const data: { code?: string; state?: string; error?: string; errorReason?: string } = {};
      if (code) data.code = code;
      if (state) data.state = state;
      if (error) data.error = error;
      if (errorReason) data.errorReason = errorReason;
      try {
        const result = await completeMetaOAuthFn({ data });
        const popupFlow = window.name === "nex-meta-connect";
        if (!result.ok) {
          if (window.opener) {
            window.opener.postMessage({ source: "nex-meta", ok: false, message: result.message }, window.location.origin);
          }
          setFailed(true);
          setMessage(result.message);
          return;
        }
        if (popupFlow || window.opener) {
          if (window.opener) {
            window.opener.postMessage(
              { source: "nex-meta", ok: true, organizationId: result.data.organizationId },
              window.location.origin,
            );
            window.close();
          }
          setMessage("Conexão concluída. Volte para a janela do NEX e escolha o portfólio.");
          return;
        }
        window.location.assign(`/dashboard?org=${encodeURIComponent(result.data.organizationId)}`);
      } catch {
        setFailed(true);
        setMessage("Entre novamente no NEX e repita a conexão com a Meta.");
      }
    })();
  }, []);

  return (
    <main className="grid min-h-screen place-items-center bg-muted/40 px-4">
      <div className="w-full max-w-md rounded-xl border bg-card p-7 shadow-panel">
        <Brand />
        <h1 className="mt-8 font-display text-2xl font-bold">Conexão Meta</h1>
        <p className="mt-2 text-sm text-muted-foreground">{message}</p>
        {failed && (
          <Button asChild className="mt-5 w-full">
            <Link to="/dashboard">Voltar para a visão geral</Link>
          </Button>
        )}
      </div>
    </main>
  );
}
