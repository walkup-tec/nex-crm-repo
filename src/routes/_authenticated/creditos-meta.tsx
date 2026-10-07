import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/nex/AppShell";
import { MetaCredits } from "@/components/nex/MetaCredits";

export const Route = createFileRoute("/_authenticated/creditos-meta")({
  head: () => ({
    meta: [
      { title: "Créditos Meta — NEX Ads" },
      {
        name: "description",
        content:
          "Adicione saldo Pix na conta de anúncio integrada. O QR Code é o que a Meta gerar.",
      },
      { property: "og:title", content: "Créditos Meta — NEX Ads" },
      {
        property: "og:description",
        content:
          "Adicione saldo Pix na conta de anúncio integrada. O QR Code é o que a Meta gerar.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <AppShell
      live
      title="Créditos Meta"
      subtitle="Adicione saldo Pix na conta de anúncio integrada."
    >
      <MetaCredits />
    </AppShell>
  ),
});
