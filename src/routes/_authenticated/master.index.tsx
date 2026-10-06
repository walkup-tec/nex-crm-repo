import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/nex/AppShell";
import { MasterHome } from "@/components/nex/MasterHome";

export const Route = createFileRoute("/_authenticated/master/")({
  head: () => ({
    meta: [
      { title: "Operação NEX — NEX Ads" },
      { name: "description", content: "Prioridades da operação em uma visão consolidada." },
      { property: "og:title", content: "Operação NEX — NEX Ads" },
      { property: "og:description", content: "Prioridades da operação em uma visão consolidada." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <AppShell live notes={false} title="Operação NEX" subtitle="Prioridades da operação em uma visão consolidada." master>
      <MasterHome />
    </AppShell>
  ),
});
