import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/integrations/chatgpt/analyses/$executionId")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const { handleChatgptAnalysisRequest } = await import(
          "@/server/chatgpt-integration.server"
        );
        const executionId =
          params.executionId ||
          new URL(request.url).pathname.split("/").filter(Boolean).at(-1) ||
          "";
        return handleChatgptAnalysisRequest(request, executionId);
      },
    },
  },
});
