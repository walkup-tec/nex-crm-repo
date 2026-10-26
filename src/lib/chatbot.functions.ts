import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { ChatbotSnapshot } from "@/lib/chatbot-evo";
import { chatbotProfilesFromStorage, type ChatbotProfiles } from "@/lib/chatbot-profiles";

type Result<T> = { ok: true; data: T } | { ok: false; message: string };

function publicMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  console.error("chatbot_action", /apikey|EVO_API_KEY|service_role/i.test(message) ? "redacted" : message);
  if (/apikey|EVO_API_KEY|service_role/i.test(message)) return "Não foi possível concluir a operação do atendimento.";
  if (/^(A minuta|A proposta|A Autentique|A assinatura|O contrato|O formulário|Informe |Cadastre |Esse contato|Esta conversa)/.test(message)) return message;
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

export const listChatbotChannelsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { listChatbotChannels } = await import("@/server/chatbot.server");
    return guard(() => listChatbotChannels(context.userId));
  });

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
  .validator((data: { connectionId?: string; phone?: string; withQr?: boolean }) => ({
    connectionId: typeof data.connectionId === "string" ? data.connectionId.trim() : "",
    phone: typeof data.phone === "string" ? data.phone : "",
    withQr: data.withQr === true,
  }))
  .handler(async ({ context, data }) => {
    const { refreshChatbotConnection } = await import("@/server/chatbot.server");
    return guard(() => refreshChatbotConnection(context.userId, data.connectionId, data.withQr, data.phone));
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

export const sendChatbotMediaFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { conversationId: string; kind: string; name: string; mime: string; base64: string }) => data)
  .handler(async ({ context, data }) => {
    const { sendChatbotMedia } = await import("@/server/chatbot.server");
    return guard(() => sendChatbotMedia(context.userId, data.conversationId, data));
  });

export const sendChatbotArtesFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { conversationId: string }) => data)
  .handler(async ({ context, data }) => {
    const { sendChatbotArtes } = await import("@/server/chatbot.server");
    return guard(() => sendChatbotArtes(context.userId, data.conversationId));
  });

export const sendChatbotMinutaFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { conversationId: string }) => data)
  .handler(async ({ context, data }) => {
    const { sendChatbotMinuta } = await import("@/server/chatbot.server");
    return guard(() => sendChatbotMinuta(context.userId, data.conversationId));
  });

export const sendChatbotPropostaFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { conversationId: string }) => data)
  .handler(async ({ context, data }) => {
    const { sendChatbotProposta } = await import("@/server/chatbot.server");
    return guard(() => sendChatbotProposta(context.userId, data.conversationId));
  });

export const sendChatbotAssinaturaFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { conversationId: string }) => data)
  .handler(async ({ context, data }) => {
    const { sendChatbotAssinatura, recordChatbotAssinaturaFailure } = await import("@/server/chatbot.server");
    const result = await guard(() => sendChatbotAssinatura(context.userId, data.conversationId));
    if (!result.ok) await recordChatbotAssinaturaFailure(context.userId, data.conversationId, result.message).catch(() => undefined);
    return result;
  });

export const sendChatbotCadastroFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { conversationId: string }) => data)
  .handler(async ({ context, data }) => {
    const { sendChatbotCadastro } = await import("@/server/chatbot.server");
    return guard(() => sendChatbotCadastro(context.userId, data.conversationId));
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

export const setChatbotContactBotsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { contactId: string; disabled: boolean }) => ({
    contactId: data.contactId,
    disabled: data.disabled === true,
  }))
  .handler(async ({ context, data }) => {
    const { setChatbotContactBots } = await import("@/server/chatbot.server");
    return guard(() => setChatbotContactBots(context.userId, data.contactId, data.disabled));
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

export const chatbotClientFieldSettingsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { chatbotClientFieldSettings } = await import("@/server/chatbot.server");
    return guard(() => chatbotClientFieldSettings(context.userId));
  });

export const saveChatbotClientFieldsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { document: boolean; rg: boolean }) => ({
    document: data.document === true,
    rg: data.rg === true,
  }))
  .handler(async ({ context, data }) => {
    const { saveChatbotClientFields } = await import("@/server/chatbot.server");
    return guard(() => saveChatbotClientFields(context.userId, data));
  });

export const setChatbotContactIdentityFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { contactId: string; field: "document" | "rg"; value: string }) => ({
    contactId: data.contactId,
    field: data.field === "rg" ? "rg" as const : "document" as const,
    value: String(data.value ?? ""),
  }))
  .handler(async ({ context, data }) => {
    const { setChatbotContactIdentity } = await import("@/server/chatbot.server");
    return guard(() => setChatbotContactIdentity(context.userId, data.contactId, data.field, data.value));
  });

