import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { creativeErrorMessage } from "@/lib/creative-library";

type Result<T> = { ok: true; data: T } | { ok: false; message: string };

function publicMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  console.error(error);
  if (message.includes("SUPABASE_SERVICE_ROLE_KEY"))
    return "O servidor ainda não tem a chave de administração do Supabase.";
  return creativeErrorMessage(
    error instanceof Error ? { message } : null,
    "Não foi possível preparar os arquivos. Tente de novo.",
  );
}

export const ensureCreativesBucketFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Result<true>> => {
    try {
      const { ensureCreativesBucket } = await import("@/server/creatives.server");
      await ensureCreativesBucket(context.userId);
      return { ok: true, data: true };
    } catch (error) {
      return { ok: false, message: publicMessage(error) };
    }
  });
