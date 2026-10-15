import { evolutionRuntime } from "@/server/evo.server";
import { createOrganizationAttendant } from "@/server/users.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Json } from "@/integrations/supabase/types";
import { chatbotMenuAllowed, chatbotMenusFromStorage, explicitChatbotMenus, type ChatbotMenuKey, type ChatbotMenuMap } from "@/lib/chatbot-menus";
import { chatbotProfilesFromStorage, type ChatbotProfiles } from "@/lib/chatbot-profiles";
import { chooseFlow, outsideBusinessHours, stepFlow, type FlowAction, type FlowRun, type SavedFlow } from "@/lib/chatbot-flow";
import { teamChannelsAfterRemoval } from "@/lib/chatbot-teams";
import {
  attendancePhone,
  chatbotInstanceName,
  inboxOrder,
  inboxUnread,
  inboxVisible,
  keepAttendanceBotsPaused,
  shouldSyncEvolution,
  evolutionConnectionStatus,
  evolutionInstanceClosed,
  evolutionInstanceNameOf,
  evolutionNumberInUse,
  evolutionContactPhone,
  learnLidPhones,
  resolveIncomingPhone,
  evolutionIncomingMessages,
  evolutionMediaFile,
  evolutionMessageContent,
  evolutionMessageText,
  evolutionProfilePictureUrl,
  evolutionQrImage,
  evolutionSameOwnerInstance,
  evolutionContactAvatar,
  preferredWhatsappPhone,
  sameWhatsappAccount,
  whatsappDeviceRemoved,
  whatsappDeviceRemovedMessage,
  whatsappJidPhone,
  catalogName,
  quickReplyText,
  negotiatedCents,
  defaultKanbanStages,
  kanbanStageName,
  keepWhatsappName,
  tagColorValue,
  clientVisibleTo,
  protectedKanbanStage,
  withWonKanbanStage,
  wonKanbanStage,
  defaultQueueMinutes,
  defaultRatingPrompt,
  overdueQueue,
  reactivationMinutes,
  reactivatesClosedConversation,
  queueMinutes,
  chatbotCompanyName,
  defaultOfflineNotice,
  offlineNoticeText,
  ratingMessage,
  ratingPrompt,
  ratingScore,
  type ChatbotCatalogItem,
  type OverviewBoard,
  type ChatbotClientRow,
  type ChatbotKanbanBoard,
  type ChatbotContactProfile,
  type ChatbotTag,
  type ChatbotConnectionStatus,
  type ChatbotSnapshot,
} from "@/lib/chatbot-evo";

type Query = {
  select: (columns?: string) => Query;
  insert: (value: Record<string, unknown> | Record<string, unknown>[]) => Query;
  update: (value: Record<string, unknown>) => Query;
  delete: () => Query;
  eq: (column: string, value: string) => Query;
  in: (column: string, values: string[]) => Query;
  is: (column: string, value: null) => Query;
  not: (column: string, operator: string, value: null) => Query;
  order: (column: string, options: { ascending: boolean }) => Query;
  limit: (count: number) => Query;
  maybeSingle: () => Promise<{ data: Record<string, unknown> | null; error: DbError | null }>;
};

type DbError = { message: string; code?: string };

function table(name: string) {
  return (supabaseAdmin as unknown as { from: (table: string) => Query }).from(name);
}

function fail(message: string): never {
  throw new Error(message);
}

function schemaMessage(message: string) {
  if (/chatbot_menus/i.test(message)) {
    return "Falta aplicar os menus do chatbot no Supabase.";
  }
  if (/chatbot_conversation_pins|chatbot_conversation_reads/i.test(message)) {
    return "A migração da caixa de entrada ainda não foi aplicada no Supabase.";
  }
  if (/chatbot_contact_files|media_kind|media_mime/i.test(message)) {
    return "A migração das mídias ainda não foi aplicada no Supabase.";
  }
  if (/chatbot_teams|chatbot_team_members|chatbot_team_channels/i.test(message)) {
    return "A migração das equipes ainda não foi aplicada no Supabase.";
  }
  if (/column "?internal"?|chatbot_messages.*internal/i.test(message)) {
    return "A migração da nota interna ainda não foi aplicada no Supabase.";
  }
  if (/chatbot_stages|stage_name/i.test(message)) {
    return "A migração das etapas do kanban ainda não foi aplicada no Supabase.";
  }
  if (/negotiated_cents|client_owner_id|client_registered_at/i.test(message)) {
    return "A migração do cadastro de clientes ainda não foi aplicada no Supabase.";
  }
  if (/finished_count/i.test(message)) {
    return "A migração dos atendimentos encerrados ainda não foi aplicada no Supabase.";
  }
  if (/chatbot_queue_minutes|queued_at/i.test(message)) {
    return "A migração do tempo da fila ainda não foi aplicada no Supabase.";
  }
  if (/chatbot_ratings|rating_pending|chatbot_rating_enabled|chatbot_rating_prompt/i.test(message)) {
    return "A migração da avaliação ainda não foi aplicada no Supabase.";
  }
  if (/chatbot_sound_enabled|chatbot_offline_alert|chatbot_presence/i.test(message)) {
    return "A migração das notificações ainda não foi aplicada no Supabase.";
  }
  if (/chatbot_access_profiles/i.test(message)) {
    return "A migração dos perfis de acesso ainda não foi aplicada no Supabase.";
  }
  if (/chatbot_company_name/i.test(message)) {
    return "A migração do nome da empresa ainda não foi aplicada no Supabase.";
  }
  if (/chatbot_reactivation_minutes|chatbot_offline_message|closed_at|offline_notified_at/i.test(message)) {
    return "A migração da reativação ainda não foi aplicada no Supabase.";
  }
  if (/assumed_by|stage_set_by/i.test(message)) {
    return "A migração do desempenho do atendente ainda não foi aplicada no Supabase.";
  }
  if (/bots_disabled/i.test(message)) {
    return "A migração dos bots por contato ainda não foi aplicada no Supabase.";
  }
  if (/chatbot_quick_replies/i.test(message)) {
    return "A migração das respostas rápidas ainda não foi aplicada no Supabase.";
  }
  if (/chatbot_flows|chatbot_flow_runs|bot_note/i.test(message)) {
    return "A migração dos bots ainda não foi aplicada no Supabase.";
  }
  if (/chatbot_tags|chatbot_products|chatbot_contact_tags|chatbot_contact_products|name_edited/i.test(message)) {
    return "A migração do cadastro do contato ainda não foi aplicada no Supabase.";
  }
  if (/chatbot_|schema cache|does not exist|PGRST205/i.test(message)) {
    return "A migração do atendimento ainda não foi aplicada no Supabase.";
  }
  return "Não foi possível gravar o atendimento.";
}

const stageMenus = ["inbox", "kanban", "settings", "overview"] as const satisfies readonly ChatbotMenuKey[];

async function membership(userId: string, menu?: ChatbotMenuKey | readonly ChatbotMenuKey[]) {
  const [{ data: profile, error: profileError }, { data: roles, error: roleError }] =
    await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("organization_id, is_blocked")
        .eq("id", userId)
        .maybeSingle(),
      supabaseAdmin.from("user_roles").select("role").eq("user_id", userId),
    ]);
  if (profileError) fail(schemaMessage(profileError.message));
  if (roleError) fail("Não foi possível confirmar o acesso.");
  if (!profile || profile.is_blocked) fail("Este acesso está bloqueado.");
  if (!profile.organization_id) fail("Sua conta ainda não está ligada a uma empresa.");
  const admin = (roles ?? []).some((role) => role.role === "master" || role.role === "client_admin");
  let menus = chatbotMenusFromStorage(null);
  if (!admin) {
    const full = await supabaseAdmin.from("user_permissions").select("can_use_chatbot, chatbot_menus").eq("user_id", userId).maybeSingle();
    const perms = full.error && /chatbot_menus/i.test(full.error.message)
      ? await supabaseAdmin.from("user_permissions").select("can_use_chatbot").eq("user_id", userId).maybeSingle()
      : full;
    if (perms.error) fail(schemaMessage(perms.error.message));
    if (perms.data?.can_use_chatbot !== true) fail("Você não tem permissão para usar o chatbot.");
    const stored = perms.data && "chatbot_menus" in perms.data ? perms.data.chatbot_menus : null;
    menus = chatbotMenusFromStorage(stored);
    if (menu && !chatbotMenuAllowed(menus, menu)) fail("Você não tem permissão para esta área do chatbot.");
  }
  return { organizationId: profile.organization_id, admin, menus };
}

async function saveAttendantMenus(attendantId: string, menus: ChatbotMenuMap) {
  const updated = await supabaseAdmin
    .from("user_permissions")
    .update({ chatbot_menus: menus as unknown as Json, can_use_chatbot: true })
    .eq("user_id", attendantId)
    .select("user_id")
    .maybeSingle();
  if (updated.error) fail(schemaMessage(updated.error.message));
  if (updated.data) return;
  const inserted = await supabaseAdmin.from("user_permissions").insert({
    user_id: attendantId,
    can_view_campaigns: false,
    can_view_meta_balance: false,
    can_add_meta_credit: false,
    can_manage_users: false,
    can_use_chatbot: true,
    chatbot_menus: menus as unknown as Json,
  });
  if (inserted.error) fail(schemaMessage(inserted.error.message));
}

function attendantMenus(value: unknown) {
  const menus = explicitChatbotMenus(value);
  if (!menus) fail("Selecione ao menos um menu do chatbot.");
  return menus;
}

async function evo(path: string, method: "GET" | "POST" | "DELETE", payload?: unknown, timeoutMs = 20000) {
  const { base, key } = evolutionRuntime();
  if (!base || !key) fail("A Evolution API ainda não está configurada no servidor.");
  const init: RequestInit = {
    method,
    headers: { "content-type": "application/json", apikey: key },
    signal: AbortSignal.timeout(timeoutMs),
  };
  if (payload !== undefined) init.body = JSON.stringify(payload);
  const response = await fetch(`${base}${path}`, init);
  const raw = await response.text();
  let body: unknown = null;
  if (raw) {
    try {
      body = JSON.parse(raw) as unknown;
    } catch {
      body = raw;
    }
  }
  if (!response.ok) {
    console.error("chatbot_evo", response.status);
    fail("A Evolution API não concluiu a operação.");
  }
  return body;
}

async function applyWhatsappName(instanceName: string, name: string) {
  const clean = name.trim();
  if (clean.length < 2) return;
  await evo(`/chat/updateProfileName/${encodeURIComponent(instanceName)}`, "POST", { name: clean }).catch(() => null);
}

function webhookUrl() {
  const base = (process.env["APP_URL"] || "https://app.nexmeta.com.br").replace(/\/$/, "");
  const { key } = evolutionRuntime();
  return `${base}/api/chatbot/evo?token=${encodeURIComponent(key)}`;
}

function webhookBody() {
  const { key } = evolutionRuntime();
  return {
    webhook: {
      enabled: true,
      url: webhookUrl(),
      byEvents: false,
      base64: false,
      headers: { apikey: key, authorization: `Bearer ${key}` },
      events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE", "CONTACTS_UPDATE"],
    },
  };
}

async function ensureWebhook(instanceName: string) {
  await evo(`/webhook/set/${encodeURIComponent(instanceName)}`, "POST", webhookBody()).catch(() => null);
}

async function findEvolutionInstance(instanceName: string) {
  const listed = await evo("/instance/fetchInstances", "GET").catch(() => null);
  if (!Array.isArray(listed)) return null;
  const found = listed.find(
    (item) => item && typeof item === "object" && evolutionInstanceNameOf(item as Record<string, unknown>) === instanceName,
  );
  return found && typeof found === "object" ? (found as Record<string, unknown>) : null;
}

async function whatsappAlreadyRegistered(phone: string) {
  const listed = await evo("/instance/fetchInstances", "GET").catch(() => null);
  return evolutionNumberInUse(listed, phone);
}

function connectionStatusReason(payload: Record<string, unknown>) {
  const data = payload["data"];
  if (data && typeof data === "object") {
    const reason = (data as Record<string, unknown>)["statusReason"];
    if (reason != null && reason !== "") return reason;
  }
  return payload["statusReason"];
}

function sameSecret(left: string, right: string) {
  const a = new TextEncoder().encode(left);
  const b = new TextEncoder().encode(right);
  if (a.length !== b.length || a.length === 0) return false;
  let diff = 0;
  for (let index = 0; index < a.length; index += 1) diff |= (a[index] ?? 0) ^ (b[index] ?? 0);
  return diff === 0;
}

function cell(row: Record<string, unknown> | null | undefined, key: string) {
  const value = row?.[key];
  return value == null ? "" : String(value);
}

function duplicate(error: DbError | null) {
  return Boolean(error && (error.code === "23505" || /duplicate key/i.test(error.message)));
}

const evolutionSyncAt = new Map<string, number>();

function scheduleEvolutionImport(organizationId: string, connectionRows: Record<string, unknown>[]) {
  const now = Date.now();
  const last = evolutionSyncAt.get(organizationId) ?? 0;
  if (!shouldSyncEvolution(last, now)) return;
  evolutionSyncAt.set(organizationId, now);
  void Promise.all(connectionRows.map((row) => importEvolutionMessages(row).catch(() => null)));
}

export async function chatbotSnapshot(userId: string): Promise<ChatbotSnapshot> {
  const { organizationId, admin } = await membership(userId, ["inbox", "connection"]);
  const connectionRows = await rows(
    table("chatbot_connections").select("*").eq("organization_id", organizationId).order("created_at", { ascending: true }),
  );
  scheduleEvolutionImport(organizationId, connectionRows);
  const [contactRows, conversationRows, messageRows] = await Promise.all([
    rows(table("chatbot_contacts").select("*").eq("organization_id", organizationId).order("name", { ascending: true })),
    rows(table("chatbot_conversations").select("*").eq("organization_id", organizationId).order("updated_at", { ascending: false })),
    rows(table("chatbot_messages").select("*").eq("organization_id", organizationId).order("created_at", { ascending: false }).limit(800)),
  ]);
  const allowedConnections = admin ? null : await teamConnectionIds(userId, organizationId);
  const scopedConversations = conversationRows.filter((row) => {
    if (allowedConnections && !allowedConnections.has(cell(row, "connection_id"))) return false;
    return inboxVisible({ assigneeId: cell(row, "assignee_id"), userId, admin });
  });
  const visibleConversationIds = new Set(scopedConversations.map((row) => cell(row, "id")));
  const chronologicalMessages = [...messageRows].reverse();
  const scopedMessages = chronologicalMessages.filter((row) => visibleConversationIds.has(cell(row, "conversation_id")));
  const assigneeIds = [...new Set(scopedConversations.map((row) => cell(row, "assignee_id")).filter(Boolean))];
  const assigneeNames = new Map<string, string>();
  if (assigneeIds.length) {
    const people = await supabaseAdmin.from("profiles").select("id, full_name").in("id", assigneeIds);
    for (const person of people.data ?? []) assigneeNames.set(person.id, person.full_name.trim());
  }
  const [pinState, readState, activity] = await Promise.all([
    rowsOrMissing(table("chatbot_conversation_pins").select("conversation_id").eq("user_id", userId).eq("organization_id", organizationId)),
    rowsOrMissing(table("chatbot_conversation_reads").select("conversation_id, last_read_at").eq("user_id", userId).eq("organization_id", organizationId)),
    rows(
      table("chatbot_messages")
        .select("conversation_id, created_at, direction")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false })
        .limit(2000),
    ),
  ]);
  const pinnedIds = new Set(pinState.rows.map((row) => cell(row, "conversation_id")));
  const readAt = new Map(readState.rows.map((row) => [cell(row, "conversation_id"), cell(row, "last_read_at")]));
  const latestAt = new Map<string, string>();
  const inboundAt = new Map<string, string[]>();
  for (const message of activity) {
    const id = cell(message, "conversation_id");
    if (!visibleConversationIds.has(id)) continue;
    if (!latestAt.has(id)) latestAt.set(id, cell(message, "created_at"));
    if (cell(message, "direction") !== "in") continue;
    const times = inboundAt.get(id) ?? [];
    times.push(cell(message, "created_at"));
    inboundAt.set(id, times);
  }
  void refreshStaleAvatars(organizationId, connectionRows, contactRows, scopedConversations)
    .then((fresh) => {
      for (const [contactId, url] of fresh) avatarCache.set(contactId, url);
    })
    .catch(() => null);
  const savedMedia = await savedMessageIds(organizationId);
  const ordered = inboxOrder(
    scopedConversations.map((row) => ({
      row,
      id: cell(row, "id"),
      pinned: pinnedIds.has(cell(row, "id")),
      updatedAt: latestAt.get(cell(row, "id")) || cell(row, "updated_at"),
    })),
  );
  return {
    configured: true,
    organizationId,
    connections: connectionRows.map((row) => ({
      id: cell(row, "id"),
      name: cell(row, "display_name"),
      phone: cell(row, "phone"),
      status: cell(row, "status") as ChatbotConnectionStatus,
      error: cell(row, "last_error"),
    })),
    contacts: contactRows.map((row) => ({
      id: cell(row, "id"),
      name: cell(row, "name"),
      phone: cell(row, "phone"),
      avatarUrl: avatarCache.get(cell(row, "id")) ?? cell(row, "avatar_url"),
      botsDisabled: row["bots_disabled"] === true,
    })),
    conversations: ordered.map(({ row, pinned, updatedAt }) => {
      const assigneeId = cell(row, "assignee_id");
      return {
        id: cell(row, "id"),
        contactId: cell(row, "contact_id"),
        connectionId: cell(row, "connection_id"),
        status: cell(row, "status") as "queue" | "active" | "closed",
        assigneeName: assigneeNames.get(assigneeId) ?? "",
        botPaused: row["bot_paused"] === true,
        updatedAt,
        unreadCount: readState.missing ? 0 : inboxUnread(inboundAt.get(cell(row, "id")) ?? [], readAt.get(cell(row, "id")) ?? ""),
        pinned,
        mine: assigneeId === userId,
        open: !assigneeId,
      };
    }),
    messages: scopedMessages.map((row) => ({
      id: cell(row, "id"),
      conversationId: cell(row, "conversation_id"),
      text: cell(row, "text"),
      direction: cell(row, "direction") as "in" | "out",
      status: cell(row, "status") as "pending" | "sent" | "failed",
      createdAt: cell(row, "created_at"),
      mediaKind: cell(row, "media_kind") === "video" ? "video" as const : cell(row, "media_kind") === "image" ? "image" as const : cell(row, "media_kind") === "audio" ? "audio" as const : "" as const,
      mediaMime: cell(row, "media_mime"),
      saved: savedMedia.has(cell(row, "id")),
      internal: row["internal"] === true,
    })),
  };
}

