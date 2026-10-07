import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/nex/AppShell";
import { MetaCredits } from "@/components/nex/MetaCredits";

export const Route = createFileRoute("/_authenticated/creditos-meta")({
  head: () => ({
    meta: [
      { title: "Créditos Meta — NEX Ads" },
      {
        name: "description",
        content: "Entre com o Facebook e abra a adição de saldo da conta integrada.",
      },
      { property: "og:title", content: "Créditos Meta — NEX Ads" },
      {
        property: "og:description",
        content: "Entre com o Facebook e abra a adição de saldo da conta integrada.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <AppShell
      live
      title="Créditos Meta"
      subtitle="Entre com o Facebook e abra a adição de saldo da conta integrada."
    >
      <MetaCredits />
    </AppShell>
  ),
});
