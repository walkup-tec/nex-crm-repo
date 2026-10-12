import { createFileRoute } from "@tanstack/react-router";
import { Overview } from "@/components/chatbot/Overview";
import { ChatbotFrame } from "@/components/chatbot/frame";

export const Route = createFileRoute("/_authenticated/chatbot/relatorios")({
  head: () => ({ meta: [{ title: "Relatórios — Chatbot" }] }),
  component: () => (
    <ChatbotFrame title="Relatórios" subtitle="Leitura do atendimento nesta sessão.">
      <Overview reports />
    </ChatbotFrame>
  ),
});