export async function createChatbotConnection(userId: string, name: string, phone: string) {
  const clean = name.trim();
  if (clean.length < 2) fail("Informe o nome de atendimento.");
  if (clean.length > 25) fail("O nome de atendimento pode ter no máximo 25 caracteres.");
  const number = attendancePhone(phone);
  if (!number) fail("Informe o número com DDD.");
  const { organizationId, admin } = await membership(userId, "connection");
  if (!admin) fail("Somente o administrador da empresa pode conectar um WhatsApp.");
  const savedNumbers = await rows(table("chatbot_connections").select("phone").eq("organization_id", organizationId));
  if (savedNumbers.some((row) => sameWhatsappAccount(cell(row, "phone"), number)) || (await whatsappAlreadyRegistered(number))) {
    fail("Esse número já está na API WhatsApp. Use o card existente e leia o QR Code uma única vez.");
  }
  const instanceName = chatbotInstanceName(organizationId);
  await evo("/instance/create", "POST", {
    instanceName,
    qrcode: true,
    integration: "WHATSAPP-BAILEYS",
    number,
  });
  const webhookReady = await evo(`/webhook/set/${encodeURIComponent(instanceName)}`, "POST", webhookBody())
    .then(() => true)
    .catch(() => false);
  const qr = evolutionQrImage(await evo(`/instance/connect/${encodeURIComponent(instanceName)}`, "GET"));
  const inserted = await table("chatbot_connections")
    .insert({
      organization_id: organizationId,
      instance_name: instanceName,
      display_name: clean,
      phone: number,
      status: qr ? "qr" : "waiting",
      last_error: webhookReady ? "" : "O número foi criado, mas o recebimento de mensagens ainda não foi confirmado.",
    })
    .select("*")
    .maybeSingle();
  if (inserted.error || !inserted.data) fail(schemaMessage(inserted.error?.message ?? ""));
  return { id: cell(inserted.data, "id"), qrCode: qr };
}

export async function refreshChatbotConnection(userId: string, connectionId: string, withQr = false) {
  const { organizationId } = await membership(userId, "connection");
  const current = await ownedConnection(organizationId, connectionId);
  const instanceName = cell(current, "instance_name");
  const stateBody = await evo(`/instance/connectionState/${encodeURIComponent(instanceName)}`, "GET");
  const listed = await findEvolutionInstance(instanceName);
  await ensureWebhook(instanceName);
  const listedState = cell(listed, "connectionStatus");
  const liveState = readState(stateBody);
  const observed = evolutionConnectionStatus(liveState || listedState);
  const removed = (liveState === "close" || listedState === "close") && whatsappDeviceRemoved(listed?.["disconnectionReasonCode"]);
  const previous = cell(current, "status");
  const qrCode = withQr && observed !== "connected" ? evolutionQrImage(await evo(`/instance/connect/${encodeURIComponent(instanceName)}`, "GET")) : "";
  const live = removed ? "disconnected" : observed === "connected" ? "connected" : qrCode ? "qr" : observed;
  const next = !removed && previous === "connected" && live !== "connected" && !withQr ? "connected" : live;
  const lastError = next === "connected" ? "" : removed ? whatsappDeviceRemovedMessage : cell(current, "last_error");
  if (next === "connected") await applyWhatsappName(instanceName, cell(current, "display_name"));
  const updated = await table("chatbot_connections")
    .update({ status: next, last_error: lastError, updated_at: new Date().toISOString() })
    .eq("id", connectionId)
    .eq("organization_id", organizationId)
    .select("*")
    .maybeSingle();
  if (updated.error) fail(schemaMessage(updated.error.message));
  return { status: next, qrCode, error: lastError };
}

export async function deleteChatbotConnection(userId: string, connectionId: string) {
  const { organizationId, admin } = await membership(userId, "connection");
  if (!admin) fail("Somente o administrador da empresa pode excluir um WhatsApp.");
  const current = await ownedConnection(organizationId, connectionId);
  await removeEvolutionInstance(cell(current, "instance_name"));
  await releaseTeamsFromChannel(organizationId, connectionId);
  const conversations = await rows(
    table("chatbot_conversations").select("contact_id").eq("connection_id", connectionId).eq("organization_id", organizationId),
  );
  const contactIds = [...new Set(conversations.map((row) => cell(row, "contact_id")).filter(Boolean))];
  await done(table("chatbot_connections").delete().eq("id", connectionId).eq("organization_id", organizationId));
  for (const contactId of contactIds) {
    const still = await table("chatbot_conversations")
      .select("id")
      .eq("contact_id", contactId)
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (still.error) fail(schemaMessage(still.error.message));
    if (!still.data) await done(table("chatbot_contacts").delete().eq("id", contactId).eq("organization_id", organizationId));
  }
}

async function evolutionDeleteAccepted(instanceName: string) {
  let accepted = false;
  try {
    await evo(`/instance/delete/${encodeURIComponent(instanceName)}`, "DELETE");
    accepted = true;
  } catch {
    if (!(await findEvolutionInstance(instanceName))) return true;
  }
  if (!(await findEvolutionInstance(instanceName))) return true;
  try {
    await evo(`/instance/delete/${encodeURIComponent(instanceName)}`, "DELETE");
    accepted = true;
  } catch {
    return !(await findEvolutionInstance(instanceName));
  }
  return accepted || !(await findEvolutionInstance(instanceName));
}

async function removeEvolutionInstance(instanceName: string) {
  if (!instanceName) return;
  const current = await findEvolutionInstance(instanceName);
  if (!current) return;
  if (!evolutionInstanceClosed(current)) {
    await evo(`/instance/logout/${encodeURIComponent(instanceName)}`, "DELETE").catch(() => null);
  }
  if (await evolutionDeleteAccepted(instanceName)) return;
  await evo(`/instance/logout/${encodeURIComponent(instanceName)}`, "DELETE").catch(() => null);
  if (await evolutionDeleteAccepted(instanceName)) return;
  if (await findEvolutionInstance(instanceName)) fail("Não foi possível excluir o número na Evolution.");
}

async function teamChannelRows(organizationId: string) {
  const [teams, links] = await Promise.all([
    rows(table("chatbot_teams").select("id, connection_id").eq("organization_id", organizationId)),
    rowsOrMissing(table("chatbot_team_channels").select("team_id, connection_id").eq("organization_id", organizationId)),
  ]);
  return { teams, links };
}

function channelsOfTeam(
  teamId: string,
  primaryChannelId: string,
  links: { rows: Record<string, unknown>[]; missing: boolean },
) {
  const linked = links.missing
    ? []
    : links.rows.filter((row) => cell(row, "team_id") === teamId).map((row) => cell(row, "connection_id")).filter(Boolean);
  return linked.length ? linked : primaryChannelId ? [primaryChannelId] : [];
}

async function releaseTeamsFromChannel(organizationId: string, connectionId: string) {
  const { teams, links } = await teamChannelRows(organizationId);
  for (const team of teams) {
    const teamId = cell(team, "id");
    const currentChannels = channelsOfTeam(teamId, cell(team, "connection_id"), links);
    if (!currentChannels.includes(connectionId)) continue;
    const remaining = teamChannelsAfterRemoval(currentChannels, connectionId);
    const updated = await table("chatbot_teams")
      .update({ connection_id: remaining[0] ?? null })
      .eq("id", teamId)
      .eq("organization_id", organizationId)
      .select("id")
      .maybeSingle();
    if (updated.error) fail(schemaMessage(updated.error.message));
  }
  if (links.missing) return;
  const removed = await (table("chatbot_team_channels").delete().eq("connection_id", connectionId).eq("organization_id", organizationId) as unknown as Promise<{
    error: DbError | null;
  }>);
  if (removed.error && !/chatbot_team_channels|schema cache|does not exist|PGRST205/i.test(removed.error.message)) {
    fail(schemaMessage(removed.error.message));
  }
}

async function rememberTeamChannel(organizationId: string, teamId: string, connectionId: string) {
  const removed = await (table("chatbot_team_channels").delete().eq("team_id", teamId).eq("organization_id", organizationId) as unknown as Promise<{
    error: DbError | null;
  }>);
  if (removed.error) {
    if (/chatbot_team_channels|schema cache|does not exist|PGRST205/i.test(removed.error.message)) return;
    fail(schemaMessage(removed.error.message));
  }
  const inserted = await table("chatbot_team_channels")
    .insert({ team_id: teamId, connection_id: connectionId, organization_id: organizationId })
    .select("team_id")
    .maybeSingle();
  if (inserted.error && !duplicate(inserted.error)) fail(schemaMessage(inserted.error.message));
}

export async function disconnectChatbotConnection(userId: string, connectionId: string) {
  const { organizationId, admin } = await membership(userId, "connection");
  if (!admin) fail("Somente o administrador da empresa pode desconectar um WhatsApp.");
  const current = await ownedConnection(organizationId, connectionId);
  await evo(`/instance/logout/${encodeURIComponent(cell(current, "instance_name"))}`, "DELETE").catch(
    () => null,
  );
  const updated = await table("chatbot_connections")
    .update({ status: "disconnected", updated_at: new Date().toISOString() })
    .eq("id", connectionId)
    .eq("organization_id", organizationId)
    .select("id")
    .maybeSingle();
  if (updated.error) fail(schemaMessage(updated.error.message));
}

