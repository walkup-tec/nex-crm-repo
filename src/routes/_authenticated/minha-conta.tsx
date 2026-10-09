import { createFileRoute } from "@tanstack/react-router";
import { AccountSettings } from "@/components/nex/AccountSettings";
import { AppShell } from "@/components/nex/AppShell";

export const Route = createFileRoute("/_authenticated/minha-conta")({
  head: () => ({
    meta: [
      { title: "Minha conta — NEX Ads" },
      { name: "description", content: "Dados da conta que está logada." },
      { property: "og:title", content: "Minha conta — NEX Ads" },
      { property: "og:description", content: "Dados da conta que está logada." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <AppShell live notes={false} title="Minha conta" subtitle="Dados da conta que está logada.">
      <AccountSettings />
    </AppShell>
  ),
});
