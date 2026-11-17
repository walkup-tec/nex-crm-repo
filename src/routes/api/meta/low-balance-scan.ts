import { createFileRoute } from "@tanstack/react-router";

/**
 * Varredura proativa de saldo Meta + WhatsApp.
 * Auth: Bearer META_LOW_BALANCE_CRON_SECRET (ou CHATGPT_INTEGRATION_SECRET).
 * Uso: cron EasyPanel a cada 30–60 min — não depende do cliente abrir a NEX.
 */
export const Route = createFileRoute("/api/meta/low-balance-scan")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { handleMetaLowBalanceScanRequest } = await import("@/server/meta-credit-scan.server");
        return handleMetaLowBalanceScanRequest(request);
      },
      GET: async ({ request }) => {
        const { handleMetaLowBalanceScanRequest } = await import("@/server/meta-credit-scan.server");
        return handleMetaLowBalanceScanRequest(request);
      },
    },
  },
});
