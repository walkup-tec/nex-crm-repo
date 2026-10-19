import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/cora/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const eventType = request.headers.get("webhook-event-type") ?? "";
        const resourceId = request.headers.get("webhook-resource-id") ?? "";
        if (eventType !== "invoice.paid" || !resourceId.startsWith("inv_")) {
          return Response.json({ success: true });
        }
        try {
          const { applyCoraPaidNotice } = await import("@/server/finance.server");
          await applyCoraPaidNotice(resourceId);
          return Response.json({ success: true });
        } catch (error) {
          console.error("cora_webhook", error instanceof Error ? error.message : "falha");
          return Response.json({ success: false }, { status: 500 });
        }
      },
    },
  },
});
