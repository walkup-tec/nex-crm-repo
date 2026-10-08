import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { dateBr, invoiceStatusLabel, moneyFromCents } from "@/lib/client-access";
import { competenceLabel, type OwnFinance } from "@/lib/finance-access";
import { listOwnFinanceFn } from "@/lib/finance.functions";

function FinancePayButton({ href }: { href: string | null }) {
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
      {loading && <p className="text-sm text-muted-foreground">Consultando o financeiro...</p>}
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
                    <FinancePayButton href={item.invoiceUrl} />
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
