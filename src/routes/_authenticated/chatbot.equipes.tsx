import { createFileRoute } from "@tanstack/react-router";
import { Management } from "@/components/chatbot/Management";
import { ChatbotFrame } from "@/components/chatbot/frame";

export const Route = createFileRoute("/_authenticated/chatbot/equipes")({
  head: () => ({ meta: [{ title: "Equipes e Atendentes — Chatbot" }] }),
  component: () => (
    <ChatbotFrame title="Equipes e Atendentes" subtitle="Quem atende as conversas.">
      <Management section="equipes" />
    </ChatbotFrame>
  ),
});