export async function sendChatbotMessage(userId: string, conversationId: string, text: string) {
  const clean = text.trim();
  if (!clean) fail("Escreva a mensagem.");
  const { organizationId, admin } = await membership(userId, "inbox");
  const conversation = await table("chatbot_conversations")
    .select("*")
    .eq("id", conversationId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (conversation.error) fail(schemaMessage(conversation.error.message));
  if (!conversation.data) fail("Essa conversa não pertence à sua empresa.");
  const assignee = cell(conversation.data, "assignee_id");
  if (assignee && assignee !== userId) fail("Essa conversa está com outro atendente.");
  const contact = await table("chatbot_contacts")
    .select("phone")
    .eq("id", cell(conversation.data, "contact_id"))
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (contact.error) fail(schemaMessage(contact.error.message));
  const phone = cell(contact.data, "phone");
  if (!phone) fail("Esse contato não tem um telefone válido.");
  const connection = await ownedConnection(organizationId, cell(conversation.data, "connection_id"));
  if (!admin) {
    const allowed = await teamConnectionIds(userId, organizationId);
    if (!allowed.has(cell(connection, "id"))) fail("Essa conversa não pertence a uma equipe sua.");
  }
  if (cell(connection, "status") !== "connected") fail("O WhatsApp dessa conversa não está conectado.");
  const sent = await evo(`/message/sendText/${encodeURIComponent(cell(connection, "instance_name"))}`, "POST", {
    number: phone,
    text: clean,
  });
  const externalId = readMessageId(sent);
  const saved = await table("chatbot_messages")
    .insert({
      organization_id: organizationId,
      conversation_id: conversationId,
      text: clean,
      direction: "out",
      status: "sent",
      external_id: externalId || null,
    })
    .select("id")
    .maybeSingle();
  if (saved.error) fail(schemaMessage(saved.error.message));
  const assigned = await assignConversation(conversationId, organizationId, userId, {
    status: "active",
    bot_paused: true,
    updated_at: new Date().toISOString(),
  });
  if (assigned.error) fail(schemaMessage(assigned.error.message));
}

async function requireVisibleConversation(userId: string, conversationId: string) {
  const { organizationId, admin } = await membership(userId, "inbox");
  const conversation = await table("chatbot_conversations")
    .select("*")
    .eq("id", conversationId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (conversation.error) fail(schemaMessage(conversation.error.message));
  if (!conversation.data) fail("Essa conversa não pertence à sua empresa.");
  const assignee = cell(conversation.data, "assignee_id");
  if (!inboxVisible({ assigneeId: assignee, userId, admin })) fail("Essa conversa está com outro atendente.");
  if (!admin) {
    const allowed = await teamConnectionIds(userId, organizationId);
    if (!allowed.has(cell(conversation.data, "connection_id"))) fail("Essa conversa não pertence a uma equipe sua.");
  }
  return { organizationId, admin, conversation: conversation.data };
}

export async function markChatbotConversationRead(userId: string, conversationId: string) {
  const { organizationId } = await requireVisibleConversation(userId, conversationId);
  const now = new Date().toISOString();
  const inserted = await table("chatbot_conversation_reads")
    .insert({ user_id: userId, conversation_id: conversationId, organization_id: organizationId, last_read_at: now })
    .select("conversation_id")
    .maybeSingle();
  if (!inserted.error) return;
  if (duplicate(inserted.error)) {
    await done(table("chatbot_conversation_reads").update({ last_read_at: now }).eq("user_id", userId).eq("conversation_id", conversationId));
    return;
  }
  fail(schemaMessage(inserted.error.message));
}

export async function setChatbotConversationPin(userId: string, conversationId: string, pinned: boolean) {
  const { organizationId } = await requireVisibleConversation(userId, conversationId);
  if (!pinned) {
    await done(table("chatbot_conversation_pins").delete().eq("user_id", userId).eq("conversation_id", conversationId));
    return;
  }
  const inserted = await table("chatbot_conversation_pins")
    .insert({ user_id: userId, conversation_id: conversationId, organization_id: organizationId })
    .select("conversation_id")
    .maybeSingle();
  if (inserted.error && !duplicate(inserted.error)) fail(schemaMessage(inserted.error.message));
}

async function assignConversation(
  conversationId: string,
  organizationId: string,
  attendantId: string,
  extra: Record<string, unknown>,
  onlyFrom?: string,
) {
  const attempt = (remember: boolean) => {
    const patch = remember ? { ...extra, assignee_id: attendantId, assumed_by: attendantId } : { ...extra, assignee_id: attendantId };
    let query = table("chatbot_conversations").update(patch).eq("id", conversationId).eq("organization_id", organizationId);
    if (onlyFrom) query = query.eq("assignee_id", onlyFrom);
    return query.select("id").maybeSingle();
  };
  let updated = await attempt(true);
  if (updated.error && /assumed_by/i.test(updated.error.message)) updated = await attempt(false);
  return updated;
}

export async function assumeChatbotConversation(userId: string, conversationId: string) {
  const { organizationId, conversation } = await requireVisibleConversation(userId, conversationId);
  const assignee = cell(conversation, "assignee_id");
  if (assignee && assignee !== userId) fail("Essa conversa já está com outro atendente.");
  if (assignee === userId) return;
  const updated = await assignConversation(conversationId, organizationId, userId, { status: "active", bot_paused: true });
  if (updated.error) fail(schemaMessage(updated.error.message));
}

export async function finishChatbotConversation(userId: string, conversationId: string) {
  const { organizationId, admin, conversation } = await requireVisibleConversation(userId, conversationId);
  const assignee = cell(conversation, "assignee_id");
  if (!assignee) return;
  if (!admin && assignee !== userId) fail("Só quem está atendendo pode finalizar.");
  const finished = Number(conversation["finished_count"]);
  const closedAt = new Date().toISOString();
  const patch: Record<string, unknown> = {
    status: "closed",
    assignee_id: null,
    assumed_by: assignee,
    bot_paused: true,
    finished_count: (Number.isFinite(finished) ? finished : 0) + 1,
    updated_at: closedAt,
    closed_at: closedAt,
  };
  let updated = await table("chatbot_conversations")
    .update(patch)
    .eq("id", conversationId)
    .eq("organization_id", organizationId)
    .eq("assignee_id", assignee)
    .select("id")
    .maybeSingle();
  for (let attempt = 0; updated.error && attempt < 2; attempt += 1) {
    const missing = updated.error.message.match(/closed_at|assumed_by/i);
    if (!missing) break;
    const key = missing[0].toLowerCase();
    if (!(key in patch)) break;
    delete patch[key];
    updated = await table("chatbot_conversations")
      .update(patch)
      .eq("id", conversationId)
      .eq("organization_id", organizationId)
      .eq("assignee_id", assignee)
      .select("id")
      .maybeSingle();
  }
  if (updated.error) fail(schemaMessage(updated.error.message));
  if (!updated.data) fail("O atendimento já foi finalizado.");
  await requestChatbotRating(organizationId, conversation);
}

async function requestChatbotRating(organizationId: string, conversation: Record<string, unknown>) {
  try {
    const settings = await table("organizations")
      .select("chatbot_rating_enabled, chatbot_rating_prompt")
      .eq("id", organizationId)
      .maybeSingle();
    if (settings.error || settings.data?.["chatbot_rating_enabled"] !== true) return;
    const conversationId = cell(conversation, "id");
    const contact = await table("chatbot_contacts").select("phone").eq("id", cell(conversation, "contact_id")).maybeSingle();
    const phone = cell(contact.data, "phone");
    const connection = await table("chatbot_connections").select("instance_name, status").eq("id", cell(conversation, "connection_id")).maybeSingle();
    if (!phone || cell(connection.data, "status") !== "connected") return;
    const text = ratingMessage(cell(settings.data, "chatbot_rating_prompt"));
    const sent = await evo(`/message/sendText/${encodeURIComponent(cell(connection.data, "instance_name"))}`, "POST", { number: phone, text });
    const saved = await table("chatbot_messages")
      .insert({
        organization_id: organizationId,
        conversation_id: conversationId,
        text,
        direction: "out",
        status: "sent",
        external_id: readMessageId(sent) || null,
      })
      .select("id")
      .maybeSingle();
    if (saved.error) return;
    await table("chatbot_conversations")
      .update({ rating_pending: true })
      .eq("id", conversationId)
      .eq("organization_id", organizationId)
      .select("id")
      .maybeSingle();
  } catch {
    return;
  }
}

async function acceptRatingReply(organizationId: string, conversationId: string, contactId: string, text: string) {
  const current = await table("chatbot_conversations").select("rating_pending").eq("id", conversationId).eq("organization_id", organizationId).maybeSingle();
  if (current.error || current.data?.["rating_pending"] !== true) return false;
  const score = ratingScore(text);
  if (!score) {
    await table("chatbot_conversations").update({ rating_pending: false }).eq("id", conversationId).eq("organization_id", organizationId);
    return false;
  }
  const saved = await table("chatbot_ratings")
    .insert({ organization_id: organizationId, conversation_id: conversationId, contact_id: contactId, score })
    .select("id")
    .maybeSingle();
  if (saved.error) return false;
  await table("chatbot_conversations").update({ rating_pending: false }).eq("id", conversationId).eq("organization_id", organizationId);
  return true;
}

export async function chatbotTransferTargets(userId: string, conversationId: string) {
  const { organizationId, conversation } = await requireVisibleConversation(userId, conversationId);
  if (cell(conversation, "assignee_id") !== userId) fail("Só quem assumiu a conversa pode transferir.");
  const connectionId = cell(conversation, "connection_id");
  const [members, loaded, profiles] = await Promise.all([
    rows(table("chatbot_team_members").select("team_id, user_id").eq("organization_id", organizationId)),
    teamChannelRows(organizationId),
    supabaseAdmin.from("profiles").select("id, full_name").eq("organization_id", organizationId).order("full_name", { ascending: true }),
  ]);
  if (profiles.error) fail(schemaMessage(profiles.error.message));
  const teamIds = new Set(
    loaded.teams
      .filter((row) => channelsOfTeam(cell(row, "id"), cell(row, "connection_id"), loaded.links).includes(connectionId))
      .map((row) => cell(row, "id")),
  );
  const candidateIds = [
    ...new Set(
      members
        .filter((row) => teamIds.has(cell(row, "team_id")) && cell(row, "user_id") !== userId)
        .map((row) => cell(row, "user_id")),
    ),
  ];
  const roles = candidateIds.length
    ? await supabaseAdmin.from("user_roles").select("user_id, role").in("user_id", candidateIds)
    : { data: [], error: null };
  if (roles.error) fail(schemaMessage(roles.error.message));
  const attendants = new Set(
    (roles.data ?? []).filter((row) => row.role === "client_user" || row.role === "client_admin" || row.role === "master").map((row) => row.user_id),
  );
  return (profiles.data ?? []).filter((row) => attendants.has(row.id)).map((row) => ({ id: row.id, name: row.full_name.trim() }));
}

export async function transferChatbotConversation(userId: string, conversationId: string, attendantId: string, note: string) {
  const cleanNote = note.trim();
  if (cleanNote.length > 500) fail("A nota interna pode ter no máximo 500 caracteres.");
  const targets = await chatbotTransferTargets(userId, conversationId);
  if (!targets.some((item) => item.id === attendantId)) fail("Esse atendente não atende este canal.");
  const { organizationId } = await requireVisibleConversation(userId, conversationId);
  if (cleanNote) {
    const saved = await table("chatbot_messages")
      .insert({
        organization_id: organizationId,
        conversation_id: conversationId,
        text: cleanNote,
        direction: "out",
        status: "sent",
        internal: true,
      })
      .select("id")
      .maybeSingle();
    if (saved.error) fail(schemaMessage(saved.error.message));
  }
  const updated = await assignConversation(conversationId, organizationId, attendantId, { status: "active", bot_paused: true }, userId);
  if (updated.error) fail(schemaMessage(updated.error.message));
  if (!updated.data) fail("Só quem assumiu a conversa pode transferir.");
}

export async function ingestEvolutionWebhook(request: Request) {
  const { key } = evolutionRuntime();
  const payload = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!payload) return new Response("invalid", { status: 400 });
  const header = request.headers.get("apikey") || request.headers.get("x-api-key") || "";
  const authorization = request.headers.get("authorization") ?? "";
  const bearer = authorization.toLowerCase().startsWith("bearer ") ? authorization.slice(7).trim() : "";
  const queryToken = new URL(request.url).searchParams.get("token") ?? "";
  const providedKey = payload["apikey"];
  const bodyKey = typeof providedKey === "string" ? providedKey : "";
  const authorized = [header, bearer, queryToken, bodyKey].some((value) => sameSecret(value, key));
  if (!key || !authorized) return new Response("unauthorized", { status: 401 });
  const instance = cell(payload, "instance");
  if (!instance) return new Response("ok");
  const found = await table("chatbot_connections").select("*").eq("instance_name", instance).maybeSingle();
  if (found.error || !found.data) return new Response("ok");
  const event = cell(payload, "event").toLowerCase();
  if (event.includes("connection")) {
    const status = evolutionConnectionStatus(readState(payload["data"] ?? payload));
    const previous = cell(found.data, "status");
    const removed = status === "disconnected" && whatsappDeviceRemoved(connectionStatusReason(payload));
    const next = status === "disconnected" && previous === "connected" && !removed ? previous : status;
    const sender = payload["sender"];
    const senderPhone = whatsappJidPhone(typeof sender === "string" ? sender : "");
    const phone = preferredWhatsappPhone(cell(found.data, "phone"), senderPhone);
    if (next === "connected") await applyWhatsappName(cell(found.data, "instance_name"), cell(found.data, "display_name"));
    await table("chatbot_connections")
      .update({
        status: next,
        ...(phone ? { phone } : {}),
        updated_at: new Date().toISOString(),
        last_error: next === "connected" ? "" : removed ? whatsappDeviceRemovedMessage : cell(found.data, "last_error"),
      })
      .eq("id", cell(found.data, "id"));
  }
  if (event.includes("messages")) {
    const items = evolutionIncomingMessages(payload["data"]);
    const knownLids = rememberLidPhones(items);
    for (const item of items) {
      await storeIncoming(found.data, item, knownLids);
      void refreshMessageAvatar(found.data, item, knownLids).catch(() => null);
    }
  }
  if (event.includes("contacts")) {
    const data = payload["data"];
    const items = Array.isArray(data) ? data : data ? [data] : [];
    for (const item of items) await refreshWebhookAvatar(found.data, item);
  }
  return new Response("ok");
}

const avatarAttempt = new Map<string, number>();
const avatarCache = new Map<string, string>();
const avatarFreshMs = 10 * 60 * 1000;

function avatarStale(contactId: string, checkedAt: string) {
  const stored = Date.parse(checkedAt);
  const last = Math.max(avatarAttempt.get(contactId) ?? 0, Number.isFinite(stored) ? stored : 0);
  return Date.now() - last > avatarFreshMs;
}

async function saveContactAvatar(organizationId: string, contactId: string, url: string) {
  avatarCache.set(contactId, url);
  avatarAttempt.set(contactId, Date.now());
  await table("chatbot_contacts")
    .update({ avatar_url: url, avatar_checked_at: new Date().toISOString() })
    .eq("id", contactId)
    .eq("organization_id", organizationId);
}

async function refreshContactAvatar(instanceName: string, organizationId: string, contactId: string, phone: string, force = false) {
  if (!instanceName || !phone || !contactId) return null;
  if (!force && !avatarStale(contactId, "")) return null;
  avatarAttempt.set(contactId, Date.now());
  const body = await evo(`/chat/fetchProfilePictureUrl/${encodeURIComponent(instanceName)}`, "POST", { number: phone }).catch(() => null);
  if (!body) return null;
  const url = evolutionProfilePictureUrl(body);
  await saveContactAvatar(organizationId, contactId, url).catch(() => null);
  return url;
}

async function findContactByPhone(organizationId: string, phone: string) {
  try {
    const listed = await rows(table("chatbot_contacts").select("id, phone").eq("organization_id", organizationId));
    return listed.find((row) => cell(row, "phone") === phone || sameWhatsappAccount(cell(row, "phone"), phone)) ?? null;
  } catch {
    return null;
  }
}

const knownLidPhones: Record<string, string> = {};

function messageKeys(items: Record<string, unknown>[]) {
  return items.map((item) => {
    const raw = item["key"];
    return raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  });
}

function rememberLidPhones(items: Record<string, unknown>[]) {
  Object.assign(knownLidPhones, learnLidPhones(messageKeys(items)));
  return knownLidPhones;
}

function incomingPhone(key: Record<string, unknown>, knownLids: Record<string, string>) {
  return resolveIncomingPhone(key, knownLids) || evolutionContactPhone(key);
}

async function refreshMessageAvatar(connection: Record<string, unknown>, data: unknown, knownLids: Record<string, string> = {}) {
  const record = data && typeof data === "object" ? (data as Record<string, unknown>) : {};
  const rawKey = record["key"];
  const key = rawKey && typeof rawKey === "object" ? (rawKey as Record<string, unknown>) : {};
  if (key["fromMe"] === true) return;
  const phone = incomingPhone(key, knownLids);
  if (!phone) return;
  const organizationId = cell(connection, "organization_id");
  const contact = await findContactByPhone(organizationId, phone);
  if (!contact) return;
  await refreshContactAvatar(cell(connection, "instance_name"), organizationId, cell(contact, "id"), cell(contact, "phone"), true);
}

async function refreshWebhookAvatar(connection: Record<string, unknown>, data: unknown) {
  const update = evolutionContactAvatar(data);
  if (!update) return;
  const organizationId = cell(connection, "organization_id");
  const contact = await findContactByPhone(organizationId, update.phone);
  if (!contact) return;
  if (update.url) {
    await saveContactAvatar(organizationId, cell(contact, "id"), update.url).catch(() => null);
    return;
  }
  if (update.changed) {
    await refreshContactAvatar(cell(connection, "instance_name"), organizationId, cell(contact, "id"), cell(contact, "phone"), true);
  }
}

async function refreshStaleAvatars(
  organizationId: string,
  connectionRows: Record<string, unknown>[],
  contactRows: Record<string, unknown>[],
  conversationRows: Record<string, unknown>[],
) {
  const fresh = new Map<string, string>();
  const instanceByConnection = new Map(connectionRows.map((row) => [cell(row, "id"), cell(row, "instance_name")]));
  const seen = new Set<string>();
  const jobs: { contactId: string; phone: string; instanceName: string }[] = [];
  for (const conversation of conversationRows) {
    const contactId = cell(conversation, "contact_id");
    if (!contactId || seen.has(contactId)) continue;
    seen.add(contactId);
    const contact = contactRows.find((row) => cell(row, "id") === contactId);
    if (!contact || !avatarStale(contactId, cell(contact, "avatar_checked_at"))) continue;
    const instanceName = instanceByConnection.get(cell(conversation, "connection_id")) ?? "";
    if (!instanceName || !cell(contact, "phone")) continue;
    jobs.push({ contactId, phone: cell(contact, "phone"), instanceName });
    if (jobs.length >= 4) break;
  }
  await Promise.all(
    jobs.map(async (job) => {
      const url = await refreshContactAvatar(job.instanceName, organizationId, job.contactId, job.phone, true);
      if (url !== null) fresh.set(job.contactId, url);
    }),
  );
  return fresh;
}

async function listMessages(instanceName: string) {
  return evo(`/chat/findMessages/${encodeURIComponent(instanceName)}`, "POST", {
    page: 1,
    offset: 40,
  }).catch(() => null);
}

async function importEvolutionMessages(connection: Record<string, unknown>) {
  const instanceName = cell(connection, "instance_name");
  if (!instanceName) return;
  await ensureWebhook(instanceName);
  let listed = await listMessages(instanceName);
  let items = evolutionIncomingMessages(listed);
  if (!items.length) {
    const instances = await evo("/instance/fetchInstances", "GET").catch(() => null);
    const sibling = evolutionSameOwnerInstance(instances, instanceName);
    if (sibling) {
      listed = await listMessages(sibling);
      items = evolutionIncomingMessages(listed);
    }
  }
  const knownLids = rememberLidPhones(items);
  for (const item of items) await storeIncoming(connection, item, knownLids);
}

async function refreshWhatsappName(organizationId: string, contactId: string, phone: string, name: string) {
  const current = await table("chatbot_contacts").select("name, name_edited").eq("id", contactId).eq("organization_id", organizationId).maybeSingle();
  if (current.error || !current.data) return;
  const next = keepWhatsappName(cell(current.data, "name"), cell(current.data, "name_edited") === "true", name, phone);
  if (!next || next === cell(current.data, "name")) return;
  await table("chatbot_contacts").update({ name: next }).eq("id", contactId).eq("organization_id", organizationId);
}

async function contactIdForMessage(organizationId: string, phone: string, name: string) {
  const known = await rows(table("chatbot_contacts").select("id, phone").eq("organization_id", organizationId));
  const found = known.find((row) => cell(row, "phone") === phone || sameWhatsappAccount(cell(row, "phone"), phone));
  if (found) {
    await refreshWhatsappName(organizationId, cell(found, "id"), phone, name);
    return cell(found, "id");
  }
  const created = await table("chatbot_contacts")
    .insert({ organization_id: organizationId, name, phone })
    .select("id")
    .maybeSingle();
  if (created.data) return cell(created.data, "id");
  if (!duplicate(created.error)) return "";
  const again = await rows(table("chatbot_contacts").select("id, phone").eq("organization_id", organizationId));
  const retry = again.find((row) => cell(row, "phone") === phone || sameWhatsappAccount(cell(row, "phone"), phone));
  return cell(retry, "id");
}

async function storeIncoming(connection: Record<string, unknown>, data: unknown, knownLids: Record<string, string> = {}) {
  const record = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;
  const rawKey = record["key"];
  const key = (rawKey && typeof rawKey === "object" ? rawKey : {}) as Record<string, unknown>;
  if (key["fromMe"] === true) return;
  const phone = incomingPhone(key, knownLids);
  const externalId = cell(key, "id");
  const content = evolutionMessageContent(record);
  const text = content.mediaKind ? content.text : evolutionMessageText(record["message"]);
  if (!phone || !externalId || (!text && !content.mediaKind)) return;
  const organizationId = cell(connection, "organization_id");
  const name = cell(record, "pushName") || phone;
  const contactId = await contactIdForMessage(organizationId, phone, name);
  if (!contactId) return;
  const botsDisabled = await contactBotsDisabled(organizationId, contactId);
  const existingConversation = await table("chatbot_conversations")
    .select("id")
    .eq("connection_id", cell(connection, "id"))
    .eq("contact_id", contactId)
    .maybeSingle();
  let conversationId = cell(existingConversation.data, "id");
  if (!conversationId) {
    const created = await table("chatbot_conversations")
      .insert({
        organization_id: organizationId,
        contact_id: contactId,
        connection_id: cell(connection, "id"),
        status: "queue",
        bot_paused: botsDisabled,
      })
      .select("id")
      .maybeSingle();
    if (created.error || !created.data) {
      if (!duplicate(created.error)) return;
      const again = await table("chatbot_conversations")
        .select("id")
        .eq("connection_id", cell(connection, "id"))
        .eq("contact_id", contactId)
        .maybeSingle();
      conversationId = cell(again.data, "id");
      if (!conversationId) return;
    } else {
      conversationId = cell(created.data, "id");
    }
  }
  const messageRow = {
    organization_id: organizationId,
    conversation_id: conversationId,
    text,
    direction: "in",
    status: "sent",
    external_id: externalId,
  };
  const saved = await table("chatbot_messages")
    .insert(content.mediaKind ? { ...messageRow, media_kind: content.mediaKind, media_mime: content.mediaMime } : messageRow)
    .select("id")
    .maybeSingle();
  let inserted = !saved.error;
  if (saved.error && duplicate(saved.error)) {
    if (content.mediaKind) {
      await table("chatbot_messages")
        .update({ media_kind: content.mediaKind, media_mime: content.mediaMime, text })
        .eq("conversation_id", conversationId)
        .eq("external_id", externalId);
    }
  } else if (saved.error && content.mediaKind && /media_kind|media_mime/i.test(saved.error.message)) {
    const retry = await table("chatbot_messages")
      .insert({ ...messageRow, text: text || (content.mediaKind === "video" ? "[vídeo]" : content.mediaKind === "audio" ? "[áudio]" : "[imagem]") })
      .select("id")
      .maybeSingle();
    if (retry.error && !duplicate(retry.error)) return;
    inserted = !retry.error;
  } else if (saved.error) {
    return;
  }
  if (!inserted) return;
  const scored = content.mediaKind ? false : await acceptRatingReply(organizationId, conversationId, contactId, text);
  await table("chatbot_conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", conversationId);
  if (scored) {
    await thankForRating(connection, organizationId, conversationId, contactId);
    return;
  }
  if (botsDisabled) {
    await table("chatbot_conversations").update({ bot_paused: true }).eq("id", conversationId).eq("organization_id", organizationId);
  }
  await returnClosedToQueue(organizationId, conversationId);
  if (!botsDisabled) await resumeDueFlows(organizationId, conversationId);
  const flowReplied = botsDisabled ? false : await runIncomingFlow(connection, organizationId, conversationId, contactId, text);
  if (!botsDisabled && !flowReplied) await noticeOfflineWaiting(connection, organizationId, conversationId, contactId);
}

async function thankForRating(connection: Record<string, unknown>, organizationId: string, conversationId: string, contactId: string) {
  try {
    if (cell(connection, "status") !== "connected") return;
    const contact = await table("chatbot_contacts").select("phone").eq("id", contactId).eq("organization_id", organizationId).maybeSingle();
    const phone = cell(contact.data, "phone");
    if (!phone) return;
    const text = "Obrigado pela sua avaliação.";
    const sent = await evo(`/message/sendText/${encodeURIComponent(cell(connection, "instance_name"))}`, "POST", { number: phone, text });
    await table("chatbot_messages")
      .insert({
        organization_id: organizationId,
        conversation_id: conversationId,
        text,
        direction: "out",
        status: "sent",
        external_id: readMessageId(sent) || null,
      })
      .select("id")
      .maybeSingle();
  } catch {
    return;
  }
}

async function returnClosedToQueue(organizationId: string, conversationId: string) {
  const current = await table("chatbot_conversations").select("status, closed_at, contact_id").eq("id", conversationId).eq("organization_id", organizationId).maybeSingle();
  if (current.error && !/closed_at/i.test(current.error.message)) return;
  if (!current.error && cell(current.data, "status") !== "closed") return;
  const settings = await table("organizations").select("chatbot_reactivation_minutes").eq("id", organizationId).maybeSingle();
  const minutes = settings.error ? 15 : reactivationMinutes(settings.data?.["chatbot_reactivation_minutes"]);
  const reopen = !current.error && reactivatesClosedConversation(cell(current.data, "closed_at"), minutes, Date.now());
  const botsDisabled = await contactBotsDisabled(organizationId, cell(current.data, "contact_id"));
  const stamped = new Date().toISOString();
  const patch: Record<string, unknown> = {
    status: "queue",
    queued_at: stamped,
    bot_paused: keepAttendanceBotsPaused(botsDisabled, reopen),
    closed_at: null,
    offline_notified_at: null,
  };
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const updated = await (table("chatbot_conversations").update(patch).eq("id", conversationId).eq("status", "closed").select("id").maybeSingle());
    if (!updated.error) return;
    const missing = updated.error.message.match(/queued_at|bot_paused|closed_at|offline_notified_at/i);
    if (!missing) return;
    const key = missing[0].toLowerCase();
    if (!(key in patch)) return;
    delete patch[key];
  }
}

