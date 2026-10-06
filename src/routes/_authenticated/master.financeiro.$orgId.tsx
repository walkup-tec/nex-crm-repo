import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/nex/AppShell";
import { Button } from "@/components/ui/button";
import { dateBr, invoiceStatusLabel, moneyFromCents, percentBr, type ListedClient } from "@/lib/client-access";
import { listClientsFn } from "@/lib/clients.functions";
import { syncFinanceFn } from "@/lib/finance.functions";

export const Route = createFileRoute("/_authenticated/master/financeiro/$orgId")({
  head: () => ({
    meta: [
      { title: "Financeiro do cliente — NEX Ads" },
      { name: "description", content: "Contrato e cobranças gravados deste cliente." },
    ],
  }),
  component: FinancePage,
});

function FinancePage() {
  const { orgId } = Route.useParams();
  const [client, setClient] = useState<ListedClient | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void (async () => {
      const synced = await syncFinanceFn({ data: { organizationId: orgId } });
      const result = await listClientsFn();
      if (!active) return;
      setLoading(false);
      if (!synced.ok) setNotice(synced.message);
      else if (synced.data) setNotice(synced.data);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setClient(result.data.find((item) => item.id === orgId) ?? null);
    })();
    return () => {
      active = false;
    };
  }, [orgId]);

  return (
    <AppShell live notes={false} master title={client ? `Financeiro · ${client.legalName}` : "Financeiro do cliente"} subtitle="Contrato e cobranças gravados. Nenhuma cobrança é inventada.">
      <div className="mb-5">
        <Button variant="outline" asChild>
          <Link to="/master/clientes">
            <ArrowLeft />
            Voltar aos clientes
          </Link>
        </Button>
      </div>
      {loading && <p className="text-sm text-muted-foreground">Consultando o financeiro...</p>}
      {notice && <p className="mb-3 text-sm text-muted-foreground">{notice}</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}
      {!loading && !error && !client && <p className="text-sm text-muted-foreground">Cliente não encontrado.</p>}
      {client && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Info label="Mensalidade" value={client.monthlyFeeCents == null ? "Contrato não cadastrado" : moneyFromCents(client.monthlyFeeCents)} />
            <Info label="Vencimento" value={client.dueDay == null ? "—" : `Todo dia ${client.dueDay}`} />
            <Info label="Vigência" value={client.startsOn ? `${dateBr(client.startsOn)} até ${dateBr(client.endsOn)}` : "—"} />
            <Info label="Multa e juros" value={client.finePercent == null ? "—" : `${percentBr(client.finePercent)} · ${percentBr(client.interestPercent ?? 0)}`} />
          </div>
          <div className="rounded-lg border">
            <div className="border-b px-4 py-3">
              <p className="font-semibold">Cobranças</p>
              <p className="text-sm text-muted-foreground">Cobranças trazidas da assinatura deste cliente no Asaas.</p>
            </div>
            {client.invoices.length === 0 ? (
              <p className="px-4 py-8 text-sm text-muted-foreground">Nenhuma cobrança deste cliente.</p>
            ) : (
              <ul className="divide-y">
                {client.invoices.map((invoice) => (
                  <li key={`${invoice.competence}-${invoice.dueDate}`} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-medium">{dateBr(invoice.competence)}</p>
                      <p className="text-xs text-muted-foreground">Vence em {dateBr(invoice.dueDate)}</p>
                    </div>
                    <div className="text-left sm:text-right">
                      <p className="font-semibold">{moneyFromCents(invoice.totalCents)}</p>
                      <p className="text-xs text-muted-foreground">{invoiceStatusLabel(invoice.status)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </AppShell>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}
