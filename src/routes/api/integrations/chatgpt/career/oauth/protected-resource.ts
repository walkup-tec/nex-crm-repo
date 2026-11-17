import { createFileRoute } from "@tanstack/react-router";

/** Alias PRM (além de /.well-known/oauth-protected-resource). */
export const Route = createFileRoute("/api/integrations/chatgpt/career/oauth/protected-resource")({
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
