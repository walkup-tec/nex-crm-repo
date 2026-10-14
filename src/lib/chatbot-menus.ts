export const chatbotMenuItems = [
  { key: "inbox", path: "/chatbot", label: "Caixa de Entrada" },
  { key: "overview", path: "/chatbot/visao-geral", label: "Visão Geral" },
  { key: "kanban", path: "/chatbot/kanban", label: "Kanban" },
  { key: "clients", path: "/chatbot/clientes", label: "Clientes" },
  { key: "products", path: "/chatbot/produtos", label: "Produtos" },
  { key: "schedules", path: "/chatbot/agendamentos", label: "Agendamentos" },
  { key: "automations", path: "/chatbot/automacoes", label: "Criação Bots" },
  { key: "team", path: "/chatbot/equipes", label: "Time" },
  { key: "connection", path: "/chatbot/whatsapps", label: "Conexão" },
  { key: "settings", path: "/chatbot/configuracoes", label: "Configurações" },
] as const;

export type ChatbotMenuKey = (typeof chatbotMenuItems)[number]["key"];
export type ChatbotMenuPath = (typeof chatbotMenuItems)[number]["path"];
export type ChatbotMenuMap = Record<ChatbotMenuKey, boolean>;

export function allChatbotMenus(enabled: boolean): ChatbotMenuMap {
  return Object.fromEntries(chatbotMenuItems.map((item) => [item.key, enabled])) as ChatbotMenuMap;
}

export function chatbotMenusFromStorage(value: unknown): ChatbotMenuMap {
  if (!value || typeof value !== "object" || Array.isArray(value)) return allChatbotMenus(true);
  const record = value as Record<string, unknown>;
  const known = chatbotMenuItems.some((item) => Object.prototype.hasOwnProperty.call(record, item.key));
  if (!known) return allChatbotMenus(true);
  return Object.fromEntries(chatbotMenuItems.map((item) => [item.key, record[item.key] === true])) as ChatbotMenuMap;
}

export function explicitChatbotMenus(value: unknown): ChatbotMenuMap | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const menus = Object.fromEntries(chatbotMenuItems.map((item) => [item.key, record[item.key] === true])) as ChatbotMenuMap;
  return chatbotMenuItems.some((item) => menus[item.key]) ? menus : null;
}

export function chatbotMenuForPath(path: string): ChatbotMenuKey | null {
  const bare = path.split("?")[0]?.split("#")[0] ?? "/";
  const clean = bare.length > 1 && bare.endsWith("/") ? bare.slice(0, -1) : bare || "/";
  return chatbotMenuItems.find((item) => item.path === clean)?.key ?? null;
}

export function chatbotMenuAllowed(menus: ChatbotMenuMap, menu: ChatbotMenuKey | readonly ChatbotMenuKey[]) {
  const keys = typeof menu === "string" ? [menu] : menu;
  return keys.some((key) => menus[key]);
}

export function firstChatbotPath(menus: ChatbotMenuMap): ChatbotMenuPath | null {
  return chatbotMenuItems.find((item) => menus[item.key])?.path ?? null;
}
