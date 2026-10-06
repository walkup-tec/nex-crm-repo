import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { UserPermissions, UsersSnapshot } from "@/lib/user-access";

type Result<T> = { ok: true; data: T } | { ok: false; message: string };

function publicMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  console.error(error);
  if (message.includes("SUPABASE_SERVICE_ROLE_KEY")) {
    return "O servidor ainda não tem a chave de administração do Supabase.";
  }
  if (message.includes("owner_id")) {
    return "Falta aplicar a coluna owner_id em profiles no Supabase.";
  }
  if (message.includes("whatsapp") || message.includes("finance_email")) {
    return "Falta aplicar as colunas de WhatsApp e e-mail financeiro em profiles no Supabase.";
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

export const listUsersFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Result<UsersSnapshot>> => {
    const { listUsers } = await import("@/server/users.server");
    return guard(() => listUsers(context.userId));
  });

export const createUserFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { fullName: string; email: string; whatsapp: string; financeEmail: string; financeEmailSame: boolean; kind?: "master" | "client"; permissions?: UserPermissions; sendEmail?: boolean }) => data)
  .handler(async ({ context, data }): Promise<Result<{ id: string; organizationId: string | null; emailSent: boolean }>> => {
    const { createUser } = await import("@/server/users.server");
    return guard(() => createUser(context.userId, data));
  });

export const resendInviteFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { id: string }) => data)
  .handler(async ({ context, data }): Promise<Result<true>> => {
    const { resendInvite } = await import("@/server/users.server");
    return guard(async () => {
      await resendInvite(context.userId, data.id);
      return true as const;
    });
  });

export const updateUserFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { id: string; fullName: string; email: string; whatsapp: string; financeEmail: string; financeEmailSame: boolean; permissions?: UserPermissions }) => data)
  .handler(async ({ context, data }): Promise<Result<true>> => {
    const { updateUser } = await import("@/server/users.server");
    return guard(async () => {
      await updateUser(context.userId, data);
      return true as const;
    });
  });

export const setUserBlockedFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { id: string; blocked: boolean }) => data)
  .handler(async ({ context, data }): Promise<Result<true>> => {
    const { setUserBlocked } = await import("@/server/users.server");
    return guard(async () => {
      await setUserBlocked(context.userId, data);
      return true as const;
    });
  });

export const deleteUserFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { id: string }) => data)
  .handler(async ({ context, data }): Promise<Result<true>> => {
    const { deleteUser } = await import("@/server/users.server");
    return guard(async () => {
      await deleteUser(context.userId, data.id);
      return true as const;
    });
  });
