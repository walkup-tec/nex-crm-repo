import { createFileRoute } from "@tanstack/react-router";
import { Management } from "@/components/chatbot/Management";
import { ChatbotFrame } from "@/components/chatbot/frame";

export const Route = createFileRoute("/_authenticated/chatbot/whatsapps")({
  head: () => ({ meta: [{ title: "WhatsApps Conectados — Chatbot" }] }),
  component: () => (
    <ChatbotFrame title="WhatsApps Conectados" subtitle="Números preparados para o atendimento.">
      <Management section="whatsapps" />
    </ChatbotFrame>
  ),
});
