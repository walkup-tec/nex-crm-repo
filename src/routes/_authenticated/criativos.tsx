import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/nex/AppShell";
import { CreativesLibrary } from "@/components/nex/CreativesLibrary";
export const Route = createFileRoute("/_authenticated/criativos")({
  head: () => ({
    meta: [
      { title: "Criativos — NEX Ads" },
      { name: "description", content: "Navegue e baixe os materiais organizados pela NEX." },
      { property: "og:title", content: "Criativos — NEX Ads" },
      { property: "og:description", content: "Navegue e baixe os materiais organizados pela NEX." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <AppShell
      live
      notes={false}
      title="Criativos"
      subtitle="Navegue e baixe os materiais organizados pela NEX."
    >
      <CreativesLibrary />
    </AppShell>
  ),
});
