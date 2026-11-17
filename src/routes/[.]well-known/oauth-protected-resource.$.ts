import { createFileRoute } from "@tanstack/react-router";

/**
 * RFC 9728 path-aware PRM:
 * /.well-known/oauth-protected-resource/api/integrations/chatgpt/career/mcp
 */
export const Route = createFileRoute("/.well-known/oauth-protected-resource/$")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { handleCareerProtectedResourceMetadata } = await import(
          "@/server/chatgpt-career-oauth.server"
        );
        return handleCareerProtectedResourceMetadata(request);
      },
    },
  },
});
