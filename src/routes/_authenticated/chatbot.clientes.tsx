import { createFileRoute } from "@tanstack/react-router";
import { Management } from "@/components/chatbot/Management";
import { ChatbotFrame } from "@/components/chatbot/frame";

export const Route = createFileRoute("/_authenticated/chatbot/clientes")({
  head: () => ({ meta: [{ title: "Clientes — Chatbot" }] }),
  component: () => (
    <ChatbotFrame title="Clientes" subtitle="Cadastro dos contatos do atendimento.">
      <Management section="clientes" />
    </ChatbotFrame>
  ),
});
