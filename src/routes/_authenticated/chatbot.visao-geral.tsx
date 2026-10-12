import { createFileRoute } from "@tanstack/react-router";
import { Overview } from "@/components/chatbot/Overview";
import { ChatbotFrame } from "@/components/chatbot/frame";

export const Route = createFileRoute("/_authenticated/chatbot/visao-geral")({
  head: () => ({ meta: [{ title: "Visão Geral — Chatbot" }] }),
  component: () => (
    <ChatbotFrame title="Visão Geral" subtitle="Indicadores do atendimento.">
      <Overview />
    </ChatbotFrame>
  ),
});
