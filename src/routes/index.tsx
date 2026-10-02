import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ to: "/auth" });
  },
  head: () => ({
    meta: [
      { title: "NEX Ads — Performance e gestão" },
      { name: "description", content: "Portal de performance de mídia e gestão de anúncios da NEX Marketing Digital." },
      { property: "og:title", content: "NEX Ads — Performance e gestão" },
      { property: "og:description", content: "Portal de performance de mídia e gestão de anúncios da NEX Marketing Digital." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => null,
});
