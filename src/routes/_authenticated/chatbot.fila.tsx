import { createFileRoute } from "@tanstack/react-router";
import { Management } from "@/components/chatbot/Management";
import { ChatbotFrame } from "@/components/chatbot/frame";

export const Route = createFileRoute("/_authenticated/chatbot/fila")({
  head: () => ({ meta: [{ title: "Fila — Chatbot" }] }),
  component: () => (
    <ChatbotFrame title="Fila" subtitle="Conversas aguardando um atendente.">
      <Management section="fila" />
    </ChatbotFrame>
  ),
});
