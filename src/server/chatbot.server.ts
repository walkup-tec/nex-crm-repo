import { evolutionRuntime } from "@/server/evo.server";
import { createOrganizationAttendant } from "@/server/users.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  attendancePhone,
  chatbotInstanceName,
  inboxOrder,
  inboxUnread,
  inboxVisible,
  evolutionConnectionStatus,
  evolutionContactPhone,
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
  type ChatbotConnectionStatus,
  type ChatbotSnapshot,
} from "@/lib/chatbot-evo";

type Query = {
  select: (columns?: string) => Query;
  insert: (value: Record<string, unknown> | Record<string, unknown>[]) => Query;
  update: (value: Record<string, unknown>) => Query;
  delete: () => Query;
  eq: (column: string, value: string) => Query;
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
  if (/chatbot_conversation_pins|chatbot_conversation_reads/i.test(message)) {
    return "A migração da caixa de entrada ainda não foi aplicada no Supabase.";
  }
  if (/chatbot_contact_files|media_kind|media_mime/i.test(message)) {
    return "A migração das mídias ainda não foi aplicada no Supabase.";
  }
  if (/chatbot_teams|chatbot_team_members/i.test(message)) {
    return "A migração das equipes ainda não foi aplicada no Supabase.";
  }
  if (/chatbot_|schema cache|does not exist|PGRST205/i.test(message)) {
    return "A migração do atendimento ainda não foi aplicada no Supabase.";
  }
  return "Não foi possível gravar o atendimento.";
}

async function membership(userId: string) {
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
  return { organizationId: profile.organization_id, admin };
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
  const found = listed.find((item) => item && typeof item === "object" && cell(item as Record<string, unknown>, "name") === instanceName);
  return found && typeof found === "object" ? (found as Record<string, unknown>) : null;
}

async function whatsappAlreadyRegistered(phone: string) {
  const listed = await evo("/instance/fetchInstances", "GET").catch(() => null);
  if (!Array.isArray(listed)) return false;
  return listed.some((item) => {
    if (!item || typeof item !== "object") return false;
    const record = item as Record<string, unknown>;
    return sameWhatsappAccount(phone, cell(record, "number")) || sameWhatsappAccount(phone, cell(record, "ownerJid"));
  });
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

export async function chatbotSnapshot(userId: string): Promise<ChatbotSnapshot> {
  const { organizationId, admin } = await membership(userId);
  const connectionRows = await rows(
    table("chatbot_connections").select("*").eq("organization_id", organizationId).order("created_at", { ascending: true }),
  );
  await Promise.all(connectionRows.map((row) => importEvolutionMessages(row).catch(() => null)));
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
  const freshAvatars = await refreshStaleAvatars(organizationId, connectionRows, contactRows, scopedConversations);
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
      avatarUrl: freshAvatars.has(cell(row, "id"))
        ? freshAvatars.get(cell(row, "id")) ?? ""
        : avatarCache.get(cell(row, "id")) ?? cell(row, "avatar_url"),
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
      mediaKind: cell(row, "media_kind") === "video" ? "video" as const : cell(row, "media_kind") === "image" ? "image" as const : "" as const,
      mediaMime: cell(row, "media_mime"),
      saved: savedMedia.has(cell(row, "id")),
    })),
  };
}

export async function createChatbotConnection(userId: string, name: string, phone: string) {
  const clean = name.trim();
  if (clean.length < 2) fail("Informe o nome de atendimento.");
  if (clean.length > 25) fail("O nome de atendimento pode ter no máximo 25 caracteres.");
  const number = attendancePhone(phone);
  if (!number) fail("Informe o número com DDD.");
  if (await whatsappAlreadyRegistered(number)) {
    fail("Esse número já está na API WhatsApp. Use o card existente e leia o QR Code uma única vez.");
  }
  const { organizationId, admin } = await membership(userId);
  if (!admin) fail("Somente o administrador da empresa pode conectar um WhatsApp.");
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
  const { organizationId } = await membership(userId);
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
  await importEvolutionMessages(updated.data ?? current).catch(() => null);
  return { status: next, qrCode, error: lastError };
}

