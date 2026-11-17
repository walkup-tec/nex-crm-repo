import { createFileRoute } from "@tanstack/react-router";

/** RFC 8414 — Authorization Server Metadata do Career MCP. */
export const Route = createFileRoute("/.well-known/oauth-authorization-server")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { handleCareerAuthorizationServerMetadata } = await import(
          "@/server/chatgpt-career-oauth.server"
        );
        return handleCareerAuthorizationServerMetadata(request);
      },
    },
  },
});
