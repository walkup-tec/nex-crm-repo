import { allChatbotMenus, chatbotMenuForPath, firstChatbotPath, type ChatbotMenuMap, type ChatbotMenuPath } from "@/lib/chatbot-menus";
import type { UserPermissions } from "@/lib/user-access";

export type ClientHome = "/dashboard" | "/creditos-meta" | "/usuarios" | "/minha-conta" | ChatbotMenuPath;

export const noClientPermissions: UserPermissions = {
  campaigns: false,
  balance: false,
  credit: false,
  manage: false,
  chatbot: false,
};

function cleanPath(path: string) {
  const bare = path.split("?")[0]?.split("#")[0] ?? "/";
  if (bare.length > 1 && bare.endsWith("/")) return bare.slice(0, -1);
  return bare || "/";
}

export function clientUserCanSee(path: string, permissions: UserPermissions, menus: ChatbotMenuMap = allChatbotMenus(true)) {
  const clean = cleanPath(path);
  if (clean === "/minha-conta") return true;
  if (clean === "/dashboard" || clean === "/campanhas" || clean === "/criativos") return permissions.campaigns;
  if (clean === "/creditos-meta") return permissions.balance || permissions.credit;
  if (clean === "/usuarios") return permissions.manage;
  if (clean === "/chatbot" || clean.startsWith("/chatbot/")) {
    if (!permissions.chatbot) return false;
    const menu = chatbotMenuForPath(clean);
    return menu ? menus[menu] : false;
  }
  return false;
}

export function isClientPermissionPath(path: string) {
  const clean = cleanPath(path);
  return (
    clean === "/dashboard" ||
    clean === "/campanhas" ||
    clean === "/criativos" ||
    clean === "/creditos-meta" ||
    clean === "/financeiro" ||
    clean === "/usuarios" ||
    clean === "/minha-conta" ||
    clean === "/chatbot" ||
    clean.startsWith("/chatbot/")
  );
}

export function firstAllowedClientPath(permissions: UserPermissions, menus: ChatbotMenuMap = allChatbotMenus(true)): ClientHome {
  if (permissions.campaigns) return "/dashboard";
  if (permissions.balance || permissions.credit) return "/creditos-meta";
  if (permissions.chatbot) {
    const next = firstChatbotPath(menus);
    if (next) return next;
  }
  if (permissions.manage) return "/usuarios";
  return "/minha-conta";
}
