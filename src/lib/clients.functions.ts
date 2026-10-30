import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { ClientDraft, ListedClient } from "@/lib/client-access";
import type { MasterDashboard } from "@/lib/master-dashboard";

type Result<T> = { ok: true; data: T } | { ok: false; message: string };
type SavedClient = { id: string };

function publicMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  console.error(error);
  if (message.includes("SUPABASE_SERVICE_ROLE_KEY")) {
    return "O servidor ainda não tem a chave de administração do Supabase.";
  }
  if (/\$aact|access_token|ASAAS_API_KEY|client_secret|CORA_CLIENT/i.test(message)) {
    return "Não foi possível consultar o banco da cobrança.";
  }
  if (/ECONNREFUSED|ETIMEDOUT|ENOTFOUND|ECONNRESET|EAUTH/i.test(message)) {
    return "Não foi possível enviar o e-mail de acesso. O servidor de e-mail recusou a conexão.";
  }
  if (!message || /postgres|PGRST|violates|duplicate key|JWT|fetch failed/i.test(message)) {
    return "Não foi possível concluir. Tente de novo.";
  }
  return message;
}

async function guard<T>(work: () => Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, data: await work() };
  } catch (error) {
    return { ok: false, message: publicMessage(error) };
  }
}

export const listClientsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Result<ListedClient[]>> => {
    const { listClients } = await import("@/server/clients.server");
    return guard(() => listClients(context.userId));
  });

export const masterDashboardFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data?: { period?: string; since?: string; until?: string }) => data ?? {})
  .handler(async ({ context, data }): Promise<Result<MasterDashboard>> => {
    const { masterDashboard } = await import("@/server/clients.server");
    const input: { period?: string; since?: string; until?: string } = {};
    if (data?.period) input.period = data.period;
    if (data?.since) input.since = data.since;
    if (data?.until) input.until = data.until;
    return guard(() => masterDashboard(context.userId, input));
  });

export const createClientFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: ClientDraft) => data)
  .handler(async ({ context, data }): Promise<Result<SavedClient>> => {
    const { createClient } = await import("@/server/clients.server");
    return guard(() => createClient(context.userId, data));
  });

export const updateClientProductsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { id: string; adsMeta: boolean; adsGoogle: boolean }) => ({
    id: data.id.trim(),
    adsMeta: data.adsMeta === true,
    adsGoogle: data.adsGoogle === true,
  }))
  .handler(async ({ context, data }): Promise<Result<SavedClient>> => {
    const { updateClientProducts } = await import("@/server/clients.server");
    return guard(() => updateClientProducts(context.userId, data.id, data));
  });

export const updateClientFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: ClientDraft & { id: string }) => data)
  .handler(async ({ context, data }): Promise<Result<SavedClient>> => {
    const { updateClient } = await import("@/server/clients.server");
    return guard(() => updateClient(context.userId, data.id, data));
  });

export const addClientPromotionFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { id: string; amount: string; startsOn: string; endsOn: string }) => data)
  .handler(async ({ context, data }) => {
    const { addClientPromotion } = await import("@/server/clients.server");
    return guard(() => addClientPromotion(context.userId, data));
  });

export const updateClientPromotionEndFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { id: string; promotionId: string; endsOn: string }) => data)
  .handler(async ({ context, data }) => {
    const { updateClientPromotionEnd } = await import("@/server/clients.server");
    return guard(() => updateClientPromotionEnd(context.userId, data));
  });

export const updateContractEndFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { id: string; endsOn: string }) => data)
  .handler(async ({ context, data }) => {
    const { updateContractEnd } = await import("@/server/clients.server");
    return guard(() => updateContractEnd(context.userId, data));
  });

export const updateContractScheduleFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { id: string; dueDay: string; promoEndsOn: string }) => data)
  .handler(async ({ context, data }) => {
    const { updateContractSchedule } = await import("@/server/clients.server");
    return guard(() => updateContractSchedule(context.userId, data));
  });

export const setClientStatusFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { id: string; active: boolean }) => data)
  .handler(async ({ context, data }): Promise<Result<true>> => {
    const { setClientStatus } = await import("@/server/clients.server");
    return guard(async () => {
      await setClientStatus(context.userId, data.id, data.active);
      return true as const;
    });
  });

export const lookupAsaasSubscriptionFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { email: string }) => data)
  .handler(async ({ context, data }) => {
    const { lookupAsaasSubscription } = await import("@/server/asaas.server");
    return guard(() => lookupAsaasSubscription(context.userId, data.email));
  });

export const openClientSupportFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { id: string }) => data)
  .handler(async ({ context, data }): Promise<Result<{ id: string; legalName: string; displayName: string }>> => {
    const { openClientSupport } = await import("@/server/clients.server");
    return guard(() => openClientSupport(context.userId, data.id));
  });