async function noticeOfflineWaiting(connection: Record<string, unknown>, organizationId: string, conversationId: string, contactId: string) {
  try {
    const current = await table("chatbot_conversations").select("status, assignee_id, offline_notified_at").eq("id", conversationId).eq("organization_id", organizationId).maybeSingle();
    if (current.error || cell(current.data, "status") !== "queue" || cell(current.data, "assignee_id") || cell(current.data, "offline_notified_at")) return;
    const settings = await table("organizations").select("chatbot_offline_message_enabled, chatbot_offline_message").eq("id", organizationId).maybeSingle();
    if (settings.error || settings.data?.["chatbot_offline_message_enabled"] !== true) return;
    const text = offlineNoticeText(settings.data?.["chatbot_offline_message"]) || defaultOfflineNotice;
    if (!(await teamMembersOffline(organizationId))) return;
    if (cell(connection, "status") !== "connected") return;
    const contact = await table("chatbot_contacts").select("phone").eq("id", contactId).eq("organization_id", organizationId).maybeSingle();
    const phone = cell(contact.data, "phone");
    if (!phone) return;
    const sent = await evo(`/message/sendText/${encodeURIComponent(cell(connection, "instance_name"))}`, "POST", { number: phone, text });
    await table("chatbot_messages")
      .insert({
        organization_id: organizationId,
        conversation_id: conversationId,
        text,
        direction: "out",
        status: "sent",
        external_id: readMessageId(sent) || null,
      })
      .select("id")
      .maybeSingle();
    await table("chatbot_conversations")
      .update({ offline_notified_at: new Date().toISOString() })
      .eq("id", conversationId)
      .eq("organization_id", organizationId)
      .select("id")
      .maybeSingle();
  } catch {
    return;
  }
}

async function ownedConnection(organizationId: string, connectionId: string) {
  const current = await table("chatbot_connections")
    .select("*")
    .eq("id", connectionId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (current.error) fail(schemaMessage(current.error.message));
  if (!current.data) fail("Essa conexão não pertence à sua empresa.");
  return current.data;
}

async function rows(query: Query) {
  const result = await (query as unknown as Promise<{ data: Record<string, unknown>[] | null; error: DbError | null }>);
  if (result.error) fail(schemaMessage(result.error.message));
  return result.data ?? [];
}

async function rowsOrMissing(query: Query) {
  const result = await (query as unknown as Promise<{ data: Record<string, unknown>[] | null; error: DbError | null }>);
  if (result.error) {
    if (/schema cache|does not exist|PGRST205/i.test(result.error.message)) return { rows: [] as Record<string, unknown>[], missing: true };
    fail(schemaMessage(result.error.message));
  }
  return { rows: result.data ?? [], missing: false };
}

async function done(query: Query) {
  const result = await (query as unknown as Promise<{ error: DbError | null }>);
  if (result.error) fail(schemaMessage(result.error.message));
}

async function savedMessageIds(organizationId: string) {
  const result = await (table("chatbot_contact_files").select("message_id").eq("organization_id", organizationId) as unknown as Promise<{
    data: Record<string, unknown>[] | null;
    error: DbError | null;
  }>);
  if (result.error) {
    if (/chatbot_contact_files|schema cache|does not exist|PGRST/i.test(result.error.message)) return new Set<string>();
    fail(schemaMessage(result.error.message));
  }
  return new Set((result.data ?? []).map((row) => cell(row, "message_id")).filter(Boolean));
}

const mediaFileCache = new Map<string, { at: number; mime: string; base64: string; kind: "image" | "video" | "audio" }>();

async function ownedChatMessage(userId: string, messageId: string) {
  const { organizationId, admin } = await membership(userId, "inbox");
  const message = await table("chatbot_messages").select("*").eq("id", messageId).eq("organization_id", organizationId).maybeSingle();
  if (message.error) fail(schemaMessage(message.error.message));
  if (!message.data) fail("Essa mensagem não pertence à sua empresa.");
  const conversation = await table("chatbot_conversations")
    .select("*")
    .eq("id", cell(message.data, "conversation_id"))
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (conversation.error) fail(schemaMessage(conversation.error.message));
  if (!conversation.data) fail("Essa conversa não pertence à sua empresa.");
  const connection = await ownedConnection(organizationId, cell(conversation.data, "connection_id"));
  if (!admin) {
    const allowed = await teamConnectionIds(userId, organizationId);
    if (!allowed.has(cell(connection, "id"))) fail("Essa conversa não pertence a uma equipe sua.");
    const assignee = cell(conversation.data, "assignee_id");
    if (assignee && assignee !== userId) fail("Essa conversa está com outro atendente.");
  }
  return { organizationId, message: message.data, conversation: conversation.data, connection };
}

async function fetchEvolutionMedia(instanceName: string, externalId: string, kind: "image" | "video" | "audio") {
  if (!instanceName || !externalId) return null;
  const cacheKey = `${instanceName}:${externalId}:${kind}`;
  const cached = mediaFileCache.get(cacheKey);
  if (cached && Date.now() - cached.at < 10 * 60 * 1000) return cached;
  const payload = await evo(
    `/chat/getBase64FromMediaMessage/${encodeURIComponent(instanceName)}`,
    "POST",
    { message: { key: { id: externalId } }, convertToMp4: kind === "video" },
    60000,
  );
  let file = evolutionMediaFile(payload, kind === "image" ? "" : kind);
  if (kind === "video" && file.kind === "video" && file.mime !== "video/mp4" && file.mime !== "video/webm") {
    const converted = await evo(
      `/chat/getBase64FromMediaMessage/${encodeURIComponent(instanceName)}`,
      "POST",
      { message: { key: { id: externalId } }, convertToMp4: true },
      60000,
    );
    const next = evolutionMediaFile(converted, "video");
    if (next.kind) file = next;
  }
  if (!file.kind) return null;
  const stored = { at: Date.now(), mime: file.mime, base64: file.base64, kind: file.kind };
  mediaFileCache.set(cacheKey, stored);
  return stored;
}

function mediaPlaceholder(text: string) {
  return text === "[mensagem]" || text === "[imagem]" || text === "[vídeo]" || text === "[áudio]";
}

function storedMediaKind(value: string, text: string): "image" | "video" | "audio" | "" {
  if (value === "video" || text === "[vídeo]") return "video";
  if (value === "audio" || text === "[áudio]") return "audio";
  if (value === "image" || text === "[imagem]" || text === "[mensagem]") return "image";
  return "";
}

export async function chatbotMessageMedia(userId: string, messageId: string) {
  const owned = await ownedChatMessage(userId, messageId);
  const text = cell(owned.message, "text");
  const hinted = storedMediaKind(cell(owned.message, "media_kind"), text);
  if (!hinted && !mediaPlaceholder(text)) fail("Essa mensagem não tem mídia.");
  let file: { mime: string; base64: string; kind: "image" | "video" | "audio" } | null = null;
  try {
    file = await fetchEvolutionMedia(cell(owned.connection, "instance_name"), cell(owned.message, "external_id"), hinted || "image");
  } catch {
    file = null;
  }
  if (!file) {
    if (!hinted && mediaPlaceholder(text)) return { kind: "" as const, mime: "", base64: "" };
    fail("Não foi possível abrir essa mídia.");
  }
  return { kind: file.kind, mime: file.mime, base64: file.base64 };
}

const mediaBucket = "nex-chatbot-media";
const mediaMimeTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/3gpp",
  "audio/ogg",
  "audio/mpeg",
  "audio/mp4",
  "audio/webm",
  "audio/aac",
  "audio/opus",
  "audio/wav",
];

async function ensureMediaBucket() {
  const options = { public: false, fileSizeLimit: 40 * 1024 * 1024, allowedMimeTypes: mediaMimeTypes };
  const existing = await supabaseAdmin.storage.getBucket(mediaBucket);
  if (!existing.error && existing.data) {
    await supabaseAdmin.storage.updateBucket(mediaBucket, options).catch(() => undefined);
    return;
  }
  const created = await supabaseAdmin.storage.createBucket(mediaBucket, options);
  if (created.error && !/already exists|duplicate/i.test(created.error.message)) fail("Não foi possível guardar a mídia.");
}

export async function saveChatbotContactMedia(userId: string, messageId: string) {
  const owned = await ownedChatMessage(userId, messageId);
  const contactId = cell(owned.conversation, "contact_id");
  const existing = await table("chatbot_contact_files").select("id").eq("organization_id", owned.organizationId).eq("message_id", messageId).maybeSingle();
  if (existing.error) fail(schemaMessage(existing.error.message));
  if (existing.data) return { saved: true as const };
  const text = cell(owned.message, "text");
  const kind = storedMediaKind(cell(owned.message, "media_kind"), text);
  const file = await fetchEvolutionMedia(cell(owned.connection, "instance_name"), cell(owned.message, "external_id"), kind || "image");
  if (!file) fail("Não foi possível salvar essa mídia.");
  await ensureMediaBucket();
  const id = crypto.randomUUID();
  const extension = file.mime.includes("png")
    ? "png"
    : file.mime.includes("webp")
      ? "webp"
      : file.mime.includes("gif")
        ? "gif"
        : file.kind === "video"
          ? "mp4"
          : file.kind === "audio"
            ? file.mime.includes("mpeg")
              ? "mp3"
              : "ogg"
            : "jpg";
  const storagePath = `${owned.organizationId}/${contactId}/${id}.${extension}`;
  const contentType = file.mime.split(";")[0]?.trim().toLowerCase() || (file.kind === "audio" ? "audio/ogg" : file.kind === "video" ? "video/mp4" : "image/jpeg");
  const uploaded = await supabaseAdmin.storage.from(mediaBucket).upload(storagePath, Buffer.from(file.base64, "base64"), {
    contentType,
    upsert: false,
  });
  if (uploaded.error) fail("Não foi possível salvar a mídia no contato.");
  const inserted = await table("chatbot_contact_files")
    .insert({
      id,
      organization_id: owned.organizationId,
      contact_id: contactId,
      message_id: messageId,
      name: file.kind === "video" ? `video.${extension}` : file.kind === "audio" ? `audio.${extension}` : `imagem.${extension}`,
      mime_type: contentType,
      storage_path: storagePath,
    })
    .select("id")
    .maybeSingle();
  if (inserted.error) {
    await supabaseAdmin.storage.from(mediaBucket).remove([storagePath]);
    fail(schemaMessage(inserted.error.message));
  }
  return { saved: true as const };
}

function readState(payload: unknown) {
  if (!payload || typeof payload !== "object") return "";
  const record = payload as Record<string, unknown>;
  const instance = record["instance"];
  if (instance && typeof instance === "object") {
    const state = (instance as Record<string, unknown>)["state"];
    if (typeof state === "string") return state;
  }
  const state = record["state"];
  if (typeof state === "string") return state;
  const status = record["status"];
  if (typeof status === "string") return status;
  return "";
}

function readMessageId(payload: unknown) {
  if (!payload || typeof payload !== "object") return "";
  const key = (payload as Record<string, unknown>)["key"];
  if (!key || typeof key !== "object") return "";
  const id = (key as Record<string, unknown>)["id"];
  return typeof id === "string" ? id : "";
}

async function teamConnectionIds(userId: string, organizationId: string) {
  const [members, loaded] = await Promise.all([
    rows(table("chatbot_team_members").select("team_id, user_id").eq("organization_id", organizationId)),
    teamChannelRows(organizationId),
  ]);
  const mine = new Set(members.filter((row) => cell(row, "user_id") === userId).map((row) => cell(row, "team_id")));
  return new Set(
    loaded.teams
      .filter((row) => mine.has(cell(row, "id")))
      .flatMap((row) => channelsOfTeam(cell(row, "id"), cell(row, "connection_id"), loaded.links)),
  );
}

async function ownedTeams(organizationId: string, teamIds: string[]) {
  const teams = await rows(table("chatbot_teams").select("id").eq("organization_id", organizationId));
  const known = new Set(teams.map((row) => cell(row, "id")));
  if (!teamIds.length || teamIds.some((id) => !known.has(id))) fail("Selecione uma equipe desta empresa.");
}

export async function chatbotTeamSnapshot(userId: string) {
  const { organizationId } = await membership(userId, "team");
  const [teams, members, channels, profiles, links] = await Promise.all([
    rows(table("chatbot_teams").select("*").eq("organization_id", organizationId).order("created_at", { ascending: true })),
    rows(table("chatbot_team_members").select("team_id, user_id").eq("organization_id", organizationId)),
    rows(table("chatbot_connections").select("id, display_name, phone").eq("organization_id", organizationId).order("created_at", { ascending: true })),
    supabaseAdmin.from("profiles").select("id, full_name, email").eq("organization_id", organizationId).order("full_name", { ascending: true }),
    rowsOrMissing(table("chatbot_team_channels").select("team_id, connection_id").eq("organization_id", organizationId)),
  ]);
  if (profiles.error) fail(schemaMessage(profiles.error.message));
  const profileIds = (profiles.data ?? []).map((row) => row.id);
  const roles = profileIds.length
    ? await supabaseAdmin.from("user_roles").select("user_id, role").in("user_id", profileIds)
    : { data: [], error: null };
  if (roles.error) fail(schemaMessage(roles.error.message));
  const attendants = new Set((roles.data ?? []).filter((row) => row.role === "client_user").map((row) => row.user_id));
  const owners = new Set((roles.data ?? []).filter((row) => row.role === "master" || row.role === "client_admin").map((row) => row.user_id));
  const memberIds = new Set(members.map((member) => cell(member, "user_id")));
  const listedOwners = new Set([...owners].filter((id) => memberIds.has(id)));
  const attendantIds = [...new Set([...attendants, ...listedOwners])];
  const permissionRows = attendantIds.length
    ? await supabaseAdmin.from("user_permissions").select("user_id, chatbot_menus").in("user_id", attendantIds)
    : { data: [], error: null };
  if (permissionRows.error && !/chatbot_menus/i.test(permissionRows.error.message)) fail(schemaMessage(permissionRows.error.message));
  const menuByUser = new Map((permissionRows.error ? [] : permissionRows.data ?? []).map((row) => [row.user_id, row.chatbot_menus]));
  const channelName = new Map(channels.map((row) => [cell(row, "id"), { name: cell(row, "display_name"), phone: cell(row, "phone") }]));
  const account = (profiles.data ?? []).find((row) => row.id === userId);
  return {
    account: { id: userId, name: account?.full_name?.trim() ?? "", email: account?.email ?? "" },
    canAddMyself: owners.has(userId) && !listedOwners.has(userId),
    channels: channels.map((row) => ({ id: cell(row, "id"), name: cell(row, "display_name"), phone: cell(row, "phone") })),
    teams: teams.map((row) => {
      const connectionIds = channelsOfTeam(cell(row, "id"), cell(row, "connection_id"), links);
      const named = connectionIds.map((id) => channelName.get(id)).filter((channel): channel is { name: string; phone: string } => Boolean(channel));
      return {
        id: cell(row, "id"),
        name: cell(row, "name"),
        connectionId: connectionIds[0] ?? "",
        connectionIds,
        channelName: named.map((channel) => channel.name).join(", "),
        channelPhone: named.length === 1 ? named[0]?.phone ?? "" : "",
      };
    }),
    attendants: (profiles.data ?? [])
      .filter((row) => attendants.has(row.id) || listedOwners.has(row.id))
      .map((row) => ({
        id: row.id,
        name: row.full_name,
        email: row.email,
        self: listedOwners.has(row.id),
        teamIds: members.filter((member) => cell(member, "user_id") === row.id).map((member) => cell(member, "team_id")),
        menus: chatbotMenusFromStorage(menuByUser.get(row.id) ?? null),
      })),
  };
}

