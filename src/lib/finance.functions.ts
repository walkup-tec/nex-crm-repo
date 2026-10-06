import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { ChargePix, MasterFinance, OwnFinance } from "@/lib/finance-access";

type Result<T> = { ok: true; data: T } | { ok: false; message: string };

function publicMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  console.error(error);
  if (message.includes("SUPABASE_SERVICE_ROLE_KEY")) return "O servidor ainda não tem a chave de administração do Supabase.";
  if (/\$aact|access_token|ASAAS_API_KEY/i.test(message)) return "Não foi possível consultar o Asaas.";
  if (!message || /postgres|PGRST|violates|duplicate key|JWT|fetch failed/i.test(message)) return "Não foi possível concluir. Tente de novo.";
  return message;
}

async function guard<T>(work: () => Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, data: await work() };
  } catch (error) {
    return { ok: false, message: publicMessage(error) };
  }
}

export const listMasterFinanceFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Result<MasterFinance>> => {
    const { listMasterFinance } = await import("@/server/finance.server");
    return guard(() => listMasterFinance(context.userId));
  });

export const listOwnFinanceFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Result<OwnFinance>> => {
    const { listOwnFinance } = await import("@/server/finance.server");
    return guard(() => listOwnFinance(context.userId));
  });

export const syncFinanceFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { organizationId?: string }) => data)
  .handler(async ({ context, data }): Promise<Result<string>> => {
    const { syncFinance } = await import("@/server/finance.server");
    return guard(() => syncFinance(context.userId, data.organizationId));
  });

export const negotiateChargeFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { invoiceId: string; waiveFine: boolean; waiveInterest: boolean }) => data)
  .handler(async ({ context, data }): Promise<Result<true>> => {
    const { negotiateCharge } = await import("@/server/finance.server");
    return guard(async () => {
      await negotiateCharge(context.userId, data);
      return true as const;
    });
  });

export const chargePixFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { invoiceId: string }) => data)
  .handler(async ({ context, data }): Promise<Result<ChargePix>> => {
    const { chargePix } = await import("@/server/finance.server");
    return guard(() => chargePix(context.userId, data.invoiceId));
  });
