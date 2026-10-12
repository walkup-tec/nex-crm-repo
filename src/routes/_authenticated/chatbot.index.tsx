import { createFileRoute } from "@tanstack/react-router";
import { Inbox } from "@/components/chatbot/Inbox";
import { ChatbotFrame } from "@/components/chatbot/frame";

export const Route = createFileRoute("/_authenticated/chatbot/")({
  head: () => ({ meta: [{ title: "Caixa de Entrada — NEX" }] }),
  component: () => (
    <ChatbotFrame title="Caixa de Entrada" subtitle="Conversas do atendimento.">
      <Inbox />
    </ChatbotFrame>
  ),
});
