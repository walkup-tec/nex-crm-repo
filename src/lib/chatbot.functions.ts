import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { ChatbotSnapshot } from "@/lib/chatbot-evo";

type Result<T> = { ok: true; data: T } | { ok: false; message: string };

function publicMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  console.error("chatbot_action", /apikey|EVO_API_KEY|service_role/i.test(message) ? "redacted" : message);
  if (/apikey|EVO_API_KEY|service_role/i.test(message)) return "Não foi possível concluir a operação do atendimento.";
  if (/migração do atendimento/.test(message)) return message;
  if (/Evolution API/.test(message)) return message;
  if (!message || /postgres|PGRST|JWT|fetch failed/i.test(message)) {
    return "Não foi possível concluir a operação do atendimento.";
  }
  return message;
}

async function guard<T>(work: () => Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, data: await work() };
  } catch (error) {
    return { ok: false, message: publicMessage(error) };
  }
}

export const chatbotSnapshotFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Result<ChatbotSnapshot>> => {
    const { chatbotSnapshot } = await import("@/server/chatbot.server");
    return guard(() => chatbotSnapshot(context.userId));
  });

export const createChatbotConnectionFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { name: string; phone: string }) => data)
  .handler(async ({ context, data }) => {
    const { createChatbotConnection } = await import("@/server/chatbot.server");
    return guard(() => createChatbotConnection(context.userId, data.name, data.phone));
  });

export const refreshChatbotConnectionFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { connectionId: string; withQr?: boolean }) => ({
    connectionId: data.connectionId,
    withQr: data.withQr === true,
  }))
  .handler(async ({ context, data }) => {
    const { refreshChatbotConnection } = await import("@/server/chatbot.server");
    return guard(() => refreshChatbotConnection(context.userId, data.connectionId, data.withQr));
  });

export const deleteChatbotConnectionFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { connectionId: string }) => data)
  .handler(async ({ context, data }) => {
    const { deleteChatbotConnection } = await import("@/server/chatbot.server");
    return guard(() => deleteChatbotConnection(context.userId, data.connectionId));
  });

export const disconnectChatbotConnectionFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { connectionId: string }) => data)
  .handler(async ({ context, data }) => {
    const { disconnectChatbotConnection } = await import("@/server/chatbot.server");
    return guard(() => disconnectChatbotConnection(context.userId, data.connectionId));
  });

export const sendChatbotMessageFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { conversationId: string; text: string }) => data)
  .handler(async ({ context, data }) => {
    const { sendChatbotMessage } = await import("@/server/chatbot.server");
    return guard(() => sendChatbotMessage(context.userId, data.conversationId, data.text));
  });
