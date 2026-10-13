import { createFileRoute } from "@tanstack/react-router";
import { LiveTeams } from "@/components/chatbot/LiveTeams";
import { ChatbotFrame } from "@/components/chatbot/frame";

export const Route = createFileRoute("/_authenticated/chatbot/equipes")({
  head: () => ({ meta: [{ title: "Time — NEX" }] }),
  component: () => (
    <ChatbotFrame title="Time" subtitle="Equipes e os canais que cada uma atende.">
      <LiveTeams />
    </ChatbotFrame>
  ),
});
