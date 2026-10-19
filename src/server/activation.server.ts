import { randomUUID } from "node:crypto";
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

async function organizationByEmail(email: string) {
  const { data, error } = await supabaseAdmin
    .from("organizations")
    .select("id, legal_name, responsible_name, responsible_phone")
    .ilike("responsible_email", email)
    .limit(1);
  if (error) fail("Não foi possível confirmar este acesso.");
  return data?.[0] ?? null;
}

function emailTaken(message: string | undefined) {
  const text = (message ?? "").toLowerCase();
  return text.includes("already") || text.includes("registered") || text.includes("exists");
}

async function provisionClientAccess(email: string) {
  const organization = await organizationByEmail(email);
  if (!organization) return false;
  const fullName = organization.responsible_name.trim() || organization.legal_name.trim() || "Cliente";
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: `${randomUUID()}Aa1`,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error || !data.user) {
    if (emailTaken(error?.message)) return false;
    fail("Não foi possível criar o acesso.");
  }
  const createdId = data.user.id;
  const remove = async () => {
    await supabaseAdmin.from("user_permissions").delete().eq("user_id", createdId);
    await supabaseAdmin.from("user_roles").delete().eq("user_id", createdId);
    await supabaseAdmin.from("profiles").delete().eq("id", createdId);
    await supabaseAdmin.auth.admin.deleteUser(createdId);
  };
  const profile = await supabaseAdmin.from("profiles").insert({
    id: createdId,
    full_name: fullName,
    email,
    whatsapp: organization.responsible_phone,
    finance_email: email,
    finance_email_same: true,
    organization_id: organization.id,
  });
  if (profile.error) {
    await remove();
    fail("Não foi possível criar o acesso.");
  }
  const role = await supabaseAdmin.from("user_roles").insert({ user_id: createdId, role: "client_admin" });
  if (role.error) {
    await remove();
    fail("Não foi possível criar o acesso.");
  }
  const permission = await supabaseAdmin.from("user_permissions").insert({
    user_id: createdId,
    can_view_campaigns: true,
    can_view_meta_balance: true,
    can_add_meta_credit: true,
    can_manage_users: true,
    can_use_chatbot: true,
  });
  if (permission.error && /can_use_chatbot/i.test(permission.error.message)) {
    const retry = await supabaseAdmin.from("user_permissions").insert({
      user_id: createdId,
      can_view_campaigns: true,
      can_view_meta_balance: true,
      can_add_meta_credit: true,
      can_manage_users: true,
    });
    if (retry.error) {
      await remove();
      fail("Não foi possível criar o acesso.");
    }
  } else if (permission.error) {
    await remove();
    fail("Não foi possível criar o acesso.");
  }
  return true;
}

async function activationState(email: string): Promise<ActivationState> {
  let profile = await profileByEmail(email);
  if (!profile) {
    const created = await provisionClientAccess(email);
    if (!created) return "missing";
    profile = await profileByEmail(email);
    if (!profile) return "missing";
  }
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
