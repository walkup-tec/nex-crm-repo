import { createFileRoute } from "@tanstack/react-router";
import { Automations } from "@/components/chatbot/Automations";
import { ChatbotFrame } from "@/components/chatbot/frame";

export const Route = createFileRoute("/_authenticated/chatbot/automacoes")({
  head: () => ({ meta: [{ title: "Automações — Chatbot" }] }),
  component: () => (
    <ChatbotFrame title="Automações" subtitle="Fluxos preparados para o atendimento.">
      <Automations />
    </ChatbotFrame>
  ),
});
