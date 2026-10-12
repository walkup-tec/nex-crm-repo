import { createFileRoute } from "@tanstack/react-router";
import { Settings } from "@/components/chatbot/Settings";
import { ChatbotFrame } from "@/components/chatbot/frame";

export const Route = createFileRoute("/_authenticated/chatbot/configuracoes")({
  head: () => ({ meta: [{ title: "Configurações — Chatbot" }] }),
  component: () => (
    <ChatbotFrame title="Configurações" subtitle="Preferências do atendimento.">
      <Settings />
    </ChatbotFrame>
  ),
});