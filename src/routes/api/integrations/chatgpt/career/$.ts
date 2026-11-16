import { createFileRoute } from "@tanstack/react-router";

/** Catch-all do plugin NEX Career Intelligence sob a infra ChatGPT existente. */
export const Route = createFileRoute("/api/integrations/chatgpt/career/$")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { handleChatgptCareerRequest } = await import("@/server/chatgpt-career.server");
        return handleChatgptCareerRequest(request);
      },
      POST: async ({ request }) => {
        const { handleChatgptCareerRequest } = await import("@/server/chatgpt-career.server");
        return handleChatgptCareerRequest(request);
      },
      PATCH: async ({ request }) => {
        const { handleChatgptCareerRequest } = await import("@/server/chatgpt-career.server");
        return handleChatgptCareerRequest(request);
      },
    },
  },
});
