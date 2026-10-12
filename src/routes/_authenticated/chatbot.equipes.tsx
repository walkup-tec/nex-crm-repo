import { createFileRoute } from "@tanstack/react-router";
import { Management } from "@/components/chatbot/Management";
import { ChatbotFrame } from "@/components/chatbot/frame";

export const Route = createFileRoute("/_authenticated/chatbot/equipes")({
  head: () => ({ meta: [{ title: "Time — Chatbot" }] }),
  component: () => (
    <ChatbotFrame title="Time" subtitle="Quem atende as conversas.">
      <Management section="equipes" />
    </ChatbotFrame>
  ),
});
