import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { appUrl, sendInviteEmail } from "@/server/mail.server";

import type { ListedUser, UserPermissions, UserRole } from "@/lib/user-access";

type Role = UserRole;

type Actor = {
  id: string;
  role: Role;
  organizationId: string | null;
  fullName: string;
};

type ProfileRow = {
  id: string;
  full_name: string;
  email: string;
  whatsapp: string | null;
  finance_email: string | null;
  finance_email_same: boolean;
  is_blocked: boolean;
  organization_id: string | null;
  owner_id: string | null;
};

function fail(message: string): never {
  throw new Error(message);
}

async function actorOf(userId: string): Promise<Actor> {
  const [{ data: profile, error: profileError }, { data: roles, error: roleError }] = await Promise.all([
    supabaseAdmin.from("profiles").select("id, full_name, organization_id, is_blocked").eq("id", userId).maybeSingle(),
    supabaseAdmin.from("user_roles").select("role").eq("user_id", userId),
  ]);
  if (profileError) fail(profileError.message);
  if (roleError) fail(roleError.message);
  if (!profile) fail("Seu perfil ainda não está ligado a um acesso.");
  if (profile.is_blocked) fail("Este acesso está bloqueado.");
  const role = (roles ?? []).some((item) => item.role === "master")
    ? "master"
    : (roles ?? []).some((item) => item.role === "client_admin")
      ? "client_admin"
      : "client_user";
  return {
    id: profile.id,
    role,
    organizationId: profile.organization_id,
    fullName: profile.full_name,
  };
}

const defaultPermissions: UserPermissions = { campaigns: true, balance: false, credit: false, manage: false };

function canManage(actor: Actor, target: { id: string; role: Role; ownerId: string | null }) {
  if (actor.id === target.id) return false;
  if (actor.role === "master") return true;
  return actor.role === "client_admin" && target.role === "client_user" && target.ownerId === actor.id;
}

async function profiles(): Promise<ProfileRow[]> {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name, email, whatsapp, finance_email, finance_email_same, is_blocked, organization_id, owner_id")
    .order("full_name");
  if (!error) return data ?? [];
  const text = error.message.toLowerCase();
  if (text.includes("owner_id")) fail("Falta aplicar a coluna owner_id em profiles no Supabase.");
  if (text.includes("whatsapp") || text.includes("finance_email")) {
    const legacy = await supabaseAdmin.from("profiles").select("id, full_name, email, is_blocked, organization_id, owner_id").order("full_name");
    if (legacy.error) {
      if (legacy.error.message.toLowerCase().includes("owner_id")) fail("Falta aplicar a coluna owner_id em profiles no Supabase.");
      fail(legacy.error.message);
    }
    return (legacy.data ?? []).map((row) => ({ ...row, whatsapp: null, finance_email: null, finance_email_same: false }));
  }
  fail(error.message);
}

async function roleMap() {
  const { data, error } = await supabaseAdmin.from("user_roles").select("user_id, role");
  if (error) fail(error.message);
  const map = new Map<string, Role>();
  for (const row of data ?? []) {
    const current = map.get(row.user_id);
    if (row.role === "master" || current === "master") map.set(row.user_id, "master");
    else if (row.role === "client_admin" || current === "client_admin") map.set(row.user_id, "client_admin");
    else map.set(row.user_id, "client_user");
  }
  return map;
}

async function permissionMap() {
  const { data, error } = await supabaseAdmin
    .from("user_permissions")
    .select("user_id, can_view_campaigns, can_view_meta_balance, can_add_meta_credit, can_manage_users");
  if (error) fail(error.message);
  const map = new Map<string, UserPermissions>();
  for (const row of data ?? []) {
    map.set(row.user_id, {
      campaigns: row.can_view_campaigns,
      balance: row.can_view_meta_balance,
      credit: row.can_add_meta_credit,
      manage: row.can_manage_users,
    });
  }
  return map;
}

