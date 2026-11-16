import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { CAREER_ALLOWED_EMAIL, isCareerAllowedEmail, normalizeEmail } from "@/lib/career-access";

export class CareerForbiddenError extends Error {
  status = 403 as const;
  constructor(message = "Acesso ao módulo Candidatura negado.") {
    super(message);
    this.name = "CareerForbiddenError";
  }
}

let cachedOwnerId: string | null | undefined;

/** Resolve o UUID do único usuário autorizado (env override ou e-mail canônico no profiles). */
export async function resolveCareerOwnerUserId(): Promise<string | null> {
  const fromEnv = process.env["CAREER_ALLOWED_USER_ID"]?.trim();
  if (fromEnv) return fromEnv;
  if (cachedOwnerId !== undefined) return cachedOwnerId;

  const email = normalizeEmail(process.env["CAREER_ALLOWED_EMAIL"]?.trim() || CAREER_ALLOWED_EMAIL);
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id, email")
    .ilike("email", email)
    .maybeSingle();

  if (error) {
    console.error("career_owner_lookup_failed", error.message);
    cachedOwnerId = null;
    return null;
  }
  if (!data?.id || !isCareerAllowedEmail(data.email)) {
    cachedOwnerId = null;
    return null;
  }
  cachedOwnerId = data.id;
  return cachedOwnerId;
}

/** Painel / server fns: só o userId interno autorizado. */
export async function assertCareerPanelAccess(userId: string) {
  const ownerId = await resolveCareerOwnerUserId();
  if (!ownerId || ownerId !== userId) {
    throw new CareerForbiddenError();
  }
}

export async function canAccessCareerPanel(userId: string) {
  try {
    await assertCareerPanelAccess(userId);
    return true;
  } catch (error) {
    if (error instanceof CareerForbiddenError) return false;
    throw error;
  }
}

/** Testes / hot-reload: limpa cache do owner. */
export function clearCareerOwnerCache() {
  cachedOwnerId = undefined;
}
