import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { ActivationState } from "@/lib/activation-access";

function fail(message: string): never {
  throw new Error(message);
}

function normalizeEmail(value: string) {
  const email = value.trim().toLowerCase();
  if (!email.includes("@") || email.length > 320) fail("Informe um e-mail válido.");
  return email;
}

async function profileByEmail(email: string) {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id, email, is_blocked")
    .eq("email", email)
    .limit(1);
  if (error) fail("Não foi possível confirmar este acesso.");
  return data?.[0] ?? null;
}

async function activationState(email: string): Promise<ActivationState> {
  const profile = await profileByEmail(email);
  if (!profile) return "missing";
  if (profile.is_blocked) return "blocked";
  const { data, error } = await supabaseAdmin.auth.admin.getUserById(profile.id);
  if (error || !data.user) return "missing";
  if (data.user.last_sign_in_at) return "active";
  return "create";
}

export async function checkAccessEmail(emailInput: string) {
  const email = normalizeEmail(emailInput);
  const state = await activationState(email);
  return { state };
}

export async function createAccessPassword(emailInput: string, password: string) {
  const email = normalizeEmail(emailInput);
  if (password.length < 8) fail("Use pelo menos 8 caracteres.");
  const state = await activationState(email);
  if (state === "missing") fail("Entre em contato com o administrador da NEX e solicite seu cadastro de usuário");
  if (state === "blocked") fail("Este acesso está bloqueado.");
  if (state === "active") fail("Este acesso já possui senha. Entre na tela de login.");
  const profile = await profileByEmail(email);
  if (!profile) fail("Entre em contato com o administrador da NEX e solicite seu cadastro de usuário");
  const { error } = await supabaseAdmin.auth.admin.updateUserById(profile.id, { password, email_confirm: true });
  if (error) {
    const text = error.message.toLowerCase();
    if (text.includes("pwned") || text.includes("weak") || text.includes("leaked")) {
      fail("Escolha uma senha mais forte, que você não use em outro serviço.");
    }
    fail("Não foi possível criar a senha.");
  }
  return { email };
}
