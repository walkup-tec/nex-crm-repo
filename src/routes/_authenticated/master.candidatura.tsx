import { createFileRoute, redirect } from "@tanstack/react-router";
import { AppShell } from "@/components/nex/AppShell";
import { CareerWorkspace } from "@/components/nex/CareerWorkspace";
import { careerAccessFn } from "@/lib/career.functions";

export const Route = createFileRoute("/_authenticated/master/candidatura")({
  beforeLoad: async ({ context }) => {
    const session = context as { user?: { id: string }; master?: boolean };
    if (!session.user) throw redirect({ to: "/auth" });
    if (!session.master) throw redirect({ to: "/dashboard" });
    const access = await careerAccessFn();
    if (!access.ok || !access.data.allowed) {
      throw redirect({ to: "/master" });
    }
  },
  head: () => ({
    meta: [
      { title: "Candidatura — NEX Ads" },
      {
        name: "description",
        content: "Módulo exclusivo Walkup para prospecção de empresas, vagas e candidaturas via NEX Career Intelligence.",
      },
      { property: "og:title", content: "Candidatura — NEX Ads" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <AppShell
      live
      notes={false}
      master
      title="Candidatura"
      subtitle="NEX Career Intelligence — empresas, vagas, contatos e preparação de candidaturas."
    >
      <CareerWorkspace />
    </AppShell>
  ),
});
