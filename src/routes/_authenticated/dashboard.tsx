import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/nex/AppShell";
import { MetaPerformance } from "@/components/nex/MetaPerformance";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Visão geral — NEX Ads" },
      { name: "description", content: "Indicadores das campanhas lidos da conta de anúncio na Meta." },
      { property: "og:title", content: "Visão geral — NEX Ads" },
      { property: "og:description", content: "Indicadores das campanhas lidos da conta de anúncio na Meta." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <AppShell
      live
      title="Visão geral"
      subtitle="Indicadores lidos da conta de anúncio autorizada na Meta."
    >
      <MetaPerformance mode="overview" />
    </AppShell>
  ),
});
