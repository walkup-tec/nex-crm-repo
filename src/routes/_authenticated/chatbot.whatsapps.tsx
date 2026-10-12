import { createFileRoute } from "@tanstack/react-router";
import { Management } from "@/components/chatbot/Management";
import { ChatbotFrame } from "@/components/chatbot/frame";

export const Route = createFileRoute("/_authenticated/chatbot/whatsapps")({
  head: () => ({ meta: [{ title: "Conexão — Chatbot" }] }),
  component: () => (
    <ChatbotFrame title="Conexão" subtitle="Números preparados para o atendimento.">
      <Management section="whatsapps" />
    </ChatbotFrame>
  ),
});
