import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { ChatbotSnapshot } from "@/lib/chatbot-evo";

type Result<T> = { ok: true; data: T } | { ok: false; message: string };

function publicMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  console.error("chatbot_action", /apikey|EVO_API_KEY|service_role/i.test(message) ? "redacted" : message);
  if (/apikey|EVO_API_KEY|service_role/i.test(message)) return "Não foi possível concluir a operação do atendimento.";
  if (/migração/.test(message)) return message;
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

export const resendAttendantInviteFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { email: string; name: string }) => data)
  .handler(async ({ context, data }) => {
    const { resendAttendantInvite } = await import("@/server/chatbot.server");
    return guard(() => resendAttendantInvite(context.userId, data.email, data.name));
  });

export const saveChatbotContactMediaFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { messageId: string }) => data)
  .handler(async ({ context, data }) => {
    const { saveChatbotContactMedia } = await import("@/server/chatbot.server");
    return guard(() => saveChatbotContactMedia(context.userId, data.messageId));
  });

export const chatbotMessageMediaFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { messageId: string }) => data)
  .handler(async ({ context, data }) => {
    const { chatbotMessageMedia } = await import("@/server/chatbot.server");
    return guard(() => chatbotMessageMedia(context.userId, data.messageId));
  });

export const sendChatbotMessageFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { conversationId: string; text: string }) => data)
  .handler(async ({ context, data }) => {
    const { sendChatbotMessage } = await import("@/server/chatbot.server");
    return guard(() => sendChatbotMessage(context.userId, data.conversationId, data.text));
  });

export const chatbotTeamSnapshotFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { chatbotTeamSnapshot } = await import("@/server/chatbot.server");
    return guard(() => chatbotTeamSnapshot(context.userId));
  });

export const createChatbotTeamFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { name: string; connectionId: string }) => data)
  .handler(async ({ context, data }) => {
    const { createChatbotTeam } = await import("@/server/chatbot.server");
    return guard(() => createChatbotTeam(context.userId, data.name, data.connectionId));
  });

export const deleteChatbotTeamFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { teamId: string }) => data)
  .handler(async ({ context, data }) => {
    const { deleteChatbotTeam } = await import("@/server/chatbot.server");
    return guard(() => deleteChatbotTeam(context.userId, data.teamId));
  });

export const updateChatbotTeamFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { teamId: string; name: string; connectionId: string }) => data)
  .handler(async ({ context, data }) => {
    const { updateChatbotTeam } = await import("@/server/chatbot.server");
    return guard(() => updateChatbotTeam(context.userId, data.teamId, data.name, data.connectionId));
  });

export const inviteChatbotAttendantFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { name: string; email: string; teamIds: string[] }) => ({
    name: data.name,
    email: data.email,
    teamIds: Array.isArray(data.teamIds) ? data.teamIds.filter((id) => typeof id === "string") : [],
  }))
  .handler(async ({ context, data }) => {
    const { inviteChatbotAttendant } = await import("@/server/chatbot.server");
    return guard(() => inviteChatbotAttendant(context.userId, data.name, data.email, data.teamIds));
  });

export const updateChatbotAttendantFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { attendantId: string; name: string; email: string; teamIds: string[] }) => ({
    attendantId: data.attendantId,
    name: data.name,
    email: data.email,
    teamIds: Array.isArray(data.teamIds) ? data.teamIds.filter((id) => typeof id === "string") : [],
  }))
  .handler(async ({ context, data }) => {
    const { updateChatbotAttendant } = await import("@/server/chatbot.server");
    return guard(() => updateChatbotAttendant(context.userId, data.attendantId, data.name, data.email, data.teamIds));
  });

export const deleteChatbotAttendantFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { attendantId: string }) => data)
  .handler(async ({ context, data }) => {
    const { deleteChatbotAttendant } = await import("@/server/chatbot.server");
    return guard(() => deleteChatbotAttendant(context.userId, data.attendantId));
  });

export const setChatbotAttendantTeamsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { attendantId: string; teamIds: string[] }) => ({
    attendantId: data.attendantId,
    teamIds: Array.isArray(data.teamIds) ? data.teamIds.filter((id) => typeof id === "string") : [],
  }))
  .handler(async ({ context, data }) => {
    const { setChatbotAttendantTeams } = await import("@/server/chatbot.server");
    return guard(() => setChatbotAttendantTeams(context.userId, data.attendantId, data.teamIds));
  });
