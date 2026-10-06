import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Result<T> = { ok: true; data: T } | { ok: false; message: string };

function publicMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  console.error(error);
  if (/abort|timeout|ECONNREFUSED|ETIMEDOUT|ENOTFOUND|ECONNRESET/i.test(message)) {
    return "Não foi possível consultar o CNPJ agora. Informe a razão social.";
  }
  if (!message || /fetch failed|postgres|JWT/i.test(message)) {
    return "Não foi possível consultar o CNPJ agora. Informe a razão social.";
  }
  return message;
}

export const lookupCnpjFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { document: string }) => data)
  .handler(async ({ data }): Promise<Result<{ legalName: string }>> => {
    try {
      const { lookupCnpj } = await import("@/server/cnpj.server");
      return { ok: true, data: await lookupCnpj(data.document) };
    } catch (error) {
      return { ok: false, message: publicMessage(error) };
    }
  });
