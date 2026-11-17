import { createFileRoute } from "@tanstack/react-router";

/** MCP Streamable HTTP — NEX Career Intelligence (Bearer CHATGPT_INTEGRATION_SECRET). */
export const Route = createFileRoute("/api/integrations/chatgpt/career/mcp")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { handleChatgptCareerMcpRequest } = await import("@/server/chatgpt-career-mcp.server");
        return handleChatgptCareerMcpRequest(request);
      },
      POST: async ({ request }) => {
        const { handleChatgptCareerMcpRequest } = await import("@/server/chatgpt-career-mcp.server");
        return handleChatgptCareerMcpRequest(request);
      },
      DELETE: async ({ request }) => {
        const { handleChatgptCareerMcpRequest } = await import("@/server/chatgpt-career-mcp.server");
        return handleChatgptCareerMcpRequest(request);
      },
    },
  },
});
