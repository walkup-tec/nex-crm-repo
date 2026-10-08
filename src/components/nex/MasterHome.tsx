import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { dateBr, moneyFromCents } from "@/lib/client-access";
import { masterDashboardFn } from "@/lib/clients.functions";
import type { MasterDashboard } from "@/lib/master-dashboard";

export function MasterHome() {
  const [snapshot, setSnapshot] = useState<MasterDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const result = await masterDashboardFn();
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

  const openClient = (id: string) => {
    void navigate({ to: "/master/financeiro/$orgId", params: { orgId: id } });
  };

  return (
    <div className="space-y-5">
      {loading && <p className="text-sm text-muted-foreground">Consultando clientes e cobranças...</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}
      {snapshot && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric label="Clientes ativos" value={String(snapshot.activeClients)} />
            <Metric label="Em atraso" value={String(snapshot.overdueClients)} />
            <Metric label="Bloqueados" value={String(snapshot.blockedClients)} />
            <Metric label="A receber" value={moneyFromCents(snapshot.receivableCents)} />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Atenção operacional</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {snapshot.attention.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum cliente precisa de atenção agora.</p>
                ) : (
                  snapshot.attention.map((item) => (
                    <div key={item.id} className="flex items-center gap-3 rounded-lg border p-3">
                      <span className={`size-2 rounded-full ${item.detail === "Mensalidade em atraso" || item.detail === "Bloqueado" || item.detail === "Saldo Meta baixo" ? "bg-destructive" : "bg-warning"}`} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{item.name}</p>
                        <p className="text-xs text-muted-foreground">{item.detail}</p>
                      </div>
                      {item.amountCents != null && <strong className="text-sm">{moneyFromCents(item.amountCents)}</strong>}
                      <Button variant="ghost" size="sm" onClick={() => openClient(item.id)}>
                        Ver
                      </Button>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Contratos próximos do fim</CardTitle>
              </CardHeader>
              <CardContent>
                {snapshot.endingContracts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum contrato encerra nos próximos 60 dias.</p>
                ) : (
                  snapshot.endingContracts.map((item) => (
                    <div key={item.id} className="flex items-center justify-between gap-3 border-b py-3 last:border-0">
                      <div>
                        <p className="text-sm font-medium">{item.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.daysLeft === 0 ? "Encerra hoje" : `Encerra em ${item.daysLeft} dias`} • {dateBr(item.endsOn)}
                        </p>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => openClient(item.id)}>
                        Ver
                      </Button>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Summary label="Saldo baixo" value={snapshot.criticalBalances === 1 ? "1 cliente" : `${snapshot.criticalBalances} clientes`} tone={snapshot.criticalBalances === 0 ? "text-foreground" : "text-destructive"} />
            <Summary label="Mensalidades vencidas" value={moneyFromCents(snapshot.overdueCents)} tone={snapshot.overdueCents === 0 ? "text-foreground" : "text-warning"} />
            <Summary label="Sincronização Meta" value={snapshot.metaPending === 0 ? "Em dia" : snapshot.metaPending === 1 ? "1 conta sem atualização" : `${snapshot.metaPending} contas sem atualização`} tone={snapshot.metaPending === 0 ? "text-success" : "text-info"} />
          </div>
        </>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-sm text-muted-foreground">{label}</p>
        <strong className="mt-3 block font-display text-2xl sm:text-3xl">{value}</strong>
      </CardContent>
    </Card>
  );
}

function Summary({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-sm text-muted-foreground">{label}</p>
        <strong className={`mt-2 block text-xl ${tone}`}>{value}</strong>
      </CardContent>
    </Card>
  );
}
