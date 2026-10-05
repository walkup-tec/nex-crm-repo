import { createFileRoute } from "@tanstack/react-router";
import { UsersAdmin } from "@/components/nex/UsersAdmin";

export const Route = createFileRoute("/_authenticated/usuarios")({
  head: () => ({
    meta: [
      { title: "Usuários — NEX Ads" },
      { name: "description", content: "Crie e administre os acessos da conta." },
      { property: "og:title", content: "Usuários — NEX Ads" },
      { property: "og:description", content: "Crie e administre os acessos da conta." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: UsersAdmin,
});
