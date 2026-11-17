import { createFileRoute } from "@tanstack/react-router";

/** OAuth 2.1 authorize (authorization_code + PKCE S256) — ChatGPT Web → MCP Career. */
export const Route = createFileRoute("/api/integrations/chatgpt/career/oauth/authorize")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { handleChatgptCareerOAuthAuthorize } = await import("@/server/chatgpt-career-oauth.server");
        return handleChatgptCareerOAuthAuthorize(request);
      },
      POST: async ({ request }) => {
        const { handleChatgptCareerOAuthAuthorize } = await import("@/server/chatgpt-career-oauth.server");
        return handleChatgptCareerOAuthAuthorize(request);
      },
    },
  },
});
