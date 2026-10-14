import { createFileRoute } from "@tanstack/react-router";
import { LiveClients } from "@/components/chatbot/LiveClients";
import { ChatbotFrame } from "@/components/chatbot/frame";

export const Route = createFileRoute("/_authenticated/chatbot/clientes")({
  head: () => ({ meta: [{ title: "Clientes — Chatbot" }] }),
  component: () => (
    <ChatbotFrame title="Clientes" subtitle="Clientes cadastrados a partir do atendimento.">
      <LiveClients />
    </ChatbotFrame>
  ),
});
