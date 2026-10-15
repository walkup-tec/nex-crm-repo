import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/chatbot/produtos")({
  beforeLoad: () => {
    throw redirect({ to: "/chatbot/configuracoes", hash: "produtos" });
  },
});