export async function deleteChatbotConnection(userId: string, connectionId: string) {
  const { organizationId, admin } = await membership(userId);
  if (!admin) fail("Somente o administrador da empresa pode excluir um WhatsApp.");
  const current = await ownedConnection(organizationId, connectionId);
  const linkedTeam = await table("chatbot_teams")
    .select("id")
    .eq("connection_id", connectionId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (linkedTeam.error) {
    if (!/chatbot_teams|schema cache|does not exist|PGRST205/i.test(linkedTeam.error.message)) fail(schemaMessage(linkedTeam.error.message));
  } else if (linkedTeam.data) {
    fail("Esta conexão está ligada a uma equipe. Altere o canal da equipe antes de excluir o número.");
  }
  await removeEvolutionInstance(cell(current, "instance_name"));
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

async function removeEvolutionInstance(instanceName: string) {
  if (!instanceName) return;
  await evo(`/instance/logout/${encodeURIComponent(instanceName)}`, "DELETE").catch(() => null);
  try {
    await evo(`/instance/delete/${encodeURIComponent(instanceName)}`, "DELETE");
  } catch {
    const listed = await evo("/instance/fetchInstances", "GET").catch(() => null);
    const remains =
      Array.isArray(listed) &&
      listed.some((item) => item && typeof item === "object" && (item as Record<string, unknown>)["name"] === instanceName);
    if (remains) fail("Não foi possível excluir o número na Evolution.");
  }
}

export async function disconnectChatbotConnection(userId: string, connectionId: string) {
  const { organizationId, admin } = await membership(userId);
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
  const { organizationId, admin } = await membership(userId);
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
  const assigned = await table("chatbot_conversations")
    .update({
      status: "active",
      assignee_id: userId,
      bot_paused: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", conversationId)
    .eq("organization_id", organizationId)
    .select("id")
    .maybeSingle();
  if (assigned.error) fail(schemaMessage(assigned.error.message));
}

async function requireVisibleConversation(userId: string, conversationId: string) {
  const { organizationId, admin } = await membership(userId);
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

export async function assumeChatbotConversation(userId: string, conversationId: string) {
  const { organizationId, conversation } = await requireVisibleConversation(userId, conversationId);
  const assignee = cell(conversation, "assignee_id");
  if (assignee && assignee !== userId) fail("Essa conversa já está com outro atendente.");
  if (assignee === userId) return;
  const updated = await table("chatbot_conversations")
    .update({ status: "active", assignee_id: userId, bot_paused: true })
    .eq("id", conversationId)
    .eq("organization_id", organizationId)
    .select("id")
    .maybeSingle();
  if (updated.error) fail(schemaMessage(updated.error.message));
}

export async function chatbotTransferTargets(userId: string, conversationId: string) {
  const { organizationId, conversation } = await requireVisibleConversation(userId, conversationId);
  if (cell(conversation, "assignee_id") !== userId) fail("Só quem assumiu a conversa pode transferir.");
  const connectionId = cell(conversation, "connection_id");
  const [members, teams, profiles] = await Promise.all([
    rows(table("chatbot_team_members").select("team_id, user_id").eq("organization_id", organizationId)),
    rows(table("chatbot_teams").select("id, connection_id").eq("organization_id", organizationId)),
    supabaseAdmin.from("profiles").select("id, full_name").eq("organization_id", organizationId).order("full_name", { ascending: true }),
  ]);
  if (profiles.error) fail(schemaMessage(profiles.error.message));
  const teamIds = new Set(teams.filter((row) => cell(row, "connection_id") === connectionId).map((row) => cell(row, "id")));
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
  const attendants = new Set((roles.data ?? []).filter((row) => row.role === "client_user").map((row) => row.user_id));
  return (profiles.data ?? []).filter((row) => attendants.has(row.id)).map((row) => ({ id: row.id, name: row.full_name.trim() }));
}

export async function transferChatbotConversation(userId: string, conversationId: string, attendantId: string) {
  const targets = await chatbotTransferTargets(userId, conversationId);
  if (!targets.some((item) => item.id === attendantId)) fail("Esse atendente não atende este canal.");
  const { organizationId } = await requireVisibleConversation(userId, conversationId);
  const updated = await table("chatbot_conversations")
    .update({ status: "active", assignee_id: attendantId, bot_paused: true })
    .eq("id", conversationId)
    .eq("organization_id", organizationId)
    .eq("assignee_id", userId)
    .select("id")
    .maybeSingle();
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
    for (const item of evolutionIncomingMessages(payload["data"])) {
      await storeIncoming(found.data, item);
      await refreshMessageAvatar(found.data, item);
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

async function refreshMessageAvatar(connection: Record<string, unknown>, data: unknown) {
  const record = data && typeof data === "object" ? (data as Record<string, unknown>) : {};
  const rawKey = record["key"];
  const key = rawKey && typeof rawKey === "object" ? (rawKey as Record<string, unknown>) : {};
  if (key["fromMe"] === true) return;
  const phone = evolutionContactPhone(key);
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
  for (const item of items) await storeIncoming(connection, item);
}

async function contactIdForMessage(organizationId: string, phone: string, name: string) {
  const known = await rows(table("chatbot_contacts").select("id, phone").eq("organization_id", organizationId));
  const found = known.find((row) => cell(row, "phone") === phone || sameWhatsappAccount(cell(row, "phone"), phone));
  if (found) return cell(found, "id");
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

async function storeIncoming(connection: Record<string, unknown>, data: unknown) {
  const record = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;
  const rawKey = record["key"];
  const key = (rawKey && typeof rawKey === "object" ? rawKey : {}) as Record<string, unknown>;
  if (key["fromMe"] === true) return;
  const phone = evolutionContactPhone(key);
  const externalId = cell(key, "id");
  const content = evolutionMessageContent(record);
  const text = content.mediaKind ? content.text : evolutionMessageText(record["message"]);
  if (!phone || !externalId || (!text && !content.mediaKind)) return;
  const organizationId = cell(connection, "organization_id");
  const name = cell(record, "pushName") || phone;
  const contactId = await contactIdForMessage(organizationId, phone, name);
  if (!contactId) return;
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
        bot_paused: false,
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
      .insert({ ...messageRow, text: text || (content.mediaKind === "video" ? "[vídeo]" : "[imagem]") })
      .select("id")
      .maybeSingle();
    if (retry.error && !duplicate(retry.error)) return;
    inserted = !retry.error;
  } else if (saved.error) {
    return;
  }
  if (!inserted) return;
  await table("chatbot_conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", conversationId);
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

const mediaFileCache = new Map<string, { at: number; mime: string; base64: string; kind: "image" | "video" }>();

async function ownedChatMessage(userId: string, messageId: string) {
  const { organizationId, admin } = await membership(userId);
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

async function fetchEvolutionMedia(instanceName: string, externalId: string, video: boolean) {
  if (!instanceName || !externalId) return null;
  const cacheKey = `${instanceName}:${externalId}:${video ? "video" : "file"}`;
  const cached = mediaFileCache.get(cacheKey);
  if (cached && Date.now() - cached.at < 10 * 60 * 1000) return cached;
  const payload = await evo(
    `/chat/getBase64FromMediaMessage/${encodeURIComponent(instanceName)}`,
    "POST",
    { message: { key: { id: externalId } }, convertToMp4: video },
    60000,
  );
  let file = evolutionMediaFile(payload, video ? "video" : "");
  if (!video && file.kind === "video" && file.mime !== "video/mp4" && file.mime !== "video/webm") {
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
  return text === "[mensagem]" || text === "[imagem]" || text === "[vídeo]";
}

export async function chatbotMessageMedia(userId: string, messageId: string) {
  const owned = await ownedChatMessage(userId, messageId);
  const text = cell(owned.message, "text");
  const hinted = cell(owned.message, "media_kind") === "video" ? "video" : cell(owned.message, "media_kind") === "image" ? "image" : "";
  if (!hinted && !mediaPlaceholder(text)) fail("Essa mensagem não tem mídia.");
  let file: { mime: string; base64: string; kind: "image" | "video" } | null = null;
  try {
    file = await fetchEvolutionMedia(cell(owned.connection, "instance_name"), cell(owned.message, "external_id"), hinted === "video" || text === "[vídeo]");
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

async function ensureMediaBucket() {
  const existing = await supabaseAdmin.storage.getBucket(mediaBucket);
  if (!existing.error && existing.data) return;
  const created = await supabaseAdmin.storage.createBucket(mediaBucket, {
    public: false,
    fileSizeLimit: 40 * 1024 * 1024,
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif", "video/mp4", "video/webm", "video/quicktime", "video/3gpp"],
  });
  if (created.error && !/already exists|duplicate/i.test(created.error.message)) fail("Não foi possível guardar a mídia.");
}

export async function saveChatbotContactMedia(userId: string, messageId: string) {
  const owned = await ownedChatMessage(userId, messageId);
  const contactId = cell(owned.conversation, "contact_id");
  const existing = await table("chatbot_contact_files").select("id").eq("organization_id", owned.organizationId).eq("message_id", messageId).maybeSingle();
  if (existing.error) fail(schemaMessage(existing.error.message));
  if (existing.data) return { saved: true as const };
  const text = cell(owned.message, "text");
  const video = cell(owned.message, "media_kind") === "video" || text === "[vídeo]";
  const file = await fetchEvolutionMedia(cell(owned.connection, "instance_name"), cell(owned.message, "external_id"), video);
  if (!file) fail("Não foi possível salvar essa mídia.");
  await ensureMediaBucket();
  const id = crypto.randomUUID();
  const extension = file.mime.includes("png") ? "png" : file.mime.includes("webp") ? "webp" : file.mime.includes("gif") ? "gif" : file.kind === "video" ? "mp4" : "jpg";
  const storagePath = `${owned.organizationId}/${contactId}/${id}.${extension}`;
  const uploaded = await supabaseAdmin.storage.from(mediaBucket).upload(storagePath, Buffer.from(file.base64, "base64"), {
    contentType: file.mime,
    upsert: false,
  });
  if (uploaded.error) fail("Não foi possível salvar a mídia no contato.");
  const inserted = await table("chatbot_contact_files")
    .insert({
      id,
      organization_id: owned.organizationId,
      contact_id: contactId,
      message_id: messageId,
      name: file.kind === "video" ? `video.${extension}` : `imagem.${extension}`,
      mime_type: file.mime,
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
  const [members, teams] = await Promise.all([
    rows(table("chatbot_team_members").select("team_id, user_id").eq("organization_id", organizationId)),
    rows(table("chatbot_teams").select("id, connection_id").eq("organization_id", organizationId)),
  ]);
  const mine = new Set(members.filter((row) => cell(row, "user_id") === userId).map((row) => cell(row, "team_id")));
  return new Set(teams.filter((row) => mine.has(cell(row, "id"))).map((row) => cell(row, "connection_id")).filter(Boolean));
}

async function ownedTeams(organizationId: string, teamIds: string[]) {
  const teams = await rows(table("chatbot_teams").select("id").eq("organization_id", organizationId));
  const known = new Set(teams.map((row) => cell(row, "id")));
  if (!teamIds.length || teamIds.some((id) => !known.has(id))) fail("Selecione uma equipe desta empresa.");
}

export async function chatbotTeamSnapshot(userId: string) {
  const { organizationId, admin } = await membership(userId);
  if (!admin) fail("Somente o administrador da empresa pode ver as equipes.");
  const [teams, members, channels, profiles] = await Promise.all([
    rows(table("chatbot_teams").select("*").eq("organization_id", organizationId).order("created_at", { ascending: true })),
    rows(table("chatbot_team_members").select("team_id, user_id").eq("organization_id", organizationId)),
    rows(table("chatbot_connections").select("id, display_name, phone").eq("organization_id", organizationId).order("created_at", { ascending: true })),
    supabaseAdmin.from("profiles").select("id, full_name, email").eq("organization_id", organizationId).order("full_name", { ascending: true }),
  ]);
  if (profiles.error) fail(schemaMessage(profiles.error.message));
  const profileIds = (profiles.data ?? []).map((row) => row.id);
  const roles = profileIds.length
    ? await supabaseAdmin.from("user_roles").select("user_id, role").in("user_id", profileIds)
    : { data: [], error: null };
  if (roles.error) fail(schemaMessage(roles.error.message));
  const attendants = new Set((roles.data ?? []).filter((row) => row.role === "client_user").map((row) => row.user_id));
  const channelName = new Map(channels.map((row) => [cell(row, "id"), { name: cell(row, "display_name"), phone: cell(row, "phone") }]));
  return {
    channels: channels.map((row) => ({ id: cell(row, "id"), name: cell(row, "display_name"), phone: cell(row, "phone") })),
    teams: teams.map((row) => {
      const channel = channelName.get(cell(row, "connection_id"));
      return {
        id: cell(row, "id"),
        name: cell(row, "name"),
        connectionId: cell(row, "connection_id"),
        channelName: channel?.name ?? "",
        channelPhone: channel?.phone ?? "",
      };
    }),
    attendants: (profiles.data ?? [])
      .filter((row) => attendants.has(row.id))
      .map((row) => ({
        id: row.id,
        name: row.full_name,
        email: row.email,
        teamIds: members.filter((member) => cell(member, "user_id") === row.id).map((member) => cell(member, "team_id")),
      })),
  };
}

export async function createChatbotTeam(userId: string, name: string, connectionId: string) {
  const clean = name.trim();
  if (clean.length < 2) fail("Informe o nome da equipe.");
  if (clean.length > 40) fail("O nome da equipe pode ter no máximo 40 caracteres.");
  const { organizationId, admin } = await membership(userId);
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
}

export async function deleteChatbotTeam(userId: string, teamId: string) {
  const { organizationId, admin } = await membership(userId);
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
  const { organizationId, admin } = await membership(userId);
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
}

export async function resendAttendantInvite(userId: string, email: string, name: string) {
  const { organizationId, admin } = await membership(userId);
  if (!admin) fail("Somente o administrador da empresa pode reenviar o convite.");
  const address = email.trim().toLowerCase();
  const profile = await supabaseAdmin.from("profiles").select("id, email, full_name").eq("email", address).eq("organization_id", organizationId).maybeSingle();
  if (profile.error) fail(schemaMessage(profile.error.message));
  if (!profile.data) fail("Esse atendente não pertence à sua empresa.");
  await ownedAttendant(organizationId, profile.data.id);
  const { sendInviteEmail } = await import("@/server/mail.server");
  await sendInviteEmail(profile.data.email, name.trim() || profile.data.full_name);
}

export async function inviteChatbotAttendant(userId: string, name: string, email: string, teamIds: string[]) {
  const uniqueTeams = [...new Set(teamIds.map((id) => id.trim()).filter(Boolean))];
  const { organizationId, admin } = await membership(userId);
  if (!admin) fail("Somente o administrador da empresa pode convidar um atendente.");
  await ownedTeams(organizationId, uniqueTeams);
  const attendant = await createOrganizationAttendant(userId, name, email);
  await setMemberTeams(organizationId, attendant.id, uniqueTeams, false);
  return { created: attendant.created, emailSent: attendant.emailSent, mailError: attendant.mailError };
}

export async function setChatbotAttendantTeams(userId: string, attendantId: string, teamIds: string[]) {
  const uniqueTeams = [...new Set(teamIds.map((id) => id.trim()).filter(Boolean))];
  const { organizationId, admin } = await membership(userId);
  if (!admin) fail("Somente o administrador da empresa pode alterar as equipes.");
  await ownedTeams(organizationId, uniqueTeams);
  await ownedAttendant(organizationId, attendantId);
  await setMemberTeams(organizationId, attendantId, uniqueTeams, true);
}

export async function updateChatbotAttendant(userId: string, attendantId: string, name: string, email: string, teamIds: string[]) {
  const uniqueTeams = [...new Set(teamIds.map((id) => id.trim()).filter(Boolean))];
  const clean = name.trim();
  const address = email.trim().toLowerCase();
  if (clean.length < 2) fail("Informe o nome.");
  if (!address.includes("@")) fail("Informe um e-mail válido.");
  const { organizationId, admin } = await membership(userId);
  if (!admin) fail("Somente o administrador da empresa pode editar um atendente.");
  await ownedTeams(organizationId, uniqueTeams);
  const attendant = await ownedAttendant(organizationId, attendantId);
  const taken = await supabaseAdmin.from("profiles").select("id").eq("email", address).maybeSingle();
  if (taken.error) fail(schemaMessage(taken.error.message));
  if (taken.data && taken.data.id !== attendantId) fail("Já existe um acesso com este e-mail.");
  const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(attendantId, { email: address, email_confirm: true });
  if (authError) fail(/already|registered|exists/i.test(authError.message) ? "Já existe um acesso com este e-mail." : "Não foi possível atualizar o acesso.");
  const { error } = await supabaseAdmin.from("profiles").update({ full_name: clean, email: address }).eq("id", attendantId).eq("organization_id", organizationId);
  if (error) fail(schemaMessage(error.message));
  await setMemberTeams(organizationId, attendant.id, uniqueTeams, true);
}

export async function deleteChatbotAttendant(userId: string, attendantId: string) {
  const { organizationId, admin } = await membership(userId);
  if (!admin) fail("Somente o administrador da empresa pode excluir um atendente.");
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
