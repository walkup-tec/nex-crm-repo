import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/nex/AppShell";
import { MasterMetaAnalytics } from "@/components/nex/MasterMetaAnalytics";

export const Route = createFileRoute("/_authenticated/master/analytic-meta-ia")({
  head: () => ({
    meta: [
      { title: "Lab. Calibração IA — NEX Ads" },
      {
        name: "description",
        content: "Laboratório Master para analisar Meta Ads com IA e calibrar o protocolo.",
      },
      { property: "og:title", content: "Lab. Calibração IA — NEX Ads" },
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
      title="Lab. Calibração IA"
      subtitle="NEX Intelligence — execute, registre, avalie e exporte pacotes de calibração."
    >
      <MasterMetaAnalytics />
    </AppShell>
  ),
});
