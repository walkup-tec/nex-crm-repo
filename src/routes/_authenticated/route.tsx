import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { ChatbotNotices } from "@/components/chatbot/ChatbotNotices";
import {
  clientUserCanSee,
  firstAllowedClientPath,
  isClientPermissionPath,
  noClientPermissions,
} from "@/lib/client-permissions";
import { allChatbotMenus, chatbotMenusFromStorage, type ChatbotMenuMap } from "@/lib/chatbot-menus";
import { keepsAccessWithoutPayment } from "@/lib/finance-access";
import { agendaMenuForMmsMaster } from "@/lib/google-calendar";
import { readMasterRoles } from "@/lib/master-role";
import type { UserPermissions, UserRole } from "@/lib/user-access";

async function readOwnPermissions(userId: string): Promise<{ permissions: UserPermissions; chatbotMenus: ChatbotMenuMap }> {
  const full = await supabase
    .from("user_permissions")
    .select("can_view_campaigns, can_view_meta_balance, can_add_meta_credit, can_manage_users, can_use_chatbot, chatbot_menus")
    .eq("user_id", userId)
    .maybeSingle();
  const row =
    full.error && /chatbot_menus/i.test(full.error.message)
      ? await supabase
          .from("user_permissions")
          .select("can_view_campaigns, can_view_meta_balance, can_add_meta_credit, can_manage_users, can_use_chatbot")
          .eq("user_id", userId)
          .maybeSingle()
      : full.error && /can_use_chatbot/i.test(full.error.message)
        ? await supabase
            .from("user_permissions")
            .select("can_view_campaigns, can_view_meta_balance, can_add_meta_credit, can_manage_users")
            .eq("user_id", userId)
            .maybeSingle()
        : full;
  if (row.error) return { permissions: noClientPermissions, chatbotMenus: allChatbotMenus(false) };
  if (!row.data) return { permissions: { ...noClientPermissions, campaigns: true }, chatbotMenus: allChatbotMenus(false) };
  const chatbot = "can_use_chatbot" in row.data ? row.data.can_use_chatbot === true : false;
  const stored = "chatbot_menus" in row.data ? row.data.chatbot_menus : null;
  return {
    permissions: {
      campaigns: row.data.can_view_campaigns === true,
      balance: row.data.can_view_meta_balance === true,
      credit: row.data.can_add_meta_credit === true,
      manage: row.data.can_manage_users === true,
      chatbot,
    },
    chatbotMenus: chatbot ? chatbotMenusFromStorage(stored) : allChatbotMenus(false),
  };
}

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_blocked, organization_id")
      .eq("id", data.user.id)
      .maybeSingle();
    if (profile?.is_blocked) {
      await supabase.auth.signOut();
      throw redirect({ to: "/auth" });
    }
    const { master, roles } = await readMasterRoles(data.user.id);
    let calendarMenu = false;
    let legalName = "";
    let adsMeta = true;
    let adsGoogle = false;
    if (profile?.organization_id) {
      const full = await supabase
        .from("organizations")
        .select("status, legal_name, ads_meta, ads_google")
        .eq("id", profile.organization_id)
        .maybeSingle();
      const orgQuery =
        full.error && /ads_meta|ads_google/i.test(full.error.message)
          ? await supabase.from("organizations").select("status, legal_name").eq("id", profile.organization_id).maybeSingle()
          : full;
      const org = orgQuery.data;
      if (!full.error && full.data) {
        adsMeta = full.data.ads_meta === true;
        adsGoogle = full.data.ads_google === true;
      }
      legalName = org?.legal_name ?? "";
      const closed =
        org?.status === "disabled" || org?.status === "blocked" || org?.status === "contract_ended";
      if (!master && closed && !keepsAccessWithoutPayment(legalName)) {
        await supabase.auth.signOut();
        throw redirect({ href: "/auth?motivo=inativo" });
      }
    }
    const role: UserRole = master || roles.includes("master") ? "master" : roles.includes("client_admin") ? "client_admin" : "client_user";
    calendarMenu = agendaMenuForMmsMaster(legalName, role);
    if (location.pathname === "/chatbot/agendamentos" && !calendarMenu) throw redirect({ to: "/chatbot" });
    const loaded = role === "client_user" ? await readOwnPermissions(data.user.id) : null;
    const permissions = loaded?.permissions ?? null;
    const chatbotMenus = loaded?.chatbotMenus ?? null;
    if (permissions && chatbotMenus && isClientPermissionPath(location.pathname) && !clientUserCanSee(location.pathname, permissions, chatbotMenus)) {
      const next = firstAllowedClientPath(permissions, chatbotMenus);
      if (next !== location.pathname) throw redirect({ to: next });
    }
    return { user: data.user, master, role, permissions, chatbotMenus, calendarMenu, adsMeta, adsGoogle };
  },
  component: function AuthenticatedLayout() {
    return (
      <>
        <ChatbotNotices />
        <Outlet />
      </>
    );
  },
});
