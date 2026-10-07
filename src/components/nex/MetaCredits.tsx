import { ExternalLink, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import stepAccount from "@/assets/meta-saldo-etapa-1.webp";
import stepPayment from "@/assets/meta-saldo-etapa-2.webp";
import { Button } from "@/components/ui/button";
import { normalizeBalanceLink } from "@/lib/balance-link";
import { getMetaCreditFn, startFacebookLoginFn } from "@/lib/meta-credit.functions";
import type { MetaCreditView } from "@/lib/meta-credit";

const guide = [
  {
    step: "1",
    title: "Acesse a conta de anúncios",
    text: "Na página da sua conta de anúncios, clique em “Adicionar fundos” para iniciar a recarga do saldo.",
    image: stepAccount,
    width: 1541,
    height: 1020,
    alt: "Conta de anúncios da Meta, com a seta indicando o botão Adicionar fundos.",
  },
  {
    step: "2",
    title: "Escolha o valor e a forma de pagamento",
    text: "Defina o valor que deseja adicionar, selecione a forma de pagamento e clique em “Avançar” para concluir.",
    image: stepPayment,
    width: 1012,
    height: 1555,
    alt: "Tela Adicionar fundos da Meta, com o valor, o Pix e o botão Avançar.",
  },
] as const;

function money(cents: number | null, currency: string) {
  if (cents == null || !Number.isFinite(cents)) return "—";
  try {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(cents / 100);
  } catch {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
      cents / 100,
    );
  }
}

function balanceHint(kind: MetaCreditView["balanceKind"]) {
  if (kind === "available") return "Disponível para anúncios";
  if (kind === "prepaid")
    return "Pix recebido, menos as cobranças do saldo pré-pago. A Meta cobra o cartão antes.";
  if (kind === "due") return "Valor em aberto com a Meta";
  return "A Meta não informou o saldo desta conta.";
}