export const setChatbotContactNoteFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { contactId: string; note: string }) => ({
    contactId: data.contactId,
    note: String(data.note ?? "").slice(0, 300),
  }))
  .handler(async ({ context, data }) => {
    const { setChatbotContactNote } = await import("@/server/chatbot.server");
    return guard(() => setChatbotContactNote(context.userId, data.contactId, data.note));
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

export const registerChatbotNexClientFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { contactId: string }) => data)
  .handler(async ({ context, data }) => {
    const { registerChatbotNexClient } = await import("@/server/chatbot.server");
    return guard(() => registerChatbotNexClient(context.userId, data.contactId));
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

export const listChatbotQueueAlertsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { listChatbotQueueAlerts } = await import("@/server/chatbot.server");
    return guard(() => listChatbotQueueAlerts(context.userId));
  });

export const chatbotAccessProfilesFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { chatbotAccessProfiles } = await import("@/server/chatbot.server");
    return guard(() => chatbotAccessProfiles(context.userId));
  });

export const saveChatbotAccessProfilesFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: ChatbotProfiles) => chatbotProfilesFromStorage(data))
  .handler(async ({ context, data }) => {
    const { saveChatbotAccessProfiles } = await import("@/server/chatbot.server");
    return guard(() => saveChatbotAccessProfiles(context.userId, data));
  });

export const chatbotNoticeTickFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { chatbotNoticeTick } = await import("@/server/chatbot.server");
    return guard(() => chatbotNoticeTick(context.userId));
  });

export const chatbotNoticeSettingsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { chatbotNoticeSettings } = await import("@/server/chatbot.server");
    return guard(() => chatbotNoticeSettings(context.userId));
  });

export const saveChatbotNoticeFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { sound: boolean; offlineAlert: boolean }) => ({
    sound: data.sound === true,
    offlineAlert: data.offlineAlert === true,
  }))
  .handler(async ({ context, data }) => {
    const { saveChatbotNotice } = await import("@/server/chatbot.server");
    return guard(() => saveChatbotNotice(context.userId, data));
  });

export const chatbotCompanySettingsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { chatbotCompanySettings } = await import("@/server/chatbot.server");
    return guard(() => chatbotCompanySettings(context.userId));
  });

export const saveChatbotCompanyFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { name: string }) => ({ name: String(data.name ?? "") }))
  .handler(async ({ context, data }) => {
    const { saveChatbotCompany } = await import("@/server/chatbot.server");
    return guard(() => saveChatbotCompany(context.userId, data));
  });

export const chatbotAutomationSettingsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { chatbotAutomationSettings } = await import("@/server/chatbot.server");
    return guard(() => chatbotAutomationSettings(context.userId));
  });

export const saveChatbotAutomationFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { reactivationMinutes: number; offlineMessageEnabled: boolean; offlineMessage: string }) => ({
    reactivationMinutes: Number(data.reactivationMinutes),
    offlineMessageEnabled: data.offlineMessageEnabled === true,
    offlineMessage: String(data.offlineMessage ?? ""),
  }))
  .handler(async ({ context, data }) => {
    const { saveChatbotAutomation } = await import("@/server/chatbot.server");
    return guard(() => saveChatbotAutomation(context.userId, data));
  });

export const chatbotBusinessHoursFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { chatbotBusinessHoursSettings } = await import("@/server/chatbot.server");
    return guard(() => chatbotBusinessHoursSettings(context.userId));
  });

export const saveChatbotBusinessHoursFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { timeZone?: string; days?: { open?: boolean; start?: string; end?: string }[] }) => ({
    timeZone: String(data.timeZone ?? ""),
    days: Array.isArray(data.days) ? data.days.slice(0, 7).map((day) => ({ open: day?.open === true, start: String(day?.start ?? ""), end: String(day?.end ?? "") })) : [],
  }))
  .handler(async ({ context, data }) => {
    const { saveChatbotBusinessHours } = await import("@/server/chatbot.server");
    return guard(() => saveChatbotBusinessHours(context.userId, { timeZone: data.timeZone, days: data.days }));
  });

export const chatbotAttendanceSettingsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { chatbotAttendanceSettings } = await import("@/server/chatbot.server");
    return guard(() => chatbotAttendanceSettings(context.userId));
  });

export const saveChatbotAttendanceFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { minutes: number; ratingEnabled: boolean; ratingPrompt: string }) => ({
    minutes: data.minutes,
    ratingEnabled: data.ratingEnabled === true,
    ratingPrompt: typeof data.ratingPrompt === "string" ? data.ratingPrompt : "",
  }))
  .handler(async ({ context, data }) => {
    const { saveChatbotAttendance } = await import("@/server/chatbot.server");
    return guard(() => saveChatbotAttendance(context.userId, data));
  });

export const saveChatbotQueueMinutesFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { minutes: number }) => ({ minutes: data.minutes }))
  .handler(async ({ context, data }) => {
    const { saveChatbotQueueMinutes } = await import("@/server/chatbot.server");
    return guard(() => saveChatbotQueueMinutes(context.userId, data.minutes));
  });

export const callChatbotContactFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { contactId: string }) => ({ contactId: data.contactId }))
  .handler(async ({ context, data }) => {
    const { callChatbotContact } = await import("@/server/chatbot.server");
    return guard(() => callChatbotContact(context.userId, data.contactId));
  });

