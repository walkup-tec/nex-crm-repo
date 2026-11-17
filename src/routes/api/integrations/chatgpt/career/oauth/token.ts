import { createFileRoute } from "@tanstack/react-router";

/** OAuth token (authorization_code + PKCE S256) — ChatGPT Web → MCP Career. */
export const Route = createFileRoute("/api/integrations/chatgpt/career/oauth/token")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { handleChatgptCareerOAuthToken } = await import("@/server/chatgpt-career-oauth.server");
        return handleChatgptCareerOAuthToken(request);
      },
    },
  },
});