function toListed(
  actor: Actor,
  row: ProfileRow,
  roles: Map<string, Role>,
  names: Map<string, string>,
  permissions: Map<string, UserPermissions>,
): ListedUser {
  const role = roles.get(row.id) ?? "client_user";
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    whatsapp: row.whatsapp ?? "",
    financeEmail: row.finance_email ?? "",
    financeEmailSame: row.finance_email_same,
    role,
    blocked: row.is_blocked,
    organizationId: row.organization_id,
    ownerId: row.owner_id,
    ownerName: row.owner_id ? names.get(row.owner_id) ?? null : null,
    permissions: permissions.get(row.id) ?? defaultPermissions,
    canManage: canManage(actor, { id: row.id, role, ownerId: row.owner_id }),
    metaLinked: false,
  };
}

async function organizationsWithPortfolio() {
  const { data, error } = await supabaseAdmin.from("meta_accounts").select("organization_id, portfolio_id").eq("selected", true);
  if (error) {
    const text = error.message.toLowerCase();
    if (text.includes("meta_accounts") || text.includes("portfolio_id") || text.includes("selected")) return new Set<string>();
    fail(error.message);
  }
  const ids = new Set<string>();
  for (const row of data ?? []) {
    if (row.organization_id && row.portfolio_id?.trim()) ids.add(row.organization_id);
  }
  return ids;
}

export async function listUsers(userId: string) {
  const actor = await actorOf(userId);
  const [rows, roles, permissions, linked] = await Promise.all([profiles(), roleMap(), permissionMap(), organizationsWithPortfolio()]);
  const names = new Map(rows.map((row) => [row.id, row.full_name]));
  const visible = rows.filter((row) => {
    if (actor.role === "master") return true;
    if (actor.role === "client_admin") return row.owner_id === actor.id;
    return false;
  });
  return {
    actor: { id: actor.id, role: actor.role, fullName: actor.fullName, organizationId: actor.organizationId },
    users: visible.map((row) => {
      const listed = toListed(actor, row, roles, names, permissions);
      listed.metaLinked = Boolean(row.organization_id && linked.has(row.organization_id));
      return listed;
    }),
  };
}

async function targetOf(id: string) {
  const [rows, roles] = await Promise.all([profiles(), roleMap()]);
  const row = rows.find((item) => item.id === id);
  if (!row) fail("Usuário não encontrado.");
  return { row, role: roles.get(row.id) ?? "client_user" };
}

