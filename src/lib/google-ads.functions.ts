import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { GoogleAdsAccount, GoogleAdsCampaign } from "@/lib/google-ads";

type Result<T> = { ok: true; data: T } | { ok: false; message: string };

type GoogleAdsRead = {
  linked: boolean;
  account: { customerId: string; name: string; currency: string; status: string } | null;
  campaigns: GoogleAdsCampaign[];
  period?: string;
};

function publicMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  console.error("google_ads_action", /access_token|refresh_token|client_secret|ya29\.|GOCSPX/.test(message) ? "redacted" : message);
  if (/access_token|refresh_token|client_secret|ya29\.|GOCSPX/.test(message)) return "Não foi possível consultar o Google Ads.";
  if (message.includes("SUPABASE_SERVICE_ROLE_KEY")) return "O servidor ainda não tem a chave de administração do Supabase.";
  if (message.startsWith("Faltam as variáveis") || message.startsWith("Falta aplicar") || message.startsWith("O projeto Google Cloud") || message.startsWith("A autorização") || message.startsWith("A conta administradora") || message.startsWith("GOOGLE_ADS_")) return message;
  if (!message || /postgres|PGRST|violates|duplicate key|JWT|fetch failed/i.test(message)) return "Não foi possível consultar o Google Ads.";
  return message;
}

async function guard<T>(work: () => Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, data: await work() };
  } catch (error) {
    return { ok: false, message: publicMessage(error) };
  }
}

export const googleAdsSelectionFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { organizationId?: string }) => ({ organizationId: (data.organizationId ?? "").trim() }))
  .handler(async ({ context, data }): Promise<Result<GoogleAdsRead>> => {
    const { googleAdsSelection } = await import("@/server/google-ads.server");
    return guard(() => googleAdsSelection(context.userId, data.organizationId));
  });

export const listGoogleAdsAccountsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Result<GoogleAdsAccount[]>> => {
    const { listGoogleAdsAccounts } = await import("@/server/google-ads.server");
    return guard(() => listGoogleAdsAccounts(context.userId));
  });

export const selectGoogleAdsAccountFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { organizationId?: string; customerId?: string }) => ({
    organizationId: (data.organizationId ?? "").trim(),
    customerId: (data.customerId ?? "").trim(),
  }))
  .handler(async ({ context, data }) => {
    const { selectGoogleAdsAccount } = await import("@/server/google-ads.server");
    return guard(() => selectGoogleAdsAccount(context.userId, data.organizationId, data.customerId));
  });

export const readGoogleAdsCampaignsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { organizationId?: string }) => ({ organizationId: (data.organizationId ?? "").trim() }))
  .handler(async ({ context, data }): Promise<Result<GoogleAdsRead>> => {
    const { readGoogleAdsCampaigns } = await import("@/server/google-ads.server");
    return guard(() => readGoogleAdsCampaigns(context.userId, data.organizationId));
  });
