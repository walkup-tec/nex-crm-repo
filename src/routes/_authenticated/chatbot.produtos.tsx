import { createFileRoute } from "@tanstack/react-router";
import { Management } from "@/components/chatbot/Management";
import { ChatbotFrame } from "@/components/chatbot/frame";

export const Route = createFileRoute("/_authenticated/chatbot/produtos")({
  head: () => ({ meta: [{ title: "Produtos — Chatbot" }] }),
  component: () => (
    <ChatbotFrame title="Produtos" subtitle="Itens usados nas oportunidades.">
      <Management section="produtos" />
    </ChatbotFrame>
  ),
});
