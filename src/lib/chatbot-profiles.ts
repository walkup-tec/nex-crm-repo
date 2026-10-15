import { allChatbotMenus, chatbotMenuItems, explicitChatbotMenus, type ChatbotMenuKey, type ChatbotMenuMap } from "@/lib/chatbot-menus";

export const chatbotProfileItems = [
  { key: "attendant", label: "Atendente", description: "Atende conversas, acompanha clientes e a agenda." },
  { key: "supervisor", label: "Supervisor", description: "Acompanha a operação e o time, além do atendimento." },
  { key: "manager", label: "Gerente", description: "Opera o chatbot por completo, inclusive conexão e configurações." },
] as const;

export type ChatbotProfileKey = (typeof chatbotProfileItems)[number]["key"];
export type ChatbotProfiles = Record<ChatbotProfileKey, ChatbotMenuMap>;

function menus(keys: readonly ChatbotMenuKey[]): ChatbotMenuMap {
  const next = allChatbotMenus(false);
  for (const key of keys) next[key] = true;
  return next;
}

export function defaultChatbotProfiles(): ChatbotProfiles {
  return {
    attendant: menus(["inbox", "kanban", "clients", "schedules"]),
    supervisor: menus(["inbox", "overview", "kanban", "clients", "schedules", "team"]),
    manager: allChatbotMenus(true),
  };
}

function storedProfile(value: unknown, fallback: ChatbotMenuMap) {
  return explicitChatbotMenus(value) ?? fallback;
}

export function chatbotProfilesFromStorage(value: unknown): ChatbotProfiles {
  const defaults = defaultChatbotProfiles();
  if (!value || typeof value !== "object" || Array.isArray(value)) return defaults;
  const record = value as Record<string, unknown>;
  return {
    attendant: storedProfile(record.attendant, defaults.attendant),
    supervisor: storedProfile(record.supervisor, defaults.supervisor),
    manager: storedProfile(record.manager, defaults.manager),
  };
}

export function profileForMenus(menus: ChatbotMenuMap, profiles: ChatbotProfiles): ChatbotProfileKey | null {
  return chatbotProfileItems.find((item) => chatbotMenuItems.every((menu) => profiles[item.key][menu.key] === menus[menu.key]))?.key ?? null;
}

export function chatbotProfileLabel(key: ChatbotProfileKey) {
  return chatbotProfileItems.find((item) => item.key === key)?.label ?? "Atendente";
}
