import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/autentique/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const raw = await request.text();
        const signature = request.headers.get("x-autentique-signature") ?? "";
        try {
          const { applyAutentiqueWebhook } = await import("@/server/autentique.server");
          await applyAutentiqueWebhook(raw, signature);
          return Response.json({ success: true });
        } catch (error) {
          console.error("autentique_webhook", error instanceof Error ? error.message : "falha");
          return Response.json({ success: false }, { status: 500 });
        }
      },
    },
  },
});
