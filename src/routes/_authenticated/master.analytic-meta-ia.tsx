import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/nex/AppShell";
import { MasterMetaAnalytics } from "@/components/nex/MasterMetaAnalytics";

export const Route = createFileRoute("/_authenticated/master/analytic-meta-ia")({
  head: () => ({
    meta: [
      { title: "META IA Analytics — NEX Ads" },
      {
        name: "description",
        content: "Laboratório Master para analisar Meta Ads com IA e calibrar o protocolo.",
      },
      { property: "og:title", content: "META IA Analytics — NEX Ads" },
      {
        property: "og:description",
        content: "Laboratório Master para analisar Meta Ads com IA e calibrar o protocolo.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <AppShell
      live
      notes={false}
      master
      title="META IA Analytics"
      subtitle="NEX Intelligence — execute, registre, avalie e exporte pacotes de calibração."
    >
      <MasterMetaAnalytics />
    </AppShell>
  ),
});