export async function createUser(
  userId: string,
  input: {
    fullName: string;
    email: string;
    whatsapp: string;
    financeEmail: string;
    financeEmailSame: boolean;
    kind?: "master" | "client";
    permissions?: UserPermissions;
    sendEmail?: boolean;
  },
) {
  const actor = await actorOf(userId);
  const fullName = input.fullName.trim();
  const email = input.email.trim().toLowerCase();
  if (fullName.length < 2) fail("Informe o nome.");
  if (!email.includes("@")) fail("Informe um e-mail válido.");
  const contact = contactOf(input.whatsapp, email, input.financeEmail, input.financeEmailSame);

  let role: Role;
  let organizationId: string | null = null;
  let ownerId: string | null = null;
  let permissions: UserPermissions = defaultPermissions;

  if (actor.role === "master") {
    if (input.kind !== "master" && input.kind !== "client") fail("Escolha o tipo Master ou Cliente.");
    role = input.kind === "master" ? "master" : "client_admin";
    if (role === "client_admin") {
      permissions = { campaigns: true, balance: true, credit: true, manage: true };
    }
  } else if (actor.role === "client_admin") {
    if (!actor.organizationId) fail("Sua conta ainda não está ligada a uma empresa.");
    role = "client_user";
    organizationId = actor.organizationId;
    ownerId = actor.id;
    permissions = input.permissions ?? permissions;
  } else {
    fail("Você não pode criar usuários.");
  }

  const { data: link, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
    type: "invite",
    email,
    options: { redirectTo: `${appUrl()}/reset-password`, data: { full_name: fullName } },
  });
  if (linkError || !link.user) fail(emailTaken(linkError?.message) ? "Já existe um acesso com este e-mail." : "Não foi possível criar o acesso.");
  const createdId = link.user.id;

  const removeAuth = async () => {
    await supabaseAdmin.auth.admin.deleteUser(createdId);
  };

  try {
    if (role === "client_admin") {
      const { data: org, error: orgError } = await supabaseAdmin
        .from("organizations")
        .insert({
          legal_name: fullName,
          document: email,
          responsible_name: fullName,
          responsible_email: email,
          responsible_phone: contact.whatsapp,
          finance_phone: "não informado",
        })
        .select("id")
        .single();
      if (orgError || !org) fail(orgError?.message || "Não foi possível criar a empresa.");
      organizationId = org.id;
    }

    const { error: profileError } = await supabaseAdmin.from("profiles").insert({
      id: createdId,
      full_name: fullName,
      email,
      whatsapp: contact.whatsapp,
      finance_email: contact.financeEmail,
      finance_email_same: contact.financeEmailSame,
      organization_id: organizationId,
      owner_id: ownerId,
    });
    if (profileError) {
      const text = profileError.message.toLowerCase();
      if (text.includes("owner_id")) fail("Falta aplicar a coluna owner_id em profiles no Supabase.");
      if (text.includes("whatsapp") || text.includes("finance_email")) {
        fail("Falta aplicar as colunas de WhatsApp e e-mail financeiro em profiles no Supabase.");
      }
      fail(profileError.message);
    }

    const { error: roleError } = await supabaseAdmin.from("user_roles").insert({ user_id: createdId, role });
    if (roleError) fail(roleError.message);

    const { error: permissionError } = await supabaseAdmin.from("user_permissions").insert({
      user_id: createdId,
      can_view_campaigns: permissions.campaigns,
      can_view_meta_balance: permissions.balance,
      can_add_meta_credit: permissions.credit,
      can_manage_users: permissions.manage,
    });
    if (permissionError) fail(permissionError.message);

    if (input.sendEmail === false) return { id: createdId, organizationId, emailSent: false as const };
    const actionLink = link.properties?.action_link;
    if (!actionLink) fail("O convite foi criado sem o link de primeiro acesso.");
    try {
      await sendInviteEmail(email, fullName);
    } catch (error) {
      if (error instanceof Error && error.name === "InviteMailError") {
        return { id: createdId, organizationId, emailSent: false as const };
      }
      throw error;
    }
    return { id: createdId, organizationId, emailSent: true as const };
  } catch (error) {
    await supabaseAdmin.from("user_permissions").delete().eq("user_id", createdId);
    await supabaseAdmin.from("user_roles").delete().eq("user_id", createdId);
    await supabaseAdmin.from("profiles").delete().eq("id", createdId);
    if (organizationId && role === "client_admin") {
      await supabaseAdmin.from("organizations").delete().eq("id", organizationId);
    }
    await removeAuth();
    throw error;
  }
}

export async function resendInvite(userId: string, targetId: string) {
  const actor = await actorOf(userId);
  const target = await targetOf(targetId);
  if (!canManage(actor, { id: target.row.id, role: target.role, ownerId: target.row.owner_id })) {
    fail("Você não pode reenviar o convite deste usuário.");
  }
  if (target.row.is_blocked) fail("Este acesso está bloqueado.");
  await sendInviteEmail(target.row.email, target.row.full_name);
}

