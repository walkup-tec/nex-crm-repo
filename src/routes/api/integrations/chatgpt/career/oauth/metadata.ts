import { createFileRoute } from "@tanstack/react-router";

/** Compat: AS metadata também em /oauth/metadata (além de /.well-known/oauth-authorization-server). */
export const Route = createFileRoute("/api/integrations/chatgpt/career/oauth/metadata")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { handleChatgptCareerOAuthMetadata } = await import("@/server/chatgpt-career-oauth.server");
        return handleChatgptCareerOAuthMetadata(request);
      },
    },
  },
});
