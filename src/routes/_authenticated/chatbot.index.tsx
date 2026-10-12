import { createFileRoute } from "@tanstack/react-router";
import { LiveInbox } from "@/components/chatbot/LiveInbox";
import { ChatbotFrame } from "@/components/chatbot/frame";

export const Route = createFileRoute("/_authenticated/chatbot/")({
  head: () => ({ meta: [{ title: "Caixa de Entrada — NEX" }] }),
  component: () => (
    <ChatbotFrame title="Caixa de Entrada" subtitle="Conversas do atendimento.">
      <LiveInbox />
    </ChatbotFrame>
  ),
});
