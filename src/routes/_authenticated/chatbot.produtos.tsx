import { createFileRoute } from "@tanstack/react-router";
import { LiveProducts } from "@/components/chatbot/LiveProducts";
import { ChatbotFrame } from "@/components/chatbot/frame";

export const Route = createFileRoute("/_authenticated/chatbot/produtos")({
  head: () => ({ meta: [{ title: "Produtos — Chatbot" }] }),
  component: () => (
    <ChatbotFrame title="Produtos" subtitle="Produtos e serviços vinculados aos contatos.">
      <LiveProducts />
    </ChatbotFrame>
  ),
});
