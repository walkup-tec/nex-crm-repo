import { createFileRoute } from "@tanstack/react-router";
import { LiveInbox } from "@/components/chatbot/LiveInbox";
import { ChatbotFrame } from "@/components/chatbot/frame";

function inboxSearch(search: Record<string, unknown>) {
  const conversa = typeof search.conversa === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(search.conversa) ? search.conversa : "";
  const expandir = search.expandir === true || search.expandir === 1 || search.expandir === "1" || search.expandir === "true";
  return { expandir, conversa };
}

export const Route = createFileRoute("/_authenticated/chatbot/")({
  validateSearch: inboxSearch,
  head: () => ({ meta: [{ title: "Caixa de Entrada — NEX" }] }),
  component: function InboxPage() {
    const { expandir, conversa } = Route.useSearch();
    if (expandir) {
      return (
        <div className="chatbot-app chatbot-expanded">
          <LiveInbox expanded conversationId={conversa} />
        </div>
      );
    }
    return (
      <ChatbotFrame title="Caixa de Entrada" subtitle="Conversas do atendimento.">
        <LiveInbox />
      </ChatbotFrame>
    );
  },
});
