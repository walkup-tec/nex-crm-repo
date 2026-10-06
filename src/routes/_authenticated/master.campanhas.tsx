import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/nex/AppShell";
import { MasterCampaigns } from "@/components/nex/MasterCampaigns";

export const Route = createFileRoute("/_authenticated/master/campanhas")({
  head: () => ({
    meta: [
      { title: "Campanhas globais — NEX Ads" },
      { name: "description", content: "Monitore campanhas de todos os clientes em somente leitura." },
      { property: "og:title", content: "Campanhas globais — NEX Ads" },
      { property: "og:description", content: "Monitore campanhas de todos os clientes em somente leitura." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <AppShell live notes={false} title="Campanhas globais" subtitle="Campanhas lidas da Meta de cada cliente. Nenhuma alteração é enviada para os anúncios." master>
      <MasterCampaigns />
    </AppShell>
  ),
});
