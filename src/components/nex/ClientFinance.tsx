import { useCallback, useEffect, useState } from "react";
import { Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { dateBr, invoiceStatusLabel, moneyFromCents } from "@/lib/client-access";
import { competenceLabel, type OwnFinance } from "@/lib/finance-access";
import { listOwnFinanceFn } from "@/lib/finance.functions";

const financeSteps = ["Contrato", "Cobranças", "Faturas"] as const;

function FinanceLoading() {
  return (
    <div className="rounded-lg border bg-card px-3 py-5 sm:px-5" role="status" aria-live="polite">
      <h2 className="font-display text-lg font-semibold">Histórico financeiro</h2>
      <div className="mt-4 flex items-center" aria-hidden>
        {financeSteps.map((label, index) => (
          <div
            key={label}
            className={index === 0 ? "flex items-center" : "flex min-w-0 flex-1 items-center"}
          >
            {index > 0 && (
              <span className="relative mx-1 h-0.5 min-w-1 flex-1 overflow-hidden rounded-full bg-muted sm:mx-2 sm:min-w-3">
                <span
                  className="absolute inset-y-0 left-0 w-2/5 rounded-full bg-nex-gradient animate-meta-link"
                  style={{ animationDelay: `${index * 0.55}s` }}
                />
              </span>
            )}
            <span
              className="shrink-0 rounded-full border border-border px-2 py-1 text-[11px] font-medium text-muted-foreground animate-meta-node sm:px-2.5 sm:text-xs"
              style={{ animationDelay: `${index * 0.55}s` }}
            >
              {label}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-sm text-muted-foreground">Consultando as faturas...</p>
    </div>
  );
}

function FinancePayButton({ href, paid }: { href: string | null; paid: boolean }) {
  if (paid) {
    if (!href) {
      return (
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0"
          disabled
          aria-label="Documento indisponível"
        >
          <Download />
        </Button>
      );
    }
    return (
      <Button variant="ghost" size="icon" className="shrink-0" asChild>
        <a href={href} target="_blank" rel="noreferrer" aria-label="Baixar documento">
          <Download />
        </a>
      </Button>
    );
  }
  if (!href) {
    return (
      <Button size="sm" className="w-fit shrink-0" disabled>
        Pagar
      </Button>
    );
  }
  return (
    <Button size="sm" className="w-fit shrink-0" asChild>
      <a href={href} target="_blank" rel="noreferrer">
        Pagar
      </a>
    </Button>
  );
}

export function ClientFinance() {
  const [snapshot, setSnapshot] = useState<OwnFinance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const result = await listOwnFinanceFn();
    setLoading(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setSnapshot(result.data);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-5">
      {loading && <FinanceLoading />}
      {error && <p className="text-sm text-destructive">{error}</p>}
      {snapshot?.notice && <p className="text-sm text-muted-foreground">{snapshot.notice}</p>}
      {snapshot && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardContent className="p-5">
                <p className="text-sm text-muted-foreground">Próxima mensalidade</p>
                <strong className="mt-2 block text-2xl">{snapshot.nextCents == null ? "—" : moneyFromCents(snapshot.nextCents)}</strong>
                <p className="mt-1 text-xs text-muted-foreground">{snapshot.nextDue ? `Vencimento em ${dateBr(snapshot.nextDue)}` : "Sem cobrança em aberto"}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <p className="text-sm text-muted-foreground">Situação atual</p>
                <div className="mt-3">
                  <Badge variant={snapshot.situation === "Em atraso" ? "destructive" : "outline"}>{snapshot.situation}</Badge>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <p className="text-sm text-muted-foreground">Contrato</p>
                <strong className="mt-2 block">{snapshot.startsOn ? `${dateBr(snapshot.startsOn)} — ${dateBr(snapshot.endsOn)}` : "Contrato não cadastrado"}</strong>
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Histórico financeiro</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {snapshot.charges.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma cobrança gravada.</p>
              ) : (
                snapshot.charges.map((item) => (
                  <div key={item.id} className="flex flex-col gap-3 border-b py-4 last:border-0 sm:flex-row sm:items-center">
                    <div className="flex-1">
                      <p className="font-medium">{competenceLabel(item.competence)}</p>
                      <p className="text-xs text-muted-foreground">
                        Vencimento {dateBr(item.dueDate)}
                        {item.paidAt ? ` • pago em ${dateBr(item.paidAt)}` : ""}
                      </p>
                    </div>
                    <strong>{moneyFromCents(item.totalCents)}</strong>
                    <Badge variant="outline">{invoiceStatusLabel(item.status)}</Badge>
                    <FinancePayButton href={item.invoiceUrl} paid={item.status === "paid"} />
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
