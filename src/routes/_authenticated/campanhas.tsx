import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/nex/AppShell";
import { MetaPerformance } from "@/components/nex/MetaPerformance";

export const Route = createFileRoute("/_authenticated/campanhas")({
  head: () => ({
    meta: [
      { title: "Campanhas — NEX Ads" },
      { name: "description", content: "Campanhas lidas da Meta, em modo somente leitura." },
      { property: "og:title", content: "Campanhas — NEX Ads" },
      { property: "og:description", content: "Campanhas lidas da Meta, em modo somente leitura." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <AppShell live title="Campanhas" subtitle="Campanhas lidas da Meta. Nenhuma alteração é enviada para os anúncios.">
      <MetaPerformance mode="campaigns" />
    </AppShell>
  ),
});
