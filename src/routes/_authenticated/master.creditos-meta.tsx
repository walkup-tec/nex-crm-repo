import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/nex/AppShell";
import { MasterMetaCredits } from "@/components/nex/MasterMetaCredits";

export const Route = createFileRoute("/_authenticated/master/creditos-meta")({
  head: () => ({
    meta: [
      { title: "Créditos Meta — NEX Ads" },
      {
        name: "description",
        content: "Visão geral dos créditos das contas de anúncio vinculadas.",
      },
      { property: "og:title", content: "Créditos Meta — NEX Ads" },
      {
        property: "og:description",
        content: "Visão geral dos créditos das contas de anúncio vinculadas.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <AppShell
      live
      notes={false}
      title="Créditos Meta"
      subtitle="Visão geral dos créditos das contas de anúncio vinculadas."
      master
    >
      <MasterMetaCredits />
    </AppShell>
  ),
});