export const startChatbotConversationFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { name: string; phone: string; connectionId: string }) => ({
    name: typeof data.name === "string" ? data.name : "",
    phone: typeof data.phone === "string" ? data.phone : "",
    connectionId: typeof data.connectionId === "string" ? data.connectionId : "",
  }))
  .handler(async ({ context, data }) => {
    const { startChatbotConversation } = await import("@/server/chatbot.server");
    return guard(() => startChatbotConversation(context.userId, data));
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

export const listChatbotQuickRepliesFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { listChatbotQuickReplies } = await import("@/server/chatbot.server");
    return guard(() => listChatbotQuickReplies(context.userId));
  });

export const saveChatbotQuickReplyFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { title: string; text: string; replyId?: string }) => ({
    title: data.title,
    text: data.text,
    replyId: typeof data.replyId === "string" ? data.replyId : "",
  }))
  .handler(async ({ context, data }) => {
    const { saveChatbotQuickReply } = await import("@/server/chatbot.server");
    return guard(() => saveChatbotQuickReply(context.userId, data.title, data.text, data.replyId));
  });

export const deleteChatbotQuickReplyFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { replyId: string }) => data)
  .handler(async ({ context, data }) => {
    const { deleteChatbotQuickReply } = await import("@/server/chatbot.server");
    return guard(() => deleteChatbotQuickReply(context.userId, data.replyId));
  });

export const listChatbotFlowsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { listChatbotFlows } = await import("@/server/chatbot.server");
    return guard(() => listChatbotFlows(context.userId));
  });

export const saveChatbotFlowFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { id: string; name: string; active: boolean; launch?: string; nodes: { id: string; label: string; kind: string; content: string; x: number; y: number; media?: { kind: string; name: string; mime: string; path: string } }[]; edges: { id: string; source: string; target: string }[] }) => ({
    id: typeof data.id === "string" ? data.id : "",
    name: data.name,
    active: data.active === true,
    launch: data.launch === "manual" ? "manual" : "auto",
    nodes: Array.isArray(data.nodes) ? data.nodes.slice(0, 80) : [],
    edges: Array.isArray(data.edges) ? data.edges.slice(0, 120) : [],
  }))
  .handler(async ({ context, data }) => {
    const { saveChatbotFlow } = await import("@/server/chatbot.server");
    return guard(() => saveChatbotFlow(context.userId, data));
  });

const flowDraft = (data: { name?: string; nodes?: unknown; edges?: unknown; messages?: string[] }) => ({
  name: typeof data.name === "string" ? data.name : "",
  nodes: Array.isArray(data.nodes) ? data.nodes.slice(0, 80) : [],
  edges: Array.isArray(data.edges) ? data.edges.slice(0, 120) : [],
  messages: Array.isArray(data.messages) ? data.messages.filter((item) => typeof item === "string").slice(0, 12) : [],
});

export const validateChatbotFlowFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { name?: string; nodes?: unknown; edges?: unknown }) => flowDraft(data))
  .handler(async ({ context, data }) => {
    const { validateChatbotFlow } = await import("@/server/chatbot.server");
    return guard(() => validateChatbotFlow(context.userId, data));
  });

export const previewChatbotFlowFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { name?: string; nodes?: unknown; edges?: unknown; messages?: string[] }) => flowDraft(data))
  .handler(async ({ context, data }) => {
    const { previewChatbotFlow } = await import("@/server/chatbot.server");
    return guard(() => previewChatbotFlow(context.userId, data));
  });

export const saveChatbotFlowMediaFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { name: string; mime: string; base64: string }) => ({
    name: typeof data.name === "string" ? data.name.slice(0, 120) : "",
    mime: typeof data.mime === "string" ? data.mime.slice(0, 80) : "",
    base64: typeof data.base64 === "string" ? data.base64 : "",
  }))
  .handler(async ({ context, data }) => {
    const { saveChatbotFlowMedia } = await import("@/server/chatbot.server");
    return guard(() => saveChatbotFlowMedia(context.userId, data));
  });

export const startChatbotFlowFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { conversationId: string; flowId: string }) => data)
  .handler(async ({ context, data }) => {
    const { startChatbotFlow } = await import("@/server/chatbot.server");
    return guard(() => startChatbotFlow(context.userId, data.conversationId, data.flowId));
  });

export const scheduleChatbotReturnFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { conversationId?: string; flowId?: string; date?: string; hour?: number; minute?: number }) => ({
    conversationId: typeof data.conversationId === "string" ? data.conversationId : "",
    flowId: typeof data.flowId === "string" ? data.flowId : "",
    date: typeof data.date === "string" ? data.date : "",
    hour: typeof data.hour === "number" ? data.hour : -1,
    minute: typeof data.minute === "number" ? data.minute : -1,
  }))
  .handler(async ({ context, data }) => {
    const { scheduleChatbotReturn } = await import("@/server/chatbot.server");
    return guard(() => scheduleChatbotReturn(context.userId, data));
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