export async function updateUser(
  userId: string,
  input: { id: string; fullName: string; email: string; whatsapp: string; financeEmail: string; financeEmailSame: boolean; permissions?: UserPermissions },
) {
  const actor = await actorOf(userId);
  const target = await targetOf(input.id);
  if (!canManage(actor, { id: target.row.id, role: target.role, ownerId: target.row.owner_id })) {
    fail("Você não pode editar este usuário.");
  }
  const fullName = input.fullName.trim();
  const email = input.email.trim().toLowerCase();
  if (fullName.length < 2) fail("Informe o nome.");
  if (!email.includes("@")) fail("Informe um e-mail válido.");
  const contact = contactOf(input.whatsapp, email, input.financeEmail, input.financeEmailSame);

  const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(input.id, { email, email_confirm: true });
  if (authError) fail(emailTaken(authError.message) ? "Já existe um acesso com este e-mail." : "Não foi possível atualizar o acesso.");
  const { error } = await supabaseAdmin
    .from("profiles")
    .update({
      full_name: fullName,
      email,
      whatsapp: contact.whatsapp,
      finance_email: contact.financeEmail,
      finance_email_same: contact.financeEmailSame,
    })
    .eq("id", input.id);
  if (error) {
    const text = error.message.toLowerCase();
    if (text.includes("whatsapp") || text.includes("finance_email")) {
      fail("Falta aplicar as colunas de WhatsApp e e-mail financeiro em profiles no Supabase.");
    }
    fail(error.message);
  }
  if (target.role === "client_admin" && target.row.organization_id) {
    await supabaseAdmin
      .from("organizations")
      .update({ responsible_phone: contact.whatsapp })
      .eq("id", target.row.organization_id);
  }

  if (target.role === "client_user" && input.permissions) {
    const { error: permissionError } = await supabaseAdmin.from("user_permissions").upsert({
      user_id: input.id,
      can_view_campaigns: input.permissions.campaigns,
      can_view_meta_balance: input.permissions.balance,
      can_add_meta_credit: input.permissions.credit,
      can_manage_users: input.permissions.manage,
    });
    if (permissionError) fail(permissionError.message);
  }
}

export async function setUserBlocked(userId: string, input: { id: string; blocked: boolean }) {
  const actor = await actorOf(userId);
  const target = await targetOf(input.id);
  if (!canManage(actor, { id: target.row.id, role: target.role, ownerId: target.row.owner_id })) {
    fail("Você não pode bloquear este usuário.");
  }
  const { error } = await supabaseAdmin.from("profiles").update({ is_blocked: input.blocked }).eq("id", input.id);
  if (error) fail(error.message);
}

export async function deleteUser(userId: string, id: string) {
  const actor = await actorOf(userId);
  const target = await targetOf(id);
  if (!canManage(actor, { id: target.row.id, role: target.role, ownerId: target.row.owner_id })) {
    fail("Você não pode excluir este usuário.");
  }
  if (target.role === "client_admin") {
    const { count, error } = await supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }).eq("owner_id", id);
    if (error) fail(error.message);
    if ((count ?? 0) > 0) fail("Exclua primeiro os usuários atribuídos a este cliente.");
  }
  const organizationId = target.row.organization_id;
  const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(id);
  if (authError) fail("Não foi possível excluir o acesso.");
  await supabaseAdmin.from("user_permissions").delete().eq("user_id", id);
  await supabaseAdmin.from("user_roles").delete().eq("user_id", id);
  const { error: profileError } = await supabaseAdmin.from("profiles").delete().eq("id", id);
  if (profileError) fail(profileError.message);
  if (target.role === "client_admin" && organizationId) {
    const { count } = await supabaseAdmin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId);
    if ((count ?? 0) === 0) {
      await supabaseAdmin.from("organizations").delete().eq("id", organizationId);
    }
  }
}

function contactOf(whatsapp: string, email: string, financeEmail: string, financeEmailSame: boolean) {
  const digits = whatsapp.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 11) fail("Informe o WhatsApp com DDD.");
  const finance = (financeEmailSame ? email : financeEmail).trim().toLowerCase();
  if (!finance.includes("@")) fail("Informe o e-mail financeiro.");
  return { whatsapp: whatsapp.trim(), financeEmail: finance, financeEmailSame };
}

function emailTaken(message: string | undefined) {
  const text = (message ?? "").toLowerCase();
  return text.includes("already") || text.includes("registered") || text.includes("exists");
}
