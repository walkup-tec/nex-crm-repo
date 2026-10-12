import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/chatbot/evo")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { ingestEvolutionWebhook } = await import("@/server/chatbot.server");
        return ingestEvolutionWebhook(request);
      },
    },
  },
});
