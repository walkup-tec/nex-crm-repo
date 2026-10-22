import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { LiveInbox } from "@/components/chatbot/LiveInbox";

function openedConversation() {
  if (typeof window === "undefined") return "";
  const id = window.location.hash.slice(1);
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) ? id : "";
}

export const Route = createFileRoute("/_authenticated/chatbot/atendimento")({
  ssr: false,
  head: () => ({ meta: [{ title: "Atendimento — NEX" }] }),
  component: function ExpandedInbox() {
    const [conversationId] = useState(openedConversation);
    return (
      <div className="chatbot-app chatbot-expanded">
        <LiveInbox expanded conversationId={conversationId} />
      </div>
    );
  },
});
