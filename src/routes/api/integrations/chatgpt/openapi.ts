import { createFileRoute } from "@tanstack/react-router";

/** OpenAPI para Custom GPT / ChatGPT Actions (operationId: get_meta_analysis_execution). */
export const Route = createFileRoute("/api/integrations/chatgpt/openapi")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { handleChatgptOpenApiRequest } = await import(
          "@/server/chatgpt-integration.server"
        );
        return handleChatgptOpenApiRequest(request);
      },
    },
  },
});
