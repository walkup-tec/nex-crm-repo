import { Copy, ExternalLink, RefreshCw, WalletCards } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { normalizeBalanceLink } from "@/lib/balance-link";
import { getMetaCreditFn, requestMetaCreditFn } from "@/lib/meta-credit.functions";
import {
  balanceGrew,
  centsFromMoneyInput,
  type MetaCreditCharge,
  type MetaCreditView,
} from "@/lib/meta-credit";
import { applyMask } from "@/lib/masks";

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

function qrSrc(image: string) {
  if (image.startsWith("data:image/") || image.startsWith("https://")) return image;
  if (image.startsWith("iVBORw0KGgo") && image.length > 80) return `data:image/png;base64,${image}`;
  return "";
}

function billingHref(value: string | null) {
  if (!value) return null;
  return normalizeBalanceLink(value);
}

export function MetaCredits() {
  const [view, setView] = useState<MetaCreditView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [amount, setAmount] = useState("");
  const [chargeOpen, setChargeOpen] = useState(false);
  const [charge, setCharge] = useState<MetaCreditCharge | null>(null);
  const chargeRef = useRef<MetaCreditCharge | null>(null);
  const [chargeError, setChargeError] = useState("");
  const [chargeLoading, setChargeLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [grew, setGrew] = useState(false);

  const rememberCharge = (next: MetaCreditCharge | null) => {
    chargeRef.current = next;
    setCharge(next);
  };

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
    const baseline = chargeRef.current;
    if (
      baseline &&
      result.data.balanceKind === "available" &&
      balanceGrew(baseline.balanceCents, result.data.balanceCents, baseline.totalCents)
    ) {
      setGrew(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const requestPix = async () => {
    const cents = centsFromMoneyInput(amount);
    if (cents == null) {
      setChargeError("Informe um valor maior que zero.");
      rememberCharge(null);
      setChargeOpen(true);
      return;
    }
    setChargeOpen(true);
    rememberCharge(null);
    setChargeError("");
    setCopied(false);
    setGrew(false);
    setChargeLoading(true);
    const result = await requestMetaCreditFn({ data: { cents } });
    setChargeLoading(false);
    if (!result.ok) {
      setChargeError(result.message);
      return;
    }
    rememberCharge(result.data);
    setView((current) =>
      current
        ? {
            ...current,
            accountName: result.data.accountName,
            currency: result.data.currency,
            balanceCents: result.data.balanceCents,
            balanceKind: result.data.balanceKind,
            syncedAt: new Date().toISOString(),
          }
        : current,
    );
  };

  const step = grew ? 3 : charge?.pix || charge?.notice ? 2 : amount ? 1 : 0;
  const href = billingHref(charge?.billingUrl ?? null);
  const image = qrSrc(charge?.pix?.image ?? "");

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
      <section className="rounded-lg border bg-card p-5">
        <h2 className="font-display text-lg font-semibold">Adicionar créditos</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Informe o valor e abra o link de saldo desta conta de anúncio. O Pix é gerado pela Meta
          nessa página.
        </p>
        <div className="mt-5">
          <label className="text-sm font-medium" htmlFor="credit">
            Valor
          </label>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <Input
              id="credit"
              inputMode="numeric"
              value={amount}
              onChange={(event) => setAmount(applyMask("money", event.target.value))}
              placeholder="R$ 0,00"
              disabled={!view?.canAdd || !view.accountId || !view.balanceUrl}
            />
            <Button
              type="button"
              disabled={
                !view?.canAdd || !view.accountId || !view.balanceUrl || !amount || chargeLoading
              }
              onClick={() => void requestPix()}
            >
              Continuar
            </Button>
          </div>
        </div>
        {view && !view.canAdd && (
          <p className="mt-4 text-sm text-muted-foreground">
            Seu acesso pode consultar o saldo, mas não pode solicitar recarga.
          </p>
        )}
        {!loading && view?.accountId && !view.balanceUrl && (
          <p className="mt-4 text-sm text-muted-foreground">
            O link de saldo desta conta de anúncio ainda não foi informado no cadastro.
          </p>
        )}
        {!loading && view && !view.accountId && (
          <p className="mt-4 text-sm text-muted-foreground">
            Nenhuma conta de anúncio está integrada a este acesso.
          </p>
        )}
        <ol className="mt-5 grid gap-3 sm:grid-cols-3">
          {["Valor informado", "Pix gerado pela Meta", "Saldo atualizado"].map((label, index) => (
            <li key={label} className="flex items-center gap-2 text-xs">
              <span
                className={`grid size-6 place-items-center rounded-full font-bold ${step === index + 1 ? "bg-primary text-primary-foreground" : "bg-secondary"}`}
              >
                {index + 1}
              </span>
              {label}
            </li>
          ))}
        </ol>
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

      <Dialog open={chargeOpen} onOpenChange={setChargeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Recarga da conta Meta</DialogTitle>
            <DialogDescription>
              {charge
                ? `${charge.accountName} · ${money(charge.totalCents, charge.currency)}`
                : "A Meta gera o Pix de saldo da conta integrada."}
            </DialogDescription>
          </DialogHeader>
          {chargeLoading && <p className="text-sm text-muted-foreground">Consultando a Meta...</p>}
          {chargeError && <p className="text-sm text-destructive">{chargeError}</p>}
          {charge?.pix && (
            <div className="grid gap-4 sm:grid-cols-[160px_1fr]">
              <div className="grid aspect-square place-items-center overflow-hidden rounded-lg border bg-white">
                {image ? (
                  <img
                    src={image}
                    alt="QR Code Pix gerado pela Meta"
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <WalletCards className="size-8 text-muted-foreground" />
                )}
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Pix da Meta</p>
                <p className="mt-1 text-2xl font-bold">
                  {money(charge.totalCents, charge.currency)}
                </p>
                <Badge className="mt-3" variant="outline">
                  {grew ? "Saldo atualizado" : "Aguardando pagamento na Meta"}
                </Badge>
                <Button
                  className="mt-4 w-full"
                  disabled={grew}
                  onClick={() => {
                    void navigator.clipboard
                      .writeText(charge.pix?.payload ?? "")
                      .then(() => setCopied(true));
                  }}
                >
                  <Copy />
                  {copied ? "Código copiado" : "Copiar código Pix"}
                </Button>
              </div>
            </div>
          )}
          {charge?.notice && <p className="text-sm text-muted-foreground">{charge.notice}</p>}
          {href && !charge?.pix && (
            <Button asChild>
              <a href={href} target="_blank" rel="noopener noreferrer">
                <ExternalLink />
                Abrir adição de saldo
              </a>
            </Button>
          )}
          {grew && (
            <p className="text-sm text-muted-foreground">
              A Meta informou um saldo maior nesta conta:{" "}
              {money(view?.balanceCents ?? null, view?.currency || "BRL")}.
            </p>
          )}
          {charge && (
            <Button type="button" variant="outline" onClick={() => void load()} disabled={loading}>
              <RefreshCw className={loading ? "animate-spin" : ""} />
              Atualizar saldo
            </Button>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
