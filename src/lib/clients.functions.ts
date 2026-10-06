import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { ClientDraft, ListedClient } from "@/lib/client-access";

type Result<T> = { ok: true; data: T } | { ok: false; message: string };
type SavedClient = { id: string };

function publicMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  console.error(error);
  if (message.includes("SUPABASE_SERVICE_ROLE_KEY")) {
    return "O servidor ainda não tem a chave de administração do Supabase.";
  }
  if (/\$aact|access_token|ASAAS_API_KEY/i.test(message)) {
    return "Não foi possível consultar o Asaas.";
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

export const createClientFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: ClientDraft) => data)
  .handler(async ({ context, data }): Promise<Result<SavedClient>> => {
    const { createClient } = await import("@/server/clients.server");
    return guard(() => createClient(context.userId, data));
  });

export const updateClientFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: ClientDraft & { id: string }) => data)
  .handler(async ({ context, data }): Promise<Result<SavedClient>> => {
    const { updateClient } = await import("@/server/clients.server");
    return guard(() => updateClient(context.userId, data.id, data));
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
  .handler(async ({ context, data }): Promise<Result<{ id: string; legalName: string }>> => {
    const { openClientSupport } = await import("@/server/clients.server");
    return guard(() => openClientSupport(context.userId, data.id));
  });