export async function createChatbotTeam(userId: string, name: string, connectionId: string) {
  const clean = name.trim();
  if (clean.length < 2) fail("Informe o nome da equipe.");
  if (clean.length > 40) fail("O nome da equipe pode ter no máximo 40 caracteres.");
  const { organizationId, admin } = await membership(userId, "team");
  if (!admin) fail("Somente o administrador da empresa pode criar uma equipe.");
  await ownedConnection(organizationId, connectionId);
  const inserted = await table("chatbot_teams")
    .insert({ organization_id: organizationId, name: clean, connection_id: connectionId })
    .select("id")
    .maybeSingle();
  if (inserted.error) {
    if (duplicate(inserted.error)) fail("Já existe uma equipe com esse nome.");
    fail(schemaMessage(inserted.error.message));
  }
  if (inserted.data) await rememberTeamChannel(organizationId, cell(inserted.data, "id"), connectionId);
}

export async function deleteChatbotTeam(userId: string, teamId: string) {
  const { organizationId, admin } = await membership(userId, "team");
  if (!admin) fail("Somente o administrador da empresa pode excluir uma equipe.");
  const current = await table("chatbot_teams").select("id").eq("id", teamId).eq("organization_id", organizationId).maybeSingle();
  if (current.error) fail(schemaMessage(current.error.message));
  if (!current.data) fail("Essa equipe não pertence à sua empresa.");
  await done(table("chatbot_teams").delete().eq("id", teamId).eq("organization_id", organizationId));
}

export async function updateChatbotTeam(userId: string, teamId: string, name: string, connectionId: string) {
  const clean = name.trim();
  if (clean.length < 2) fail("Informe o nome da equipe.");
  if (clean.length > 40) fail("O nome da equipe pode ter no máximo 40 caracteres.");
  const { organizationId, admin } = await membership(userId, "team");
  if (!admin) fail("Somente o administrador da empresa pode editar uma equipe.");
  await ownedConnection(organizationId, connectionId);
  const current = await table("chatbot_teams").select("id").eq("id", teamId).eq("organization_id", organizationId).maybeSingle();
  if (current.error) fail(schemaMessage(current.error.message));
  if (!current.data) fail("Essa equipe não pertence à sua empresa.");
  const updated = await table("chatbot_teams")
    .update({ name: clean, connection_id: connectionId })
    .eq("id", teamId)
    .eq("organization_id", organizationId)
    .select("id")
    .maybeSingle();
  if (updated.error) {
    if (duplicate(updated.error)) fail("Já existe uma equipe com esse nome.");
    fail(schemaMessage(updated.error.message));
  }
  await rememberTeamChannel(organizationId, teamId, connectionId);
}

export async function resendAttendantInvite(userId: string, email: string, name: string) {
  const { organizationId, admin } = await membership(userId, "team");
  if (!admin) fail("Somente o administrador da empresa pode reenviar o convite.");
  const address = email.trim().toLowerCase();
  const profile = await supabaseAdmin.from("profiles").select("id, email, full_name").eq("email", address).eq("organization_id", organizationId).maybeSingle();
  if (profile.error) fail(schemaMessage(profile.error.message));
  if (!profile.data) fail("Esse atendente não pertence à sua empresa.");
  await ownedAttendant(organizationId, profile.data.id);
  const { sendInviteEmail } = await import("@/server/mail.server");
  await sendInviteEmail(profile.data.email, name.trim() || profile.data.full_name);
}

export async function addMyselfAsChatbotAttendant(userId: string, teamIds: string[], menusInput: unknown) {
  const menus = attendantMenus(menusInput);
  const uniqueTeams = [...new Set(teamIds.map((id) => id.trim()).filter(Boolean))];
  if (!uniqueTeams.length) fail("Selecione ao menos uma equipe.");
  const { organizationId, admin } = await membership(userId, "team");
  if (!admin) fail("Somente o administrador da empresa pode se adicionar como atendente.");
  const profile = await supabaseAdmin.from("profiles").select("id, full_name, email").eq("id", userId).eq("organization_id", organizationId).maybeSingle();
  if (profile.error) fail(schemaMessage(profile.error.message));
  if (!profile.data) fail("Sua conta não pertence a esta empresa.");
  if ((profile.data.full_name ?? "").trim().length < 2) fail("Informe o nome completo em Dados da conta antes de se adicionar.");
  await ownedTeams(organizationId, uniqueTeams);
  await setMemberTeams(organizationId, userId, uniqueTeams, true);
  await saveAttendantMenus(userId, menus);
}

export async function inviteChatbotAttendant(userId: string, name: string, email: string, teamIds: string[], menusInput: unknown) {
  const menus = attendantMenus(menusInput);
  const uniqueTeams = [...new Set(teamIds.map((id) => id.trim()).filter(Boolean))];
  const { organizationId, admin } = await membership(userId, "team");
  if (!admin) fail("Somente o administrador da empresa pode convidar um atendente.");
  await ownedTeams(organizationId, uniqueTeams);
  const attendant = await createOrganizationAttendant(userId, name, email);
  await setMemberTeams(organizationId, attendant.id, uniqueTeams, false);
  await saveAttendantMenus(attendant.id, menus);
  return { created: attendant.created, emailSent: attendant.emailSent, mailError: attendant.mailError };
}

export async function setChatbotAttendantTeams(userId: string, attendantId: string, teamIds: string[]) {
  const uniqueTeams = [...new Set(teamIds.map((id) => id.trim()).filter(Boolean))];
  const { organizationId, admin } = await membership(userId, "team");
  if (!admin) fail("Somente o administrador da empresa pode alterar as equipes.");
  await ownedTeams(organizationId, uniqueTeams);
  await ownedAttendant(organizationId, attendantId);
  await setMemberTeams(organizationId, attendantId, uniqueTeams, true);
}

export async function updateChatbotAttendant(userId: string, attendantId: string, name: string, email: string, teamIds: string[], menusInput: unknown) {
  const uniqueTeams = [...new Set(teamIds.map((id) => id.trim()).filter(Boolean))];
  const clean = name.trim();
  const address = email.trim().toLowerCase();
  if (clean.length < 2) fail("Informe o nome.");
  if (!address.includes("@")) fail("Informe um e-mail válido.");
  const menus = attendantMenus(menusInput);
  const { organizationId, admin } = await membership(userId, "team");
  if (!admin) fail("Somente o administrador da empresa pode editar um atendente.");
  await ownedTeams(organizationId, uniqueTeams);
  if (attendantId === userId) {
    await setMemberTeams(organizationId, userId, uniqueTeams, true);
    await saveAttendantMenus(userId, menus);
    return;
  }
  const attendant = await ownedAttendant(organizationId, attendantId);
  const taken = await supabaseAdmin.from("profiles").select("id").eq("email", address).maybeSingle();
  if (taken.error) fail(schemaMessage(taken.error.message));
  if (taken.data && taken.data.id !== attendantId) fail("Já existe um acesso com este e-mail.");
  const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(attendantId, { email: address, email_confirm: true });
  if (authError) fail(/already|registered|exists/i.test(authError.message) ? "Já existe um acesso com este e-mail." : "Não foi possível atualizar o acesso.");
  const { error } = await supabaseAdmin.from("profiles").update({ full_name: clean, email: address }).eq("id", attendantId).eq("organization_id", organizationId);
  if (error) fail(schemaMessage(error.message));
  await setMemberTeams(organizationId, attendant.id, uniqueTeams, true);
  await saveAttendantMenus(attendantId, menus);
}

export async function deleteChatbotAttendant(userId: string, attendantId: string) {
  const { organizationId, admin } = await membership(userId, "team");
  if (!admin) fail("Somente o administrador da empresa pode excluir um atendente.");
  const roles = await supabaseAdmin.from("user_roles").select("role").eq("user_id", attendantId);
  if (roles.error) fail(schemaMessage(roles.error.message));
  const owner = (roles.data ?? []).some((row) => row.role === "master" || row.role === "client_admin");
  if (owner) {
    if (attendantId !== userId) fail("O acesso do administrador não pode ser excluído.");
    await done(table("chatbot_conversations").update({ assignee_id: null }).eq("assignee_id", userId).eq("organization_id", organizationId));
    await done(table("chatbot_team_members").delete().eq("user_id", userId).eq("organization_id", organizationId));
    return;
  }
  if (attendantId === userId) fail("Você não pode excluir o próprio acesso.");
  await ownedAttendant(organizationId, attendantId);
  const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(attendantId);
  if (authError) fail("Não foi possível excluir o acesso.");
  await done(table("chatbot_conversations").update({ assignee_id: null }).eq("assignee_id", attendantId).eq("organization_id", organizationId));
  await done(table("chatbot_team_members").delete().eq("user_id", attendantId).eq("organization_id", organizationId));
  await supabaseAdmin.from("user_permissions").delete().eq("user_id", attendantId);
  await supabaseAdmin.from("user_roles").delete().eq("user_id", attendantId);
  const { error: profileError } = await supabaseAdmin.from("profiles").delete().eq("id", attendantId).eq("organization_id", organizationId);
  if (profileError) fail(schemaMessage(profileError.message));
}

async function ownedAttendant(organizationId: string, attendantId: string) {
  const [profile, roles] = await Promise.all([
    supabaseAdmin.from("profiles").select("id").eq("id", attendantId).eq("organization_id", organizationId).maybeSingle(),
    supabaseAdmin.from("user_roles").select("role").eq("user_id", attendantId),
  ]);
  if (profile.error) fail(schemaMessage(profile.error.message));
  if (roles.error) fail(schemaMessage(roles.error.message));
  if (!profile.data) fail("Esse atendente não pertence à sua empresa.");
  const list = roles.data ?? [];
  if (list.some((row) => row.role === "master" || row.role === "client_admin") || !list.some((row) => row.role === "client_user")) {
    fail("Esse acesso não é de um atendente.");
  }
  return profile.data;
}

async function ownedContact(organizationId: string, contactId: string) {
  const contact = await table("chatbot_contacts").select("id, name, phone").eq("id", contactId).eq("organization_id", organizationId).maybeSingle();
  if (contact.error) fail(schemaMessage(contact.error.message));
  if (!contact.data) fail("Esse contato não pertence à sua empresa.");
  return contact.data;
}

async function contactBotsDisabled(organizationId: string, contactId: string) {
  if (!contactId) return false;
  const contact = await table("chatbot_contacts").select("bots_disabled").eq("id", contactId).eq("organization_id", organizationId).maybeSingle();
  if (contact.error) return false;
  return contact.data?.["bots_disabled"] === true;
}

