import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { MetaConnectionView } from "@/lib/meta-access";

type Result<T> = { ok: true; data: T } | { ok: false; message: string };

function publicMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  console.error("meta_action", /access_token|client_secret|EAA[A-Za-z0-9]/.test(message) ? "redacted" : message);
  if (/access_token|client_secret|EAA[A-Za-z0-9]/.test(message)) return "Não foi possível concluir a conexão com a Meta.";
  if (message.includes("SUPABASE_SERVICE_ROLE_KEY")) return "O servidor ainda não tem a chave de administração do Supabase.";
  if (message.includes("migração da conexão Meta")) return message;
  if (!message || /postgres|PGRST|violates|duplicate key|JWT|fetch failed/i.test(message)) {
    return "Não foi possível concluir a conexão com a Meta.";
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

export const startMetaConnectFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { organizationId: string }) => data)
  .handler(async ({ context, data }) => {
    const { startMetaConnect } = await import("@/server/meta.server");
    return guard(() => startMetaConnect(context.userId, data.organizationId));
  });

export const completeMetaOAuthFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { code?: string; state?: string; error?: string; errorReason?: string }) => data)
  .handler(async ({ context, data }) => {
    const { completeMetaOAuth } = await import("@/server/meta.server");
    return guard(() => completeMetaOAuth(context.userId, data));
  });

export const getMetaConnectionFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { organizationId: string }) => data)
  .handler(async ({ context, data }): Promise<Result<MetaConnectionView>> => {
    const { getMetaConnection } = await import("@/server/meta.server");
    return guard(() => getMetaConnection(context.userId, data.organizationId));
  });

export const syncMetaAccountsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { organizationId: string }) => data)
  .handler(async ({ context, data }): Promise<Result<MetaConnectionView>> => {
    const { syncMetaAccounts } = await import("@/server/meta.server");
    return guard(() => syncMetaAccounts(context.userId, data.organizationId));
  });

export const selectMetaAdAccountFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { organizationId: string; accountId: string }) => data)
  .handler(async ({ context, data }): Promise<Result<MetaConnectionView>> => {
    const { selectMetaAdAccount } = await import("@/server/meta.server");
    return guard(() => selectMetaAdAccount(context.userId, data.organizationId, data.accountId));
  });

export const disconnectMetaFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { organizationId: string }) => data)
  .handler(async ({ context, data }): Promise<Result<MetaConnectionView>> => {
    const { disconnectMeta } = await import("@/server/meta.server");
    return guard(() => disconnectMeta(context.userId, data.organizationId));
  });
