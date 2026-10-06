import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, UserRoundCog } from "lucide-react";
import { AppShell } from "@/components/nex/AppShell";
import { MetaPerformance } from "@/components/nex/MetaPerformance";
import { Button } from "@/components/ui/button";
import { openClientSupportFn } from "@/lib/clients.functions";

export const Route = createFileRoute("/_authenticated/master/suporte/$orgId")({
  head: () => ({
    meta: [
      { title: "Modo suporte — NEX Ads" },
      { name: "description", content: "Visualização auditada do ambiente de um cliente." },
    ],
  }),
  component: SupportPage,
});

function SupportPage() {
  const { orgId } = Route.useParams();
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void openClientSupportFn({ data: { id: orgId } }).then((result) => {
      if (!active) return;
      if (!result.ok) setError(result.message);
      else setName(result.data.legalName);
    });
    return () => {
      active = false;
    };
  }, [orgId]);

  return (
    <AppShell live notes={false} master title="Modo suporte" subtitle="Visualização auditada do ambiente de um cliente.">
      <div className="mb-5 flex flex-col gap-3 rounded-lg border border-info/30 bg-info/10 p-4 sm:flex-row sm:items-center">
        <UserRoundCog className="size-5 text-info" />
        <div className="flex-1">
          <p className="font-semibold">{name ? `Visualizando como ${name}` : "Abrindo o cliente"}</p>
          <p className="text-sm text-muted-foreground">O acesso do Master permanece o seu. A entrada fica registrada na auditoria.</p>
        </div>
        <Button variant="outline" asChild>
          <Link to="/master/clientes">
            <ArrowLeft />
            Voltar aos clientes
          </Link>
        </Button>
      </div>
      {error && <p className="mb-4 text-sm text-destructive">{error}</p>}
      <MetaPerformance mode="overview" organizationId={orgId} />
    </AppShell>
  );
}