function uniqueIds(ids: string[]) {
  return [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
}

async function replaceContactLinks(
  linkTable: "chatbot_contact_tags" | "chatbot_contact_products",
  column: "tag_id" | "product_id",
  catalogTable: "chatbot_tags" | "chatbot_products",
  organizationId: string,
  contactId: string,
  ids: string[],
) {
  const catalog = await rows(table(catalogTable).select("id").eq("organization_id", organizationId));
  const known = new Set(catalog.map((row) => cell(row, "id")));
  const unique = uniqueIds(ids).filter((id) => known.has(id));
  await done(table(linkTable).delete().eq("contact_id", contactId).eq("organization_id", organizationId));
  for (const id of unique) {
    const inserted = await table(linkTable)
      .insert({ contact_id: contactId, [column]: id, organization_id: organizationId })
      .select("contact_id")
      .maybeSingle();
    if (inserted.error && !duplicate(inserted.error)) fail(schemaMessage(inserted.error.message));
  }
}

export async function chatbotContactProfile(userId: string, contactId: string): Promise<ChatbotContactProfile> {
  const { organizationId } = await membership(userId, "inbox");
  const contact = await ownedContact(organizationId, contactId);
  const [tags, products, tagLinks, productLinks, files] = await Promise.all([
    rowsOrMissing(table("chatbot_tags").select("id, name, color").eq("organization_id", organizationId).order("name", { ascending: true })),
    rowsOrMissing(table("chatbot_products").select("id, name").eq("organization_id", organizationId).order("name", { ascending: true })),
    rowsOrMissing(table("chatbot_contact_tags").select("tag_id").eq("contact_id", contactId).eq("organization_id", organizationId)),
    rowsOrMissing(table("chatbot_contact_products").select("product_id").eq("contact_id", contactId).eq("organization_id", organizationId)),
    rows(table("chatbot_contact_files").select("id, name, mime_type, storage_path, created_at").eq("contact_id", contactId).eq("organization_id", organizationId).order("created_at", { ascending: false })),
  ]);
  const selectedTags = new Set(tagLinks.rows.map((row) => cell(row, "tag_id")));
  const selectedProducts = new Set(productLinks.rows.map((row) => cell(row, "product_id")));
  const listedStages = await listChatbotStages(userId);
  const stageRow = await table("chatbot_contacts").select("stage_name").eq("id", contactId).eq("organization_id", organizationId).maybeSingle();
  const dealRow = await table("chatbot_contacts").select("negotiated_cents, client_owner_id").eq("id", contactId).eq("organization_id", organizationId).maybeSingle();
  let dealReady = true;
  let negotiated: number | null = null;
  let clientOwnerId = "";
  if (dealRow.error) {
    if (/negotiated_cents|client_owner_id|schema cache|does not exist|PGRST205/i.test(dealRow.error.message)) dealReady = false;
    else fail(schemaMessage(dealRow.error.message));
  } else {
    const raw = dealRow.data?.["negotiated_cents"];
    const amount = raw == null || raw === "" ? null : Number(raw);
    negotiated = amount != null && Number.isFinite(amount) ? Math.trunc(amount) : null;
    clientOwnerId = cell(dealRow.data, "client_owner_id");
  }
  let stageReady = listedStages.ready;
  let stage = "";
  if (stageRow.error) {
    if (/stage_name|schema cache|does not exist|PGRST205/i.test(stageRow.error.message)) stageReady = false;
    else fail(schemaMessage(stageRow.error.message));
  } else {
    stage = cell(stageRow.data, "stage_name");
  }
  const savedFiles = await Promise.all(
    files.map(async (row) => {
      const storagePath = cell(row, "storage_path");
      const signed = storagePath ? await supabaseAdmin.storage.from(mediaBucket).createSignedUrl(storagePath, 60 * 30) : null;
      return {
        id: cell(row, "id"),
        name: cell(row, "name"),
        mime: cell(row, "mime_type"),
        createdAt: cell(row, "created_at"),
        url: signed?.data?.signedUrl ?? "",
      };
    }),
  );
  return {
    id: cell(contact, "id"),
    name: cell(contact, "name"),
    phone: cell(contact, "phone"),
    catalogReady: !tags.missing && !products.missing && !tagLinks.missing && !productLinks.missing,
    stageReady,
    stage: stageReady ? stage : "",
    stages: stageReady ? listedStages.stages.map((item) => item.name) : [],
    tags: tags.rows.map((row) => ({
      id: cell(row, "id"),
      name: cell(row, "name"),
      color: cell(row, "color"),
      selected: selectedTags.has(cell(row, "id")),
    })),
    products: products.rows.map((row) => ({
      id: cell(row, "id"),
      name: cell(row, "name"),
      selected: selectedProducts.has(cell(row, "id")),
    })),
    files: savedFiles,
    dealReady,
    negotiatedCents: dealReady ? negotiated : null,
    clientOwnerId: dealReady ? clientOwnerId : "",
  };
}

export async function setChatbotContactDeal(userId: string, contactId: string, cents: number | null) {
  if (cents != null && (!Number.isInteger(cents) || cents < 0 || cents > 9999999999999)) fail("Informe um valor negociado válido.");
  const { organizationId } = await membership(userId, "inbox");
  await ownedContact(organizationId, contactId);
  const updated = await table("chatbot_contacts")
    .update({ negotiated_cents: cents })
    .eq("id", contactId)
    .eq("organization_id", organizationId)
    .select("id")
    .maybeSingle();
  if (updated.error) fail(schemaMessage(updated.error.message));
  if (!updated.data) fail("Esse contato não pertence à sua empresa.");
  return { cents };
}

export async function registerChatbotClient(userId: string, contactId: string) {
  const { organizationId } = await membership(userId, "inbox");
  await ownedContact(organizationId, contactId);
  const current = await table("chatbot_contacts").select("client_owner_id").eq("id", contactId).eq("organization_id", organizationId).maybeSingle();
  if (current.error) fail(schemaMessage(current.error.message));
  const ownerId = cell(current.data, "client_owner_id");
  if (ownerId) return { ownerId };
  const updated = await table("chatbot_contacts")
    .update({ client_owner_id: userId, client_registered_at: new Date().toISOString() })
    .eq("id", contactId)
    .eq("organization_id", organizationId)
    .is("client_owner_id", null)
    .select("client_owner_id")
    .maybeSingle();
  if (updated.error) fail(schemaMessage(updated.error.message));
  if (!updated.data) {
    const again = await table("chatbot_contacts").select("client_owner_id").eq("id", contactId).eq("organization_id", organizationId).maybeSingle();
    if (again.error) fail(schemaMessage(again.error.message));
    const kept = cell(again.data, "client_owner_id");
    if (!kept) fail("Não foi possível cadastrar o cliente.");
    return { ownerId: kept };
  }
  return { ownerId: cell(updated.data, "client_owner_id") || userId };
}

export async function listChatbotClients(userId: string): Promise<ChatbotClientRow[]> {
  const { organizationId, admin } = await membership(userId, "clients");
  const clientQuery = (withStage: boolean) => {
    let query = table("chatbot_contacts")
      .select(withStage ? "id, name, phone, negotiated_cents, client_owner_id, stage_name" : "id, name, phone, negotiated_cents, client_owner_id")
      .eq("organization_id", organizationId)
      .not("client_owner_id", "is", null)
      .order("name", { ascending: true });
    if (!admin) query = query.eq("client_owner_id", userId);
    return query;
  };
  const listed = await rowsOrMissing(clientQuery(true));
  const contacts = listed.missing ? await rows(clientQuery(false)) : listed.rows;
  const visible = contacts.filter((row) => clientVisibleTo(cell(row, "client_owner_id"), userId, admin));
  const ids = visible.map((row) => cell(row, "id")).filter(Boolean);
  const ownerIds = [...new Set(visible.map((row) => cell(row, "client_owner_id")).filter(Boolean))];
  const tagNames = new Map<string, string[]>();
  const productNames = new Map<string, string[]>();
  const tagLinks = ids.length
    ? await rowsOrMissing(table("chatbot_contact_tags").select("contact_id, tag_id").eq("organization_id", organizationId).in("contact_id", ids))
    : { rows: [] as Record<string, unknown>[], missing: false };
  const tags = ids.length
    ? await rowsOrMissing(table("chatbot_tags").select("id, name").eq("organization_id", organizationId))
    : { rows: [] as Record<string, unknown>[], missing: false };
  const productLinks = ids.length
    ? await rowsOrMissing(table("chatbot_contact_products").select("contact_id, product_id").eq("organization_id", organizationId).in("contact_id", ids))
    : { rows: [] as Record<string, unknown>[], missing: false };
  const products = ids.length
    ? await rowsOrMissing(table("chatbot_products").select("id, name").eq("organization_id", organizationId))
    : { rows: [] as Record<string, unknown>[], missing: false };
  const profiles = ownerIds.length
    ? await supabaseAdmin.from("profiles").select("id, full_name").in("id", ownerIds)
    : { data: [], error: null };
  if (profiles.error) fail(schemaMessage(profiles.error.message));
  const tagCatalog = new Map(tags.rows.map((row) => [cell(row, "id"), cell(row, "name")]));
  for (const link of tagLinks.rows) {
    const contactId = cell(link, "contact_id");
    const name = tagCatalog.get(cell(link, "tag_id"));
    if (!name) continue;
    tagNames.set(contactId, [...(tagNames.get(contactId) ?? []), name]);
  }
  const productCatalog = new Map(products.rows.map((row) => [cell(row, "id"), cell(row, "name")]));
  for (const link of productLinks.rows) {
    const contactId = cell(link, "contact_id");
    const name = productCatalog.get(cell(link, "product_id"));
    if (!name) continue;
    productNames.set(contactId, [...(productNames.get(contactId) ?? []), name]);
  }
  const attendantNames = new Map((profiles.data ?? []).map((row) => [row.id, row.full_name.trim()]));
  return visible.map((row) => {
    const raw = row["negotiated_cents"];
    const amount = raw == null || raw === "" ? null : Number(raw);
    const id = cell(row, "id");
    return {
      id,
      name: cell(row, "name"),
      phone: cell(row, "phone"),
      negotiatedCents: amount != null && Number.isFinite(amount) ? Math.trunc(amount) : null,
      tags: tagNames.get(id) ?? [],
      attendant: attendantNames.get(cell(row, "client_owner_id")) ?? "",
      stage: cell(row, "stage_name"),
      products: productNames.get(id) ?? [],
    };
  });
}

export async function listChatbotKanban(userId: string): Promise<ChatbotKanbanBoard> {
  const { organizationId } = await membership(userId, "kanban");
  const stages = await listChatbotStages(userId);
  const contactQuery = (withDeal: boolean) =>
    table("chatbot_contacts")
      .select(withDeal ? "id, name, negotiated_cents, stage_name" : "id, name, stage_name")
      .eq("organization_id", organizationId)
      .not("stage_name", "is", null)
      .order("name", { ascending: true });
  const listed = await rowsOrMissing(contactQuery(true));
  const contacts = listed.missing ? await rowsOrMissing(contactQuery(false)) : listed;
  if (contacts.missing) return { ready: false, stages: stages.stages.map((item) => item.name), cards: [] };
  const visible = contacts.rows.filter((row) => cell(row, "stage_name"));
  const ids = visible.map((row) => cell(row, "id")).filter(Boolean);
  const productLinks = ids.length
    ? await rowsOrMissing(table("chatbot_contact_products").select("contact_id, product_id").eq("organization_id", organizationId).in("contact_id", ids))
    : { rows: [] as Record<string, unknown>[], missing: false };
  const products = ids.length
    ? await rowsOrMissing(table("chatbot_products").select("id, name").eq("organization_id", organizationId))
    : { rows: [] as Record<string, unknown>[], missing: false };
  const productCatalog = new Map(products.rows.map((row) => [cell(row, "id"), cell(row, "name")]));
  const productNames = new Map<string, string[]>();
  for (const link of productLinks.rows) {
    const contactId = cell(link, "contact_id");
    const name = productCatalog.get(cell(link, "product_id"));
    if (!name) continue;
    productNames.set(contactId, [...(productNames.get(contactId) ?? []), name]);
  }
  return {
    ready: stages.ready,
    stages: stages.stages.map((item) => item.name),
    cards: visible.map((row) => {
      const raw = row["negotiated_cents"];
      const amount = raw == null || raw === "" ? null : Number(raw);
      const id = cell(row, "id");
      return {
        id,
        name: cell(row, "name"),
        stage: cell(row, "stage_name"),
        products: productNames.get(id) ?? [],
        negotiatedCents: amount != null && Number.isFinite(amount) ? Math.trunc(amount) : null,
      };
    }),
  };
}

export async function listChatbotQueueAlerts(userId: string) {
  const { organizationId, admin } = await membership(userId);
  const settings = await table("organizations").select("chatbot_queue_minutes").eq("id", organizationId).maybeSingle();
  const minutes = settings.error
    ? defaultQueueMinutes
    : queueMinutes(settings.data?.["chatbot_queue_minutes"]) ?? defaultQueueMinutes;
  if (settings.error && !/chatbot_queue_minutes|schema cache|does not exist/i.test(settings.error.message)) {
    fail(schemaMessage(settings.error.message));
  }
  if (!admin) return { minutes, offline: false, leads: [] as { conversationId: string; contactId: string; name: string; waitingMinutes: number }[] };
  const listed = await rowsOrMissing(
    table("chatbot_conversations")
      .select("id, contact_id, created_at, queued_at")
      .eq("organization_id", organizationId)
      .eq("status", "queue")
      .is("assignee_id", null),
  );
  const conversations = listed.missing
    ? await rows(
        table("chatbot_conversations")
          .select("id, contact_id, created_at")
          .eq("organization_id", organizationId)
          .eq("status", "queue")
          .is("assignee_id", null),
      )
    : listed.rows;
  const contactIds = [...new Set(conversations.map((row) => cell(row, "contact_id")).filter(Boolean))];
  const contacts = contactIds.length
    ? await rows(table("chatbot_contacts").select("id, name").eq("organization_id", organizationId).in("id", contactIds))
    : [];
  const names = new Map(contacts.map((row) => [cell(row, "id"), cell(row, "name")]));
  const leads = overdueQueue(
    conversations.map((row) => ({
      conversationId: cell(row, "id"),
      contactId: cell(row, "contact_id"),
      name: names.get(cell(row, "contact_id")) || "Contato",
      since: cell(row, "queued_at") || cell(row, "created_at"),
    })),
    minutes,
  ).map((lead) => ({
    conversationId: lead.conversationId,
    contactId: lead.contactId,
    name: lead.name,
    waitingMinutes: lead.waitingMinutes,
  }));
  return { minutes, leads, offline: await companyAttendantsOffline(organizationId) };
}

const attendantOnlineMs = 2 * 60 * 1000;

async function touchPresence(organizationId: string, userId: string) {
  const now = new Date().toISOString();
  const updated = await table("chatbot_presence")
    .update({ organization_id: organizationId, seen_at: now })
    .eq("user_id", userId)
    .select("user_id")
    .maybeSingle();
  if (updated.error) return;
  if (updated.data) return;
  await table("chatbot_presence")
    .insert({ user_id: userId, organization_id: organizationId, seen_at: now })
    .select("user_id")
    .maybeSingle();
}

async function teamMembersOffline(organizationId: string) {
  const connections = await rowsOrMissing(table("chatbot_connections").select("status").eq("organization_id", organizationId));
  if (!connections.rows.some((row) => cell(row, "status") === "connected")) return false;
  const members = await rowsOrMissing(table("chatbot_team_members").select("user_id").eq("organization_id", organizationId));
  const attendants = [...new Set(members.rows.map((row) => cell(row, "user_id")).filter(Boolean))];
  if (!attendants.length || members.missing) return false;
  const presence = await rowsOrMissing(table("chatbot_presence").select("user_id, seen_at").eq("organization_id", organizationId));
  if (presence.missing) return false;
  const fresh = Date.now() - attendantOnlineMs;
  const online = new Set(
    presence.rows
      .filter((row) => {
        const seen = Date.parse(cell(row, "seen_at"));
        return Number.isFinite(seen) && seen >= fresh;
      })
      .map((row) => cell(row, "user_id")),
  );
  return attendants.every((id) => !online.has(id));
}

async function companyAttendantsOffline(organizationId: string) {
  const settings = await table("organizations").select("chatbot_offline_alert").eq("id", organizationId).maybeSingle();
  if (settings.error || settings.data?.["chatbot_offline_alert"] === false) return false;
  return teamMembersOffline(organizationId);
}

export async function chatbotNoticeTick(userId: string) {
  const { organizationId } = await membership(userId);
  await touchPresence(organizationId, userId);
  await resumeDueFlows(organizationId);
  const settings = await table("organizations").select("chatbot_sound_enabled").eq("id", organizationId).maybeSingle();
  const sound = Boolean(settings.error || settings.data?.["chatbot_sound_enabled"] !== false);
  const messages = await rowsOrMissing(
    table("chatbot_messages").select("id").eq("organization_id", organizationId).eq("direction", "in").order("created_at", { ascending: false }).limit(20),
  );
  const queues = await rowsOrMissing(
    table("chatbot_conversations").select("id").eq("organization_id", organizationId).eq("status", "queue").is("assignee_id", null),
  );
  return {
    sound,
    messageIds: messages.rows.map((row) => cell(row, "id")).filter(Boolean),
    queueIds: queues.rows.map((row) => cell(row, "id")).filter(Boolean),
  };
}

export async function chatbotNoticeSettings(userId: string) {
  const { organizationId } = await membership(userId, "settings");
  const settings = await table("organizations").select("chatbot_sound_enabled, chatbot_offline_alert").eq("id", organizationId).maybeSingle();
  if (settings.error) return { sound: true, offlineAlert: true };
  return {
    sound: settings.data?.["chatbot_sound_enabled"] !== false,
    offlineAlert: settings.data?.["chatbot_offline_alert"] !== false,
  };
}

export async function chatbotAccessProfiles(userId: string) {
  const { organizationId } = await membership(userId, ["team", "settings"]);
  const settings = await table("organizations").select("chatbot_access_profiles").eq("id", organizationId).maybeSingle();
  if (settings.error && !/chatbot_access_profiles|schema cache|does not exist/i.test(settings.error.message)) fail(schemaMessage(settings.error.message));
  return chatbotProfilesFromStorage(settings.data?.["chatbot_access_profiles"]);
}

export async function saveChatbotAccessProfiles(userId: string, input: ChatbotProfiles) {
  const profiles = chatbotProfilesFromStorage(input);
  const { organizationId, admin } = await membership(userId, "settings");
  if (!admin) fail("Somente o administrador da empresa pode alterar os perfis.");
  const updated = await table("organizations")
    .update({ chatbot_access_profiles: profiles as unknown as Json })
    .eq("id", organizationId)
    .select("id")
    .maybeSingle();
  if (updated.error) fail(schemaMessage(updated.error.message));
  return profiles;
}

export async function chatbotCompanySettings(userId: string) {
  const { organizationId } = await membership(userId, "settings");
  const settings = await table("organizations").select("chatbot_company_name").eq("id", organizationId).maybeSingle();
  if (settings.error && !/chatbot_company_name|schema cache|does not exist/i.test(settings.error.message)) fail(schemaMessage(settings.error.message));
  return { name: settings.error ? "" : chatbotCompanyName(settings.data?.["chatbot_company_name"]) };
}

export async function saveChatbotCompany(userId: string, input: { name: string }) {
  const name = chatbotCompanyName(input.name);
  if (!name) fail("Informe o nome da empresa.");
  const { organizationId, admin } = await membership(userId, "settings");
  if (!admin) fail("Somente o administrador da empresa pode alterar o nome.");
  const updated = await table("organizations").update({ chatbot_company_name: name }).eq("id", organizationId).select("id").maybeSingle();
  if (updated.error) fail(schemaMessage(updated.error.message));
  return { name };
}

export async function chatbotAutomationSettings(userId: string) {
  const { organizationId } = await membership(userId, "settings");
  const settings = await table("organizations")
    .select("chatbot_reactivation_minutes, chatbot_offline_message_enabled, chatbot_offline_message")
    .eq("id", organizationId)
    .maybeSingle();
  if (settings.error && !/chatbot_reactivation_minutes|chatbot_offline_message|schema cache|does not exist/i.test(settings.error.message)) fail(schemaMessage(settings.error.message));
  const text = offlineNoticeText(settings.data?.["chatbot_offline_message"]) || defaultOfflineNotice;
  return {
    reactivationMinutes: settings.error ? 15 : reactivationMinutes(settings.data?.["chatbot_reactivation_minutes"]),
    offlineMessageEnabled: !settings.error && settings.data?.["chatbot_offline_message_enabled"] === true,
    offlineMessage: text,
  };
}

export async function saveChatbotAutomation(userId: string, input: { reactivationMinutes: number; offlineMessageEnabled: boolean; offlineMessage: string }) {
  const minutes = reactivationMinutes(input.reactivationMinutes);
  const text = offlineNoticeText(input.offlineMessage) || defaultOfflineNotice;
  if (input.offlineMessageEnabled && !offlineNoticeText(input.offlineMessage)) fail("Escreva a mensagem de indisponibilidade.");
  const { organizationId, admin } = await membership(userId, "settings");
  if (!admin) fail("Somente o administrador da empresa pode alterar as automações.");
  const updated = await table("organizations")
    .update({
      chatbot_reactivation_minutes: minutes,
      chatbot_offline_message_enabled: input.offlineMessageEnabled,
      chatbot_offline_message: text,
    })
    .eq("id", organizationId)
    .select("id")
    .maybeSingle();
  if (updated.error) fail(schemaMessage(updated.error.message));
  return { reactivationMinutes: minutes, offlineMessageEnabled: input.offlineMessageEnabled, offlineMessage: text };
}

export async function saveChatbotNotice(userId: string, input: { sound: boolean; offlineAlert: boolean }) {
  const { organizationId, admin } = await membership(userId, "settings");
  if (!admin) fail("Somente o administrador da empresa pode alterar as notificações.");
  const updated = await table("organizations")
    .update({ chatbot_sound_enabled: input.sound, chatbot_offline_alert: input.offlineAlert })
    .eq("id", organizationId)
    .select("id")
    .maybeSingle();
  if (updated.error) fail(schemaMessage(updated.error.message));
  return { sound: input.sound, offlineAlert: input.offlineAlert };
}

export async function saveChatbotQueueMinutes(userId: string, minutesInput: number) {
  const minutes = queueMinutes(minutesInput);
  if (!minutes) fail("Informe o tempo máximo na fila em minutos.");
  const { organizationId, admin } = await membership(userId, "settings");
  if (!admin) fail("Somente o administrador da empresa pode definir o tempo da fila.");
  const updated = await table("organizations")
    .update({ chatbot_queue_minutes: minutes })
    .eq("id", organizationId)
    .select("id")
    .maybeSingle();
  if (updated.error) fail(schemaMessage(updated.error.message));
  return { minutes };
}

export async function chatbotAttendanceSettings(userId: string) {
  const { organizationId } = await membership(userId, "settings");
  const minutesRow = await table("organizations").select("chatbot_queue_minutes").eq("id", organizationId).maybeSingle();
  const ratingRow = await table("organizations").select("chatbot_rating_enabled, chatbot_rating_prompt").eq("id", organizationId).maybeSingle();
  if (minutesRow.error && !/chatbot_queue_minutes|schema cache|does not exist/i.test(minutesRow.error.message)) fail(schemaMessage(minutesRow.error.message));
  const minutes = minutesRow.error ? defaultQueueMinutes : queueMinutes(minutesRow.data?.["chatbot_queue_minutes"]) ?? defaultQueueMinutes;
  const prompt = ratingPrompt(ratingRow.data?.["chatbot_rating_prompt"]) || defaultRatingPrompt;
  return {
    minutes,
    ratingEnabled: !ratingRow.error && ratingRow.data?.["chatbot_rating_enabled"] === true,
    ratingPrompt: prompt,
  };
}

export async function saveChatbotAttendance(userId: string, input: { minutes: number; ratingEnabled: boolean; ratingPrompt: string }) {
  const minutes = queueMinutes(input.minutes);
  if (!minutes) fail("Informe o tempo máximo na fila em minutos.");
  const prompt = ratingPrompt(input.ratingPrompt);
  if (input.ratingEnabled && !prompt) fail("Escreva o texto da avaliação.");
  const saved = await saveChatbotQueueMinutes(userId, minutes);
  const { organizationId } = await membership(userId, "settings");
  const updated = await table("organizations")
    .update({ chatbot_rating_enabled: input.ratingEnabled, chatbot_rating_prompt: prompt || defaultRatingPrompt })
    .eq("id", organizationId)
    .select("id")
    .maybeSingle();
  if (updated.error) {
    if (input.ratingEnabled) fail(schemaMessage(updated.error.message));
    return { ...saved, ratingEnabled: false, ratingPrompt: defaultRatingPrompt };
  }
  return { minutes: saved.minutes, ratingEnabled: input.ratingEnabled, ratingPrompt: prompt || defaultRatingPrompt };
}

export async function callChatbotContact(userId: string, contactId: string) {
  const { organizationId, admin } = await membership(userId, "inbox");
  await ownedContact(organizationId, contactId);
  const conversations = await rows(
    table("chatbot_conversations")
      .select("id, connection_id, assignee_id, status, updated_at")
      .eq("organization_id", organizationId)
      .eq("contact_id", contactId),
  );
  const allowed = admin ? null : await teamConnectionIds(userId, organizationId);
  const visible = [...conversations]
    .filter((row) => !allowed || allowed.has(cell(row, "connection_id")))
    .sort((left, right) => cell(right, "updated_at").localeCompare(cell(left, "updated_at")));
  if (conversations.length && !visible.length) fail("Essa conversa já está com outro atendente.");
  const current = visible[0];
  if (current) {
    const assignee = cell(current, "assignee_id");
    if (assignee && assignee !== userId) fail("Essa conversa já está com outro atendente.");
    if (assignee !== userId || cell(current, "status") !== "active") {
      const updated = await assignConversation(cell(current, "id"), organizationId, userId, {
        status: "active",
        bot_paused: true,
        updated_at: new Date().toISOString(),
      });
      if (updated.error) fail(schemaMessage(updated.error.message));
    }
    return { conversationId: cell(current, "id") };
  }
  const connectionId = admin
    ? cell((await rows(table("chatbot_connections").select("id").eq("organization_id", organizationId).order("created_at", { ascending: true })))[0], "id")
    : [...(allowed ?? [])][0] ?? "";
  if (!connectionId) fail("Conecte um canal de WhatsApp antes de chamar o contato.");
  const conversationInsert = {
    organization_id: organizationId,
    contact_id: contactId,
    connection_id: connectionId,
    status: "active",
    assignee_id: userId,
    assumed_by: userId,
    bot_paused: true,
  };
  let created = await table("chatbot_conversations").insert(conversationInsert).select("id").maybeSingle();
  if (created.error && /assumed_by/i.test(created.error.message)) {
    const { assumed_by: _assumedBy, ...withoutCredit } = conversationInsert;
    created = await table("chatbot_conversations").insert(withoutCredit).select("id").maybeSingle();
  }
  if (created.data) return { conversationId: cell(created.data, "id") };
  if (!duplicate(created.error)) fail(schemaMessage(created.error?.message ?? ""));
  const again = await table("chatbot_conversations")
    .select("id, assignee_id")
    .eq("connection_id", connectionId)
    .eq("contact_id", contactId)
    .maybeSingle();
  if (again.error) fail(schemaMessage(again.error.message));
  const assignee = cell(again.data, "assignee_id");
  if (!again.data || (assignee && assignee !== userId)) fail("Essa conversa já está com outro atendente.");
  return { conversationId: cell(again.data, "id") };
}

export async function renameChatbotContact(userId: string, contactId: string, name: string) {
  const clean = catalogName(name, 80);
  if (!clean) fail("Informe o nome do contato.");
  const { organizationId } = await membership(userId, "inbox");
  await ownedContact(organizationId, contactId);
  const updated = await table("chatbot_contacts")
    .update({ name: clean, name_edited: true })
    .eq("id", contactId)
    .eq("organization_id", organizationId)
    .select("id")
    .maybeSingle();
  if (updated.error) fail(schemaMessage(updated.error.message));
  if (!updated.data) fail("Esse contato não pertence à sua empresa.");
  return { name: clean };
}

export async function renameChatbotContactFile(userId: string, fileId: string, name: string) {
  const clean = catalogName(name, 80);
  if (!clean) fail("Informe o nome da mídia.");
  const { organizationId } = await membership(userId, "inbox");
  const updated = await table("chatbot_contact_files")
    .update({ name: clean })
    .eq("id", fileId)
    .eq("organization_id", organizationId)
    .select("id")
    .maybeSingle();
  if (updated.error) fail(schemaMessage(updated.error.message));
  if (!updated.data) fail("Essa mídia não pertence à sua empresa.");
  return { name: clean };
}

export async function setChatbotContactStage(userId: string, contactId: string, stageName: string) {
  const clean = stageName.trim();
  const { organizationId } = await membership(userId, "inbox");
  await ownedContact(organizationId, contactId);
  if (clean) {
    const stages = await rows(table("chatbot_stages").select("name").eq("organization_id", organizationId));
    if (!stages.some((row) => cell(row, "name") === clean)) fail("Escolha uma etapa do kanban.");
  }
  const stagePatch: Record<string, unknown> = { stage_name: clean || null, stage_set_by: clean ? userId : null };
  let updated = await table("chatbot_contacts").update(stagePatch).eq("id", contactId).eq("organization_id", organizationId).select("id").maybeSingle();
  if (updated.error && /stage_set_by/i.test(updated.error.message)) {
    updated = await table("chatbot_contacts")
      .update({ stage_name: clean || null })
      .eq("id", contactId)
      .eq("organization_id", organizationId)
      .select("id")
      .maybeSingle();
  }
  if (updated.error) fail(schemaMessage(updated.error.message));
  if (!updated.data) fail("Esse contato não pertence à sua empresa.");
  return { stage: clean };
}

export async function setChatbotContactBots(userId: string, contactId: string, disabled: boolean) {
  const { organizationId } = await membership(userId, "inbox");
  await ownedContact(organizationId, contactId);
  const updated = await table("chatbot_contacts")
    .update({ bots_disabled: disabled })
    .eq("id", contactId)
    .eq("organization_id", organizationId)
    .select("id")
    .maybeSingle();
  if (updated.error) fail(schemaMessage(updated.error.message));
  if (!updated.data) fail("Esse contato não pertence à sua empresa.");
  const conversations = table("chatbot_conversations").update({ bot_paused: disabled }).eq("organization_id", organizationId).eq("contact_id", contactId);
  const paused = disabled ? await conversations : await conversations.is("assignee_id", null);
  if (paused.error) fail(schemaMessage(paused.error.message));
  return { disabled };
}

export async function setChatbotContactTags(userId: string, contactId: string, tagIds: string[]) {
  const { organizationId } = await membership(userId, "inbox");
  await ownedContact(organizationId, contactId);
  await replaceContactLinks("chatbot_contact_tags", "tag_id", "chatbot_tags", organizationId, contactId, tagIds);
  return { saved: true as const };
}

export async function setChatbotContactProducts(userId: string, contactId: string, productIds: string[]) {
  const { organizationId } = await membership(userId, "inbox");
  await ownedContact(organizationId, contactId);
  await replaceContactLinks("chatbot_contact_products", "product_id", "chatbot_products", organizationId, contactId, productIds);
  return { saved: true as const };
}

function assertRunnableFlow(graph: ReturnType<typeof editorGraph>) {
  const triggers = graph.nodes.filter((node) => node.kind === "Gatilho");
  const actions = graph.nodes.filter((node) => node.kind === "Ação");
  if (!triggers.length || !actions.length) fail("Adicione pelo menos um gatilho e uma ação.");
  const incoming = new Set(graph.edges.map((edge) => edge.target));
  if (graph.nodes.some((node) => node.kind !== "Gatilho" && !incoming.has(node.id))) fail("Ligue cada bloco ao gatilho antes de gravar.");
  if (graph.nodes.some((node) => (node.label === "Enviar mensagem" || node.label === "Fazer pergunta") && !node.content.trim())) {
    fail("Escreva o texto dos blocos de mensagem e pergunta.");
  }
}

function flowGraph(value: unknown) {
  const record = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const nodes = Array.isArray(record["nodes"]) ? record["nodes"] : [];
  const edges = Array.isArray(record["edges"]) ? record["edges"] : [];
  return {
    nodes: nodes.slice(0, 80).flatMap((item) => {
      const row = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
      const id = cell(row, "id");
      const label = cell(row, "label");
      if (!id || !label) return [];
      return [{ id, label, kind: cell(row, "kind"), content: cell(row, "content").slice(0, 1000) }];
    }),
    edges: edges.slice(0, 120).flatMap((item) => {
      const row = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
      const source = cell(row, "source");
      const target = cell(row, "target");
      if (!source || !target) return [];
      return [{ source, target }];
    }),
  };
}

function editorGraph(value: unknown) {
  const record = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const nodes = Array.isArray(record["nodes"]) ? record["nodes"] : [];
  const edges = Array.isArray(record["edges"]) ? record["edges"] : [];
  return {
    nodes: nodes.slice(0, 80).flatMap((item) => {
      const row = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
      const id = cell(row, "id");
      const label = cell(row, "label");
      if (!id || !label) return [];
      return [{ id, label, kind: cell(row, "kind") || "Ação", content: cell(row, "content").slice(0, 1000), x: Number(row["x"]) || 0, y: Number(row["y"]) || 0 }];
    }),
    edges: edges.slice(0, 120).flatMap((item) => {
      const row = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
      const source = cell(row, "source");
      const target = cell(row, "target");
      if (!source || !target) return [];
      return [{ id: cell(row, "id") || `${source}-${target}`, source, target }];
    }),
  };
}

function readFlowRun(row: Record<string, unknown> | null | undefined): FlowRun | null {
  const status = cell(row, "status");
  if (status !== "waiting" && status !== "delay" && status !== "done") return null;
  const waitUntil = Date.parse(cell(row, "wait_until"));
  return {
    flowId: cell(row, "flow_id"),
    nodeId: cell(row, "node_id"),
    status,
    waitUntil: Number.isFinite(waitUntil) ? waitUntil : 0,
    lastAnswer: cell(row, "last_answer"),
  };
}

async function loadActiveFlows(organizationId: string): Promise<SavedFlow[]> {
  const loaded = await rowsOrMissing(
    table("chatbot_flows").select("id, name, graph").eq("organization_id", organizationId).eq("active", true).order("name", { ascending: true }),
  );
  if (loaded.missing) return [];
  return loaded.rows.map((row) => ({ id: cell(row, "id"), name: cell(row, "name"), graph: flowGraph(row["graph"]) }));
}

async function sendFlowText(connection: Record<string, unknown>, organizationId: string, conversationId: string, contactId: string, text: string) {
  if (cell(connection, "status") !== "connected") return;
  const contact = await table("chatbot_contacts").select("phone").eq("id", contactId).eq("organization_id", organizationId).maybeSingle();
  const phone = cell(contact.data, "phone");
  if (!phone) return;
  const sent = await evo(`/message/sendText/${encodeURIComponent(cell(connection, "instance_name"))}`, "POST", { number: phone, text });
  await table("chatbot_messages")
    .insert({
      organization_id: organizationId,
      conversation_id: conversationId,
      text,
      direction: "out",
      status: "sent",
      external_id: readMessageId(sent) || null,
    })
    .select("id")
    .maybeSingle();
}

async function addFlowTag(organizationId: string, contactId: string, name: string) {
  const clean = catalogName(name, 32);
  if (!clean) return;
  const existing = await table("chatbot_tags").select("id").eq("organization_id", organizationId).eq("name", clean).maybeSingle();
  let tagId = cell(existing.data, "id");
  if (!tagId) {
    const inserted = await table("chatbot_tags").insert({ organization_id: organizationId, name: clean, color: "#6f02fd" }).select("id").maybeSingle();
    if (duplicate(inserted.error)) {
      const again = await table("chatbot_tags").select("id").eq("organization_id", organizationId).eq("name", clean).maybeSingle();
      tagId = cell(again.data, "id");
    } else {
      tagId = cell(inserted.data, "id");
    }
  }
  if (!tagId) return;
  const linked = await table("chatbot_contact_tags")
    .insert({ contact_id: contactId, tag_id: tagId, organization_id: organizationId })
    .select("contact_id")
    .maybeSingle();
  if (linked.error && !duplicate(linked.error)) return;
}

async function appendFlowNote(organizationId: string, contactId: string, text: string) {
  const current = await table("chatbot_contacts").select("bot_note").eq("id", contactId).eq("organization_id", organizationId).maybeSingle();
  if (current.error) return;
  const next = [cell(current.data, "bot_note"), text].filter(Boolean).join("\n").slice(-4000);
  await table("chatbot_contacts").update({ bot_note: next }).eq("id", contactId).eq("organization_id", organizationId);
}

async function createFlowDeal(organizationId: string, contactId: string, text: string) {
  const cents = negotiatedCents(text);
  if (cents != null) {
    await table("chatbot_contacts").update({ negotiated_cents: cents }).eq("id", contactId).eq("organization_id", organizationId);
  }
  const contact = await table("chatbot_contacts").select("stage_name").eq("id", contactId).eq("organization_id", organizationId).maybeSingle();
  if (!cell(contact.data, "stage_name")) {
    const stages = await rowsOrMissing(
      table("chatbot_stages").select("name, position").eq("organization_id", organizationId).order("position", { ascending: true }).limit(1),
    );
    const stage = cell(stages.rows[0], "name");
    if (stage) await table("chatbot_contacts").update({ stage_name: stage }).eq("id", contactId).eq("organization_id", organizationId);
  }
  await appendFlowNote(organizationId, contactId, `Oportunidade: ${text}`);
}

async function applyFlowActions(connection: Record<string, unknown>, organizationId: string, conversationId: string, contactId: string, actions: FlowAction[]) {
  for (const action of actions) {
    if (action.type === "send") await sendFlowText(connection, organizationId, conversationId, contactId, action.text);
    if (action.type === "tag") await addFlowTag(organizationId, contactId, action.name);
    if (action.type === "note") await appendFlowNote(organizationId, contactId, action.text);
    if (action.type === "deal") await createFlowDeal(organizationId, contactId, action.text);
    if (action.type === "queue") {
      await table("chatbot_conversations")
        .update({ status: "queue", assignee_id: null, bot_paused: true, updated_at: new Date().toISOString() })
        .eq("id", conversationId)
        .eq("organization_id", organizationId);
    }
    if (action.type === "pause") {
      await table("chatbot_conversations").update({ bot_paused: true, updated_at: new Date().toISOString() }).eq("id", conversationId).eq("organization_id", organizationId);
    }
  }
}

async function saveFlowRun(organizationId: string, conversationId: string, run: FlowRun | null) {
  if (!run?.flowId) return;
  const patch = {
    organization_id: organizationId,
    conversation_id: conversationId,
    flow_id: run.flowId,
    node_id: run.nodeId,
    status: run.status,
    wait_until: run.waitUntil ? new Date(run.waitUntil).toISOString() : null,
    last_answer: run.lastAnswer,
    updated_at: new Date().toISOString(),
  };
  const updated = await table("chatbot_flow_runs").update(patch).eq("conversation_id", conversationId).select("conversation_id").maybeSingle();
  if (updated.error) return;
  if (updated.data) return;
  await table("chatbot_flow_runs").insert(patch).select("conversation_id").maybeSingle();
}

async function executeConversationFlow(connection: Record<string, unknown>, organizationId: string, conversationId: string, contactId: string, text: string, manualFlowId = "") {
  const flows = await loadActiveFlows(organizationId);
  if (!flows.length) return false;
  const stored = await table("chatbot_flow_runs").select("flow_id, node_id, status, wait_until, last_answer").eq("conversation_id", conversationId).maybeSingle();
  if (stored.error && /schema cache|does not exist|PGRST205/i.test(stored.error.message)) return false;
  const run = readFlowRun(stored.data);
  const outsideHours = outsideBusinessHours(Date.now());
  const chosen = chooseFlow(flows, { text, outsideHours, run, manualFlowId });
  if (!chosen) return { sent: false, owned: false };
  const step = stepFlow(chosen, manualFlowId ? null : run && run.flowId === chosen.id ? run : null, { text, at: Date.now(), outsideHours, manual: Boolean(manualFlowId) });
  if (!step.actions.length && !step.run) return { sent: false, owned: false };
  await applyFlowActions(connection, organizationId, conversationId, contactId, step.actions);
  await saveFlowRun(organizationId, conversationId, step.run);
  return {
    sent: step.actions.some((action) => action.type === "send"),
    owned: step.actions.length > 0 || step.run?.status === "waiting" || step.run?.status === "delay",
  };
}

async function runIncomingFlow(connection: Record<string, unknown>, organizationId: string, conversationId: string, contactId: string, text: string) {
  try {
    const conversation = await table("chatbot_conversations").select("assignee_id, bot_paused").eq("id", conversationId).eq("organization_id", organizationId).maybeSingle();
    if (conversation.error || cell(conversation.data, "assignee_id")) return false;
    const paused = conversation.data?.["bot_paused"] === true;
    const stored = await table("chatbot_flow_runs").select("status").eq("conversation_id", conversationId).maybeSingle();
    if (stored.error && /schema cache|does not exist|PGRST205/i.test(stored.error.message)) return false;
    const status = cell(stored.data, "status");
    if (paused && status !== "done") return false;
    const result = await executeConversationFlow(connection, organizationId, conversationId, contactId, text);
    return result.sent || result.owned;
  } catch {
    return false;
  }
}

async function resumeDueFlows(organizationId: string, exceptConversationId = "") {
  try {
    const due = await rowsOrMissing(
      table("chatbot_flow_runs").select("conversation_id").eq("organization_id", organizationId).eq("status", "delay").lte("wait_until", new Date().toISOString()).limit(20),
    );
    if (due.missing) return;
    for (const row of due.rows) {
      const conversationId = cell(row, "conversation_id");
      if (!conversationId || conversationId === exceptConversationId) continue;
      const conversation = await table("chatbot_conversations").select("contact_id, connection_id, assignee_id, bot_paused").eq("id", conversationId).eq("organization_id", organizationId).maybeSingle();
      if (conversation.error || cell(conversation.data, "assignee_id") || conversation.data?.["bot_paused"] === true) continue;
      const connection = await table("chatbot_connections").select("*").eq("id", cell(conversation.data, "connection_id")).eq("organization_id", organizationId).maybeSingle();
      if (connection.error || !connection.data) continue;
      await executeConversationFlow(connection.data, organizationId, conversationId, cell(conversation.data, "contact_id"), "");
    }
  } catch {
    return;
  }
}

export async function listChatbotFlows(userId: string) {
  const { organizationId } = await membership(userId, ["inbox", "settings"]);
  const loaded = await rows(
    table("chatbot_flows").select("id, name, active, graph, updated_at").eq("organization_id", organizationId).order("updated_at", { ascending: false }),
  );
  return loaded.map((row) => {
    const graph = editorGraph(row["graph"]);
    return { id: cell(row, "id"), name: cell(row, "name"), active: row["active"] === true, nodes: graph.nodes, edges: graph.edges };
  });
}

export async function saveChatbotFlow(
  userId: string,
  input: { id: string; name: string; active: boolean; nodes: { id: string; label: string; kind: string; content: string; x: number; y: number }[]; edges: { id: string; source: string; target: string }[] },
) {
  const name = catalogName(input.name, 80);
  if (!name) fail("O bot precisa de um nome com 2 a 80 caracteres.");
  const graph = editorGraph({ nodes: input.nodes, edges: input.edges });
  if (input.active === true) assertRunnableFlow(graph);
  const { organizationId } = await membership(userId, "settings");
  const payload = { name, active: input.active === true, graph, updated_at: new Date().toISOString() };
  const id = input.id.trim();
  if (id) {
    const updated = await table("chatbot_flows").update(payload).eq("id", id).eq("organization_id", organizationId).select("id, active").maybeSingle();
    if (duplicate(updated.error)) fail("Já existe um bot com esse nome.");
    if (updated.error) fail(schemaMessage(updated.error.message));
    if (!updated.data) fail("Esse bot não pertence à sua empresa.");
    return { id, active: updated.data["active"] === true };
  }
  const inserted = await table("chatbot_flows").insert({ ...payload, organization_id: organizationId }).select("id, active").maybeSingle();
  if (duplicate(inserted.error)) fail("Já existe um bot com esse nome.");
  if (inserted.error) fail(schemaMessage(inserted.error.message));
  if (!inserted.data) fail("Não foi possível gravar o bot.");
  return { id: cell(inserted.data, "id"), active: inserted.data["active"] === true };
}

export async function startChatbotFlow(userId: string, conversationId: string, flowId: string) {
  const { organizationId, conversation } = await requireVisibleConversation(userId, conversationId);
  const contactId = cell(conversation, "contact_id");
  if (await contactBotsDisabled(organizationId, contactId)) fail("Os bots estão desativados para este contato.");
  const connection = await ownedConnection(organizationId, cell(conversation, "connection_id"));
  const flows = await loadActiveFlows(organizationId);
  if (!flows.some((flow) => flow.id === flowId)) fail("Esse bot não está ativo.");
  const started = await executeConversationFlow(connection, organizationId, conversationId, contactId, "", flowId);
  if (!started.sent && !started.owned) fail("Esse bot não tem uma ação ligada ao gatilho.");
  return { started: true as const };
}

export async function listChatbotTags(userId: string): Promise<ChatbotTag[]> {
  const { organizationId } = await membership(userId, "settings");
  const tags = await rows(table("chatbot_tags").select("id, name, color").eq("organization_id", organizationId).order("name", { ascending: true }));
  return tags.map((row) => ({ id: cell(row, "id"), name: cell(row, "name"), color: cell(row, "color") }));
}

export async function saveChatbotTag(userId: string, name: string, color: string) {
  const clean = catalogName(name, 32);
  const ink = tagColorValue(color);
  if (!clean) fail("A etiqueta precisa de um nome com 2 a 32 caracteres.");
  if (!ink) fail("Escolha a cor da etiqueta.");
  const { organizationId } = await membership(userId, "settings");
  const inserted = await table("chatbot_tags")
    .insert({ organization_id: organizationId, name: clean, color: ink })
    .select("id")
    .maybeSingle();
  if (duplicate(inserted.error)) fail("Já existe uma etiqueta com esse nome.");
  if (inserted.error) fail(schemaMessage(inserted.error.message));
  if (!inserted.data) fail("Não foi possível gravar a etiqueta.");
  return { id: cell(inserted.data, "id"), name: clean, color: ink };
}

export async function deleteChatbotTag(userId: string, tagId: string) {
  const { organizationId } = await membership(userId, "settings");
  const current = await table("chatbot_tags").select("id").eq("id", tagId).eq("organization_id", organizationId).maybeSingle();
  if (current.error) fail(schemaMessage(current.error.message));
  if (!current.data) fail("Essa etiqueta não pertence à sua empresa.");
  await done(table("chatbot_tags").delete().eq("id", tagId).eq("organization_id", organizationId));
  return { deleted: true as const };
}

export async function listChatbotQuickReplies(userId: string) {
  const { organizationId } = await membership(userId, ["inbox", "settings"]);
  const replies = await rows(
    table("chatbot_quick_replies").select("id, title, body").eq("organization_id", organizationId).order("title", { ascending: true }),
  );
  return replies.map((row) => ({ id: cell(row, "id"), title: cell(row, "title"), text: cell(row, "body") }));
}

export async function saveChatbotQuickReply(userId: string, title: string, text: string, replyId = "") {
  const cleanTitle = catalogName(title, 80);
  const cleanText = quickReplyText(text);
  if (!cleanTitle) fail("A resposta precisa de um título com 2 a 80 caracteres.");
  if (!cleanText) fail("A resposta precisa de um texto com 2 a 1000 caracteres.");
  const { organizationId } = await membership(userId, "settings");
  const id = replyId.trim();
  if (id) {
    const current = await table("chatbot_quick_replies").select("id").eq("id", id).eq("organization_id", organizationId).maybeSingle();
    if (current.error) fail(schemaMessage(current.error.message));
    if (!current.data) fail("Essa resposta não pertence à sua empresa.");
    const updated = await table("chatbot_quick_replies")
      .update({ title: cleanTitle, body: cleanText })
      .eq("id", id)
      .eq("organization_id", organizationId)
      .select("id")
      .maybeSingle();
    if (duplicate(updated.error)) fail("Já existe uma resposta com esse título.");
    if (updated.error) fail(schemaMessage(updated.error.message));
    if (!updated.data) fail("Não foi possível gravar a resposta.");
    return { id, title: cleanTitle, text: cleanText };
  }
  const inserted = await table("chatbot_quick_replies")
    .insert({ organization_id: organizationId, title: cleanTitle, body: cleanText })
    .select("id")
    .maybeSingle();
  if (duplicate(inserted.error)) fail("Já existe uma resposta com esse título.");
  if (inserted.error) fail(schemaMessage(inserted.error.message));
  if (!inserted.data) fail("Não foi possível gravar a resposta.");
  return { id: cell(inserted.data, "id"), title: cleanTitle, text: cleanText };
}

export async function deleteChatbotQuickReply(userId: string, replyId: string) {
  const { organizationId } = await membership(userId, "settings");
  const current = await table("chatbot_quick_replies").select("id").eq("id", replyId).eq("organization_id", organizationId).maybeSingle();
  if (current.error) fail(schemaMessage(current.error.message));
  if (!current.data) fail("Essa resposta não pertence à sua empresa.");
  await done(table("chatbot_quick_replies").delete().eq("id", replyId).eq("organization_id", organizationId));
  return { deleted: true as const };
}

export async function listChatbotProducts(userId: string): Promise<ChatbotCatalogItem[]> {
  const { organizationId } = await membership(userId, "settings");
  const products = await rows(table("chatbot_products").select("id, name").eq("organization_id", organizationId).order("name", { ascending: true }));
  return products.map((row) => ({ id: cell(row, "id"), name: cell(row, "name") }));
}

export async function saveChatbotProduct(userId: string, name: string) {
  const clean = catalogName(name, 80);
  if (!clean) fail("Informe o produto ou serviço.");
  const { organizationId } = await membership(userId, "settings");
  const inserted = await table("chatbot_products")
    .insert({ organization_id: organizationId, name: clean })
    .select("id")
    .maybeSingle();
  if (duplicate(inserted.error)) fail("Já existe um produto com esse nome.");
  if (inserted.error) fail(schemaMessage(inserted.error.message));
  if (!inserted.data) fail("Não foi possível gravar o produto.");
  return { id: cell(inserted.data, "id"), name: clean };
}

export async function deleteChatbotProduct(userId: string, productId: string) {
  const { organizationId } = await membership(userId, "settings");
  const current = await table("chatbot_products").select("id").eq("id", productId).eq("organization_id", organizationId).maybeSingle();
  if (current.error) fail(schemaMessage(current.error.message));
  if (!current.data) fail("Esse produto não pertence à sua empresa.");
  await done(table("chatbot_products").delete().eq("id", productId).eq("organization_id", organizationId));
  return { deleted: true as const };
}

function stageRows(rowsToMap: Record<string, unknown>[]) {
  return [...rowsToMap]
    .sort((left, right) => Number(cell(left, "position")) - Number(cell(right, "position")))
    .map((row) => ({ id: cell(row, "id"), name: cell(row, "name") }));
}

export async function listChatbotStages(userId: string) {
  const { organizationId } = await membership(userId, stageMenus);
  const loaded = await rowsOrMissing(
    table("chatbot_stages").select("id, name, position").eq("organization_id", organizationId).order("position", { ascending: true }),
  );
  if (loaded.missing) {
    return { ready: false, stages: defaultKanbanStages.map((name) => ({ id: "", name })) };
  }
  if (!loaded.rows.length) {
    for (let position = 0; position < defaultKanbanStages.length; position += 1) {
      const inserted = await table("chatbot_stages")
        .insert({ organization_id: organizationId, name: defaultKanbanStages[position], position })
        .select("id")
        .maybeSingle();
      if (inserted.error && !duplicate(inserted.error)) fail(schemaMessage(inserted.error.message));
    }
  } else if (!loaded.rows.some((row) => protectedKanbanStage(cell(row, "name")))) {
    const inserted = await table("chatbot_stages")
      .insert({ organization_id: organizationId, name: wonKanbanStage, position: loaded.rows.length })
      .select("id")
      .maybeSingle();
    if (inserted.error && !duplicate(inserted.error)) fail(schemaMessage(inserted.error.message));
  }
  const stages = await rows(
    table("chatbot_stages").select("id, name, position").eq("organization_id", organizationId).order("position", { ascending: true }),
  );
  return { ready: true, stages: stageRows(stages) };
}

export async function saveChatbotStages(userId: string, names: string[]) {
  const clean = withWonKanbanStage(names.map((name) => kanbanStageName(name)).filter((name) => name));
  if (!clean.length || clean.length > 13 || clean.some((name) => !name)) fail("O kanban precisa de etapas com 2 a 40 caracteres. A etapa Sucesso permanece no quadro.");
  const unique = new Set(clean.map((name) => name.toLowerCase()));
  if (unique.size !== clean.length) fail("Cada etapa precisa de um nome diferente.");
  const { organizationId } = await membership(userId, "settings");
  await done(table("chatbot_stages").delete().eq("organization_id", organizationId));
  for (let position = 0; position < clean.length; position += 1) {
    const inserted = await table("chatbot_stages")
      .insert({ organization_id: organizationId, name: clean[position], position })
      .select("id")
      .maybeSingle();
    if (inserted.error) fail(schemaMessage(inserted.error.message));
  }
  const stages = await rows(
    table("chatbot_stages").select("id, name, position").eq("organization_id", organizationId).order("position", { ascending: true }),
  );
  return stageRows(stages);
}

export async function chatbotOverview(userId: string): Promise<OverviewBoard> {
  const { organizationId, admin } = await membership(userId, "overview");
  const listedStages = await listChatbotStages(userId);
  const [conversations, contacts, ratings, connections, profiles, members, teams, products, productLinks] = await Promise.all([
    (async () => {
      const credited = await rowsOrMissing(
        table("chatbot_conversations").select("id, contact_id, connection_id, assignee_id, assumed_by, finished_count, created_at").eq("organization_id", organizationId),
      );
      if (!credited.missing) return credited.rows;
      return rows(table("chatbot_conversations").select("id, contact_id, connection_id, assignee_id, finished_count, created_at").eq("organization_id", organizationId));
    })(),
    (async () => {
      const credited = await rowsOrMissing(
        table("chatbot_contacts").select("id, negotiated_cents, stage_name, stage_set_by, client_owner_id").eq("organization_id", organizationId),
      );
      if (!credited.missing) return credited.rows;
      return rows(table("chatbot_contacts").select("id, negotiated_cents, stage_name, client_owner_id").eq("organization_id", organizationId));
    })(),
    rowsOrMissing(table("chatbot_ratings").select("conversation_id, score, created_at").eq("organization_id", organizationId)),
    rows(table("chatbot_connections").select("id, display_name, phone").eq("organization_id", organizationId).order("created_at", { ascending: true })),
    supabaseAdmin.from("profiles").select("id, full_name").eq("organization_id", organizationId).order("full_name", { ascending: true }),
    rowsOrMissing(table("chatbot_team_members").select("team_id, user_id").eq("organization_id", organizationId)),
    rowsOrMissing(table("chatbot_teams").select("id, name").eq("organization_id", organizationId)),
    rowsOrMissing(table("chatbot_products").select("id, name").eq("organization_id", organizationId).order("name", { ascending: true })),
    rowsOrMissing(table("chatbot_contact_products").select("contact_id, product_id").eq("organization_id", organizationId)),
  ]);
  if (profiles.error) fail(schemaMessage(profiles.error.message));
  const profileIds = (profiles.data ?? []).map((row) => row.id);
  const roles = profileIds.length
    ? await supabaseAdmin.from("user_roles").select("user_id, role").in("user_id", profileIds)
    : { data: [], error: null };
  if (roles.error) fail(schemaMessage(roles.error.message));
  const attendantIds = new Set((roles.data ?? []).filter((row) => row.role === "client_user").map((row) => row.user_id));
  const ownerIds = new Set((roles.data ?? []).filter((row) => row.role === "master" || row.role === "client_admin").map((row) => row.user_id));
  const memberIds = new Set(members.rows.map((row) => cell(row, "user_id")));
  const teamName = new Map(teams.rows.map((row) => [cell(row, "id"), cell(row, "name")]));
  const teamsOf = new Map<string, string[]>();
  for (const member of members.rows) {
    const name = teamName.get(cell(member, "team_id"));
    const memberId = cell(member, "user_id");
    if (!name || !memberId) continue;
    teamsOf.set(memberId, [...(teamsOf.get(memberId) ?? []), name]);
  }
  return {
    userId,
    admin,
    stages: listedStages.stages.map((item) => item.name),
    channels: connections.map((row) => ({
      id: cell(row, "id"),
      name: cell(row, "display_name") || cell(row, "phone") || "Canal sem nome",
    })),
    attendants: (profiles.data ?? [])
      .filter((row) => attendantIds.has(row.id) || (ownerIds.has(row.id) && memberIds.has(row.id)))
      .map((row) => ({
        id: row.id,
        name: row.full_name.trim() || "Atendente",
        team: (teamsOf.get(row.id) ?? []).join(", "),
      })),
    conversations: conversations.map((row) => ({
      id: cell(row, "id"),
      contactId: cell(row, "contact_id"),
      connectionId: cell(row, "connection_id"),
      assigneeId: cell(row, "assignee_id"),
      assumedBy: cell(row, "assumed_by"),
      finishedCount: Number(row["finished_count"]) || 0,
      createdAt: cell(row, "created_at"),
    })),
    contacts: contacts.map((row) => {
      const raw = row["negotiated_cents"];
      const amount = raw == null || raw === "" ? null : Number(raw);
      return {
        id: cell(row, "id"),
        negotiatedCents: amount != null && Number.isFinite(amount) ? Math.trunc(amount) : null,
        stage: cell(row, "stage_name"),
        stageSetBy: cell(row, "stage_set_by"),
        ownerId: cell(row, "client_owner_id"),
      };
    }),
    ratings: ratings.rows.map((row) => ({
      conversationId: cell(row, "conversation_id"),
      score: Number(row["score"]) || 0,
      createdAt: cell(row, "created_at"),
    })),
    products: products.rows.map((row) => ({ id: cell(row, "id"), name: cell(row, "name") })).filter((item) => item.id && item.name),
    productLinks: productLinks.rows.map((row) => ({ contactId: cell(row, "contact_id"), productId: cell(row, "product_id") })),
  };
}

async function setMemberTeams(organizationId: string, attendantId: string, teamIds: string[], replace: boolean) {
  if (replace) await done(table("chatbot_team_members").delete().eq("user_id", attendantId).eq("organization_id", organizationId));
  for (const teamId of teamIds) {
    const inserted = await table("chatbot_team_members")
      .insert({ team_id: teamId, user_id: attendantId, organization_id: organizationId })
      .select("team_id")
      .maybeSingle();
    if (inserted.error && !duplicate(inserted.error)) fail(schemaMessage(inserted.error.message));
  }
}
