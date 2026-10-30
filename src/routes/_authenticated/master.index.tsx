import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/nex/AppShell";
import { MasterHome } from "@/components/nex/MasterHome";

export const Route = createFileRoute("/_authenticated/master/")({
  head: () => ({
    meta: [
      { title: "Dashboard Financeiro — NEX Ads" },
      { name: "description", content: "Visão geral da operação com clientes, receitas e vencimentos." },
      { property: "og:title", content: "Dashboard Financeiro — NEX Ads" },
      { property: "og:description", content: "Visão geral da operação com clientes, receitas e vencimentos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <AppShell
      live
      notes={false}
      title="Dashboard Financeiro"
      subtitle="Visão geral da sua operação com clientes, receitas e vencimentos."
      master
    >
      <MasterHome />
    </AppShell>
  ),
});
