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

export const markChatbotConversationReadFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { conversationId: string }) => data)
  .handler(async ({ context, data }) => {
    const { markChatbotConversationRead } = await import("@/server/chatbot.server");
    return guard(() => markChatbotConversationRead(context.userId, data.conversationId));
  });

export const setChatbotConversationPinFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { conversationId: string; pinned: boolean }) => ({
    conversationId: data.conversationId,
    pinned: data.pinned === true,
  }))
  .handler(async ({ context, data }) => {
    const { setChatbotConversationPin } = await import("@/server/chatbot.server");
    return guard(() => setChatbotConversationPin(context.userId, data.conversationId, data.pinned));
  });

export const assumeChatbotConversationFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { conversationId: string }) => data)
  .handler(async ({ context, data }) => {
    const { assumeChatbotConversation } = await import("@/server/chatbot.server");
    return guard(() => assumeChatbotConversation(context.userId, data.conversationId));
  });

export const finishChatbotConversationFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { conversationId: string }) => data)
  .handler(async ({ context, data }) => {
    const { finishChatbotConversation } = await import("@/server/chatbot.server");
    return guard(() => finishChatbotConversation(context.userId, data.conversationId));
  });

export const chatbotTransferTargetsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { conversationId: string }) => data)
  .handler(async ({ context, data }) => {
    const { chatbotTransferTargets } = await import("@/server/chatbot.server");
    return guard(() => chatbotTransferTargets(context.userId, data.conversationId));
  });

export const transferChatbotConversationFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { conversationId: string; attendantId: string; note?: string }) => ({
    conversationId: data.conversationId,
    attendantId: data.attendantId,
    note: typeof data.note === "string" ? data.note : "",
  }))
  .handler(async ({ context, data }) => {
    const { transferChatbotConversation } = await import("@/server/chatbot.server");
    return guard(() => transferChatbotConversation(context.userId, data.conversationId, data.attendantId, data.note));
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

export const addMyselfAsChatbotAttendantFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { teamIds: string[]; menus?: unknown }) => ({
    teamIds: Array.isArray(data.teamIds) ? data.teamIds.filter((id) => typeof id === "string") : [],
    menus: data.menus,
  }))
  .handler(async ({ context, data }) => {
    const { addMyselfAsChatbotAttendant } = await import("@/server/chatbot.server");
    return guard(() => addMyselfAsChatbotAttendant(context.userId, data.teamIds, data.menus));
  });

export const inviteChatbotAttendantFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { name: string; email: string; teamIds: string[]; menus?: unknown }) => ({
    name: data.name,
    email: data.email,
    teamIds: Array.isArray(data.teamIds) ? data.teamIds.filter((id) => typeof id === "string") : [],
    menus: data.menus,
  }))
  .handler(async ({ context, data }) => {
    const { inviteChatbotAttendant } = await import("@/server/chatbot.server");
    return guard(() => inviteChatbotAttendant(context.userId, data.name, data.email, data.teamIds, data.menus));
  });

export const updateChatbotAttendantFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { attendantId: string; name: string; email: string; teamIds: string[]; menus?: unknown }) => ({
    attendantId: data.attendantId,
    name: data.name,
    email: data.email,
    teamIds: Array.isArray(data.teamIds) ? data.teamIds.filter((id) => typeof id === "string") : [],
    menus: data.menus,
  }))
  .handler(async ({ context, data }) => {
    const { updateChatbotAttendant } = await import("@/server/chatbot.server");
    return guard(() => updateChatbotAttendant(context.userId, data.attendantId, data.name, data.email, data.teamIds, data.menus));
  });

export const deleteChatbotAttendantFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { attendantId: string }) => data)
  .handler(async ({ context, data }) => {
    const { deleteChatbotAttendant } = await import("@/server/chatbot.server");
    return guard(() => deleteChatbotAttendant(context.userId, data.attendantId));
  });

export const chatbotContactProfileFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { contactId: string }) => data)
  .handler(async ({ context, data }) => {
    const { chatbotContactProfile } = await import("@/server/chatbot.server");
    return guard(() => chatbotContactProfile(context.userId, data.contactId));
  });

export const setChatbotContactDealFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { contactId: string; cents: number | null }) => ({
    contactId: data.contactId,
    cents: data.cents == null ? null : data.cents,
  }))
  .handler(async ({ context, data }) => {
    const { setChatbotContactDeal } = await import("@/server/chatbot.server");
    return guard(() => setChatbotContactDeal(context.userId, data.contactId, data.cents));
  });

