import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/integrations/chatgpt/career/openapi")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { handleChatgptCareerOpenApiRequest } = await import("@/server/chatgpt-career.server");
        return handleChatgptCareerOpenApiRequest(request);
      },
    },
  },
});
