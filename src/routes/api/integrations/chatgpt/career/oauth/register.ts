import { createFileRoute } from "@tanstack/react-router";

/** Dynamic Client Registration mínimo (RFC 7591) para ChatGPT Web. */
export const Route = createFileRoute("/api/integrations/chatgpt/career/oauth/register")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { handleChatgptCareerOAuthRegister } = await import("@/server/chatgpt-career-oauth.server");
        return handleChatgptCareerOAuthRegister(request);
      },
    },
  },
});
