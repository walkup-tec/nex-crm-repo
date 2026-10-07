import { ExternalLink, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { normalizeBalanceLink } from "@/lib/balance-link";
import { loadFacebookSdk, type FacebookSdk } from "@/lib/facebook-login";
import { getMetaCreditFn } from "@/lib/meta-credit.functions";
import type { MetaCreditView } from "@/lib/meta-credit";

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
  if (kind === "due") return "Valor em aberto com a Meta";
  return "A Meta não informou o saldo desta conta.";
}

export function MetaCredits() {
  const [view, setView] = useState<MetaCreditView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sdk, setSdk] = useState<FacebookSdk | null>(null);
  const [loggedIn, setLoggedIn] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [entering, setEntering] = useState(false);

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
    const appId = view?.facebookAppId;
    const version = view?.facebookSdkVersion;
    if (!appId || !version) return;
    let cancelled = false;
    void loadFacebookSdk(appId, version)
      .then((next) => {
        if (cancelled) return;
        setSdk(next);
        next.getLoginStatus((response) => {
          if (!cancelled) setLoggedIn(response.status === "connected");
        });
      })
      .catch(() => {
        if (!cancelled) setLoginError("Não foi possível abrir o login do Facebook.");
      });
    return () => {
      cancelled = true;
    };
  }, [view?.facebookAppId, view?.facebookSdkVersion]);

  const enter = () => {
    if (!sdk) return;
    setEntering(true);
    setLoginError("");
    sdk.login(
      (response) => {
        setEntering(false);
        if (response.status === "connected") {
          setLoggedIn(true);
          return;
        }
        setLoginError("O login no Facebook não foi concluído.");
      },
      { scope: "public_profile" },
    );
  };

  const href = normalizeBalanceLink(view?.balanceUrl ?? "");
  const canOpen = Boolean(view?.canAdd && view.accountId && href && loggedIn);

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
      <section className="rounded-lg border bg-card p-5">
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
              disabled={!view?.canAdd || !view.accountId || !view.facebookAppId || !sdk || entering}
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
        {!loading && view?.canAdd && view.accountId && !view.facebookAppId && (
          <p className="mt-4 text-sm text-muted-foreground">
            O login do Facebook ainda não está configurado no servidor.
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

      <section className="rounded-lg border bg-card p-5">
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
    </div>
  );
}
