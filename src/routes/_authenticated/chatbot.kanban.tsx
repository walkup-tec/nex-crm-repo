import { createFileRoute } from "@tanstack/react-router";
import { Kanban } from "@/components/chatbot/Kanban";
import { ChatbotFrame } from "@/components/chatbot/frame";

export const Route = createFileRoute("/_authenticated/chatbot/kanban")({
  head: () => ({ meta: [{ title: "Kanban — Chatbot" }] }),
  component: () => (
    <ChatbotFrame title="Kanban" subtitle="Oportunidades do funil de atendimento.">
      <Kanban />
    </ChatbotFrame>
  ),
});
