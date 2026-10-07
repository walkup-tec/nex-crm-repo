import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { MetaCreditView } from "@/lib/meta-credit";

type Result<T> = { ok: true; data: T } | { ok: false; message: string };

function publicMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  console.error(
    "meta_credit",
    /access_token|client_secret|EAA[A-Za-z0-9]/i.test(message) ? "redacted" : message,
  );
  if (/access_token|client_secret|EAA[A-Za-z0-9]/i.test(message))
    return "Não foi possível consultar a conta na Meta.";
  if (message.includes("SUPABASE_SERVICE_ROLE_KEY"))
    return "O servidor ainda não tem a chave de administração do Supabase.";
  if (!message || /postgres|PGRST|violates|duplicate key|JWT|fetch failed/i.test(message))
    return "Não foi possível concluir. Tente de novo.";
  return message;
}

async function guard<T>(work: () => Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, data: await work() };
  } catch (error) {
    return { ok: false, message: publicMessage(error) };
  }
}

export const getMetaCreditFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Result<MetaCreditView>> => {
    const { getMetaCredit } = await import("@/server/meta-credit.server");
    return guard(() => getMetaCredit(context.userId));
  });

export const startFacebookLoginFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { startFacebookLogin } = await import("@/server/meta-credit.server");
    return guard(() => startFacebookLogin(context.userId));
  });