export function MetaCredits() {
  const [view, setView] = useState<MetaCreditView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [loggedIn, setLoggedIn] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [entering, setEntering] = useState(false);
  const watchRef = useRef<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const result = await getMetaCreditFn();
    setLoading(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setView(result.data);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data as { source?: string; ok?: boolean; message?: string } | null;
      if (!data || data.source !== "nex-facebook-login") return;
      if (watchRef.current) window.clearInterval(watchRef.current);
      watchRef.current = null;
      setEntering(false);
      if (data.ok) {
        setLoggedIn(true);
        setLoginError("");
        return;
      }
      setLoginError(data.message || "O login no Facebook não foi concluído.");
    };
    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("message", onMessage);
      if (watchRef.current) window.clearInterval(watchRef.current);
    };
  }, []);

  const enter = () => {
    setEntering(true);
    setLoginError("");
    const width = 520;
    const height = 720;
    const left = window.screenX + Math.max(0, (window.outerWidth - width) / 2);
    const top = window.screenY + Math.max(0, (window.outerHeight - height) / 2);
    const popup = window.open(
      "about:blank",
      "nex-facebook-login",
      `popup=yes,width=${width},height=${height},left=${left},top=${top}`,
    );
    if (!popup) {
      setEntering(false);
      setLoginError(
        "O navegador bloqueou a janela do Facebook. Permita pop-ups neste site e tente de novo.",
      );
      return;
    }
    if (watchRef.current) window.clearInterval(watchRef.current);
    watchRef.current = window.setInterval(() => {
      if (!popup.closed) return;
      if (watchRef.current) window.clearInterval(watchRef.current);
      watchRef.current = null;
      setEntering(false);
    }, 500);
    void (async () => {
      try {
        const result = await startFacebookLoginFn();
        if (!result.ok) {
          popup.close();
          setEntering(false);
          setLoginError(result.message);
          return;
        }
        popup.location.href = result.data.url;
      } catch {
        popup.close();
        setEntering(false);
        setLoginError("Não foi possível abrir o login do Facebook.");
      }
    })();
  };

  const href = normalizeBalanceLink(view?.balanceUrl ?? "");
  const canOpen = Boolean(view?.canAdd && view.accountId && href && loggedIn);

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
      <section className="order-1 rounded-lg border bg-card p-5 lg:col-start-1 lg:row-start-1">
        <h2 className="font-display text-lg font-semibold">Adicionar saldo</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Entre com o Facebook. Em seguida, abra a página da Meta em que o saldo desta conta de
          anúncio é adicionado.
        </p>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          {!loggedIn && (
            <Button
              type="button"
              onClick={enter}
              disabled={!view?.canAdd || !view.accountId || entering || loading}
            >
              {entering ? "Abrindo o Facebook..." : "Entrar com o Facebook"}
            </Button>
          )}
          {canOpen && href && (
            <Button asChild>
              <a href={href} target="_blank" rel="noopener noreferrer">
                <ExternalLink />
                Adicionar saldo
              </a>
            </Button>
          )}
        </div>
        {loggedIn && <p className="mt-4 text-sm text-muted-foreground">Facebook conectado.</p>}
        {view && !view.canAdd && (
          <p className="mt-4 text-sm text-muted-foreground">
            Seu acesso pode consultar o saldo, mas não pode adicionar saldo.
          </p>
        )}
        {!loading && view?.accountId && view.canAdd && !href && (
          <p className="mt-4 text-sm text-muted-foreground">
            O link de saldo desta conta de anúncio ainda não foi informado no cadastro.
          </p>
        )}
        {!loading && view && !view.accountId && (
          <p className="mt-4 text-sm text-muted-foreground">
            Nenhuma conta de anúncio está integrada a este acesso.
          </p>
        )}
        {loginError && <p className="mt-4 text-sm text-destructive">{loginError}</p>}
        {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
        {loading && (
          <p className="mt-4 text-sm text-muted-foreground">Lendo a conta integrada na Meta...</p>
        )}
      </section>

      <section className="order-3 rounded-lg border bg-card p-5 lg:order-none lg:col-start-2 lg:row-start-1">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-lg font-semibold">Saldo Meta</h2>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Atualizar saldo"
            onClick={() => void load()}
            disabled={loading}
          >
            <RefreshCw className={loading ? "animate-spin" : ""} />
          </Button>
        </div>
        <div className="mt-4 rounded-lg bg-brand-gradient p-5 text-primary-foreground">
          <p className="text-sm opacity-80">
            {view ? balanceHint(view.balanceKind) : "Conta integrada"}
          </p>
          <strong className="mt-2 block font-display text-3xl">
            {money(view?.balanceCents ?? null, view?.currency || "BRL")}
          </strong>
          <p className="mt-4 truncate text-xs opacity-80">
            {view?.accountName
              ? `${view.accountName}${view.accountId ? ` · ${view.accountId}` : ""}`
              : "Nenhuma conta de anúncio integrada"}
          </p>
        </div>
      </section>

      <section className="order-2 rounded-lg border bg-card p-5 lg:order-none lg:col-span-2 lg:row-start-2">
        <p className="text-xs font-semibold uppercase tracking-[.16em] text-primary">
          Na página da Meta
        </p>
        <h2 className="mt-2 font-display text-lg font-semibold">O que fazer depois de entrar</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Depois de entrar, clique em Adicionar saldo. Na conta de anúncios da Meta, siga estes dois
          passos.
        </p>
        <ol className="mt-5 grid grid-cols-1 items-start gap-4 md:grid-cols-12">
          {guide.map((item) => (
            <li
              key={item.step}
              className={
                item.step === "2"
                  ? "w-1/2 max-w-full overflow-hidden rounded-lg border bg-background md:col-span-3 md:w-auto"
                  : "w-full overflow-hidden rounded-lg border bg-background md:col-span-9"
              }
            >
              <div className="flex gap-3 p-4">
                <span
                  className={
                    item.step === "1"
                      ? "grid size-8 shrink-0 place-items-center rounded-full bg-cyan font-display text-sm font-bold text-navy"
                      : "grid size-8 shrink-0 place-items-center rounded-full bg-primary font-display text-sm font-bold text-primary-foreground"
                  }
                >
                  {item.step}
                </span>
                <div className="min-w-0">
                  <p className="font-display text-sm font-semibold">{item.title}</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">{item.text}</p>
                </div>
              </div>
              <img
                src={item.image}
                width={item.width}
                height={item.height}
                alt={item.alt}
                className="h-auto w-full border-t"
              />
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
