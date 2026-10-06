import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/nex/AppShell";
import { ClientsAdmin } from "@/components/nex/ClientsAdmin";

export const Route = createFileRoute("/_authenticated/master/clientes")({
  head: () => ({
    meta: [
      { title: "Clientes — NEX Ads" },
      { name: "description", content: "Gerencie contratos, acessos e situação de cada cliente." },
      { property: "og:title", content: "Clientes — NEX Ads" },
      { property: "og:description", content: "Gerencie contratos, acessos e situação de cada cliente." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <AppShell live notes={false} title="Clientes" subtitle="Gerencie contratos, acessos e situação de cada cliente." master>
      <ClientsAdmin />
    </AppShell>
  ),
});
