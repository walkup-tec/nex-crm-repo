import { createFileRoute } from "@tanstack/react-router";
import { CalendarMeetings } from "@/components/chatbot/CalendarMeetings";
import { ChatbotFrame } from "@/components/chatbot/frame";

export const Route = createFileRoute("/_authenticated/chatbot/agendamentos")({
  head: () => ({ meta: [{ title: "Agendamentos — NEX" }] }),
  component: () => (
    <ChatbotFrame title="Agendamentos" subtitle="Reuniões do Google Calendar com seus clientes.">
      <CalendarMeetings />
    </ChatbotFrame>
  ),
});
