import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { CAREER_ALLOWED_EMAIL, isCareerAllowedEmail, normalizeEmail } from "@/lib/career-access";

export class CareerForbiddenError extends Error {
  status = 403 as const;
  constructor(message = "Acesso ao módulo Candidatura negado.") {
    super(message);
    this.name = "CareerForbiddenError";
  }
}

/**
 * Autoriza pelo userId autenticado: lê o e-mail em profiles (servidor)
 * e compara com o e-mail canônico. Não confia em e-mail enviado pelo frontend.
 */
export async function assertCareerPanelAccess(userId: string) {
  const forcedId = process.env["CAREER_ALLOWED_USER_ID"]?.trim();
  if (forcedId) {
    if (forcedId !== userId) throw new CareerForbiddenError();
    return;
  }

  const allowedEmail = normalizeEmail(process.env["CAREER_ALLOWED_EMAIL"]?.trim() || CAREER_ALLOWED_EMAIL);
  const { data, error } = await supabaseAdmin.from("profiles").select("email").eq("id", userId).maybeSingle();
  if (error) {
    console.error("career_access_profile_failed", error.message);
    throw new Error(error.message);
  }

  let email = data?.email ?? "";
  if (!isCareerAllowedEmail(email)) {
    // Fallback: profiles.email pode estar vazio/desatualizado; auth.users é a fonte do login.
    const authUser = await supabaseAdmin.auth.admin.getUserById(userId);
    if (authUser.error) {
      console.error("career_access_auth_user_failed", authUser.error.message);
      throw new Error(authUser.error.message);
    }
    email = authUser.data.user?.email ?? "";
  }

  if (!isCareerAllowedEmail(email) || normalizeEmail(email) !== allowedEmail) {
    throw new CareerForbiddenError();
  }
}

export async function canAccessCareerPanel(userId: string) {
  try {
    await assertCareerPanelAccess(userId);
    return true;
  } catch (error) {
    if (error instanceof CareerForbiddenError || (error instanceof Error && error.name === "CareerForbiddenError")) {
      return false;
    }
    throw error;
  }
}

/** Compat: limpa cache legado (não usado na nova lógica). */
export function clearCareerOwnerCache() {}

export async function resolveCareerOwnerUserId(): Promise<string | null> {
  const forcedId = process.env["CAREER_ALLOWED_USER_ID"]?.trim();
  if (forcedId) return forcedId;
  const email = normalizeEmail(process.env["CAREER_ALLOWED_EMAIL"]?.trim() || CAREER_ALLOWED_EMAIL);
  const { data, error } = await supabaseAdmin.from("profiles").select("id, email").ilike("email", email).maybeSingle();
  if (error || !data?.id || !isCareerAllowedEmail(data.email)) return null;
  return data.id;
}