export const registerChatbotClientFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { contactId: string }) => data)
  .handler(async ({ context, data }) => {
    const { registerChatbotClient } = await import("@/server/chatbot.server");
    return guard(() => registerChatbotClient(context.userId, data.contactId));
  });

export const listChatbotClientsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { listChatbotClients } = await import("@/server/chatbot.server");
    return guard(() => listChatbotClients(context.userId));
  });

export const listChatbotKanbanFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { listChatbotKanban } = await import("@/server/chatbot.server");
    return guard(() => listChatbotKanban(context.userId));
  });

export const callChatbotContactFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { contactId: string }) => ({ contactId: data.contactId }))
  .handler(async ({ context, data }) => {
    const { callChatbotContact } = await import("@/server/chatbot.server");
    return guard(() => callChatbotContact(context.userId, data.contactId));
  });

export const renameChatbotContactFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { contactId: string; name: string }) => data)
  .handler(async ({ context, data }) => {
    const { renameChatbotContact } = await import("@/server/chatbot.server");
    return guard(() => renameChatbotContact(context.userId, data.contactId, data.name));
  });

export const renameChatbotContactFileFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { fileId: string; name: string }) => data)
  .handler(async ({ context, data }) => {
    const { renameChatbotContactFile } = await import("@/server/chatbot.server");
    return guard(() => renameChatbotContactFile(context.userId, data.fileId, data.name));
  });

export const setChatbotContactStageFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { contactId: string; stage: string }) => data)
  .handler(async ({ context, data }) => {
    const { setChatbotContactStage } = await import("@/server/chatbot.server");
    return guard(() => setChatbotContactStage(context.userId, data.contactId, data.stage));
  });

export const setChatbotContactTagsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { contactId: string; tagIds: string[] }) => ({
    contactId: data.contactId,
    tagIds: Array.isArray(data.tagIds) ? data.tagIds.filter((id) => typeof id === "string") : [],
  }))
  .handler(async ({ context, data }) => {
    const { setChatbotContactTags } = await import("@/server/chatbot.server");
    return guard(() => setChatbotContactTags(context.userId, data.contactId, data.tagIds));
  });

export const setChatbotContactProductsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { contactId: string; productIds: string[] }) => ({
    contactId: data.contactId,
    productIds: Array.isArray(data.productIds) ? data.productIds.filter((id) => typeof id === "string") : [],
  }))
  .handler(async ({ context, data }) => {
    const { setChatbotContactProducts } = await import("@/server/chatbot.server");
    return guard(() => setChatbotContactProducts(context.userId, data.contactId, data.productIds));
  });

export const listChatbotTagsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { listChatbotTags } = await import("@/server/chatbot.server");
    return guard(() => listChatbotTags(context.userId));
  });

export const saveChatbotTagFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { name: string; color: string }) => data)
  .handler(async ({ context, data }) => {
    const { saveChatbotTag } = await import("@/server/chatbot.server");
    return guard(() => saveChatbotTag(context.userId, data.name, data.color));
  });

export const deleteChatbotTagFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { tagId: string }) => data)
  .handler(async ({ context, data }) => {
    const { deleteChatbotTag } = await import("@/server/chatbot.server");
    return guard(() => deleteChatbotTag(context.userId, data.tagId));
  });

export const listChatbotProductsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { listChatbotProducts } = await import("@/server/chatbot.server");
    return guard(() => listChatbotProducts(context.userId));
  });

export const saveChatbotProductFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { name: string }) => data)
  .handler(async ({ context, data }) => {
    const { saveChatbotProduct } = await import("@/server/chatbot.server");
    return guard(() => saveChatbotProduct(context.userId, data.name));
  });

export const deleteChatbotProductFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { productId: string }) => data)
  .handler(async ({ context, data }) => {
    const { deleteChatbotProduct } = await import("@/server/chatbot.server");
    return guard(() => deleteChatbotProduct(context.userId, data.productId));
  });

export const chatbotOverviewFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { chatbotOverview } = await import("@/server/chatbot.server");
    return guard(() => chatbotOverview(context.userId));
  });

export const listChatbotStagesFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { listChatbotStages } = await import("@/server/chatbot.server");
    return guard(() => listChatbotStages(context.userId));
  });

export const saveChatbotStagesFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { names: string[] }) => ({
    names: Array.isArray(data.names) ? data.names.filter((name) => typeof name === "string") : [],
  }))
  .handler(async ({ context, data }) => {
    const { saveChatbotStages } = await import("@/server/chatbot.server");
    return guard(() => saveChatbotStages(context.userId, data.names));
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
