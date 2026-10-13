import { evolutionRuntime } from "@/server/evo.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  attendancePhone,
  chatbotInstanceName,
  evolutionConnectionStatus,
  evolutionContactPhone,
  evolutionIncomingMessages,
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

async function evo(path: string, method: "GET" | "POST" | "DELETE", payload?: unknown) {
  const { base, key } = evolutionRuntime();
  if (!base || !key) fail("A Evolution API ainda não está configurada no servidor.");
  const init: RequestInit = {
    method,
    headers: { "content-type": "application/json", apikey: key },
    signal: AbortSignal.timeout(20000),
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
  const { organizationId } = await membership(userId);
  const connectionRows = await rows(
    table("chatbot_connections").select("*").eq("organization_id", organizationId).order("created_at", { ascending: true }),
  );
  await Promise.all(connectionRows.map((row) => importEvolutionMessages(row).catch(() => null)));
  const [contactRows, conversationRows, messageRows] = await Promise.all([
    rows(table("chatbot_contacts").select("*").eq("organization_id", organizationId).order("name", { ascending: true })),
    rows(table("chatbot_conversations").select("*").eq("organization_id", organizationId).order("updated_at", { ascending: false })),
    rows(table("chatbot_messages").select("*").eq("organization_id", organizationId).order("created_at", { ascending: true }).limit(400)),
  ]);
  const assigneeIds = [...new Set(conversationRows.map((row) => cell(row, "assignee_id")).filter(Boolean))];
  const assigneeNames = new Map<string, string>();
  if (assigneeIds.length) {
    const people = await supabaseAdmin.from("profiles").select("id, full_name").in("id", assigneeIds);
    for (const person of people.data ?? []) assigneeNames.set(person.id, person.full_name.trim());
  }
  const freshAvatars = await refreshStaleAvatars(organizationId, connectionRows, contactRows, conversationRows);
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
    conversations: conversationRows.map((row) => ({
      id: cell(row, "id"),
      contactId: cell(row, "contact_id"),
      connectionId: cell(row, "connection_id"),
      status: cell(row, "status") as "queue" | "active" | "closed",
      assigneeName: assigneeNames.get(cell(row, "assignee_id")) ?? "",
      botPaused: row["bot_paused"] === true,
    })),
    messages: messageRows.map((row) => ({
      id: cell(row, "id"),
      conversationId: cell(row, "conversation_id"),
      text: cell(row, "text"),
      direction: cell(row, "direction") as "in" | "out",
      status: cell(row, "status") as "pending" | "sent" | "failed",
      createdAt: cell(row, "created_at"),
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
  const status = evolutionConnectionStatus(listedState || readState(stateBody));
  const removed = listedState === "close" && whatsappDeviceRemoved(listed?.["disconnectionReasonCode"]);
  const previous = cell(current, "status");
  const qrCode = withQr && status !== "connected" ? evolutionQrImage(await evo(`/instance/connect/${encodeURIComponent(instanceName)}`, "GET")) : "";
  const live = status === "connected" ? "connected" : qrCode ? "qr" : status;
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
  return { status: next, qrCode, error: "" };
}

export async function deleteChatbotConnection(userId: string, connectionId: string) {
  const { organizationId, admin } = await membership(userId);
  if (!admin) fail("Somente o administrador da empresa pode excluir um WhatsApp.");
  const current = await ownedConnection(organizationId, connectionId);
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
  const { organizationId } = await membership(userId);
  const conversation = await table("chatbot_conversations")
    .select("*")
    .eq("id", conversationId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (conversation.error) fail(schemaMessage(conversation.error.message));
  if (!conversation.data) fail("Essa conversa não pertence à sua empresa.");
  const contact = await table("chatbot_contacts")
    .select("phone")
    .eq("id", cell(conversation.data, "contact_id"))
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (contact.error) fail(schemaMessage(contact.error.message));
  const phone = cell(contact.data, "phone");
  if (!phone) fail("Esse contato não tem um telefone válido.");
  const connection = await ownedConnection(organizationId, cell(conversation.data, "connection_id"));
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

async function storeIncoming(connection: Record<string, unknown>, data: unknown) {
  const record = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;
  const rawKey = record["key"];
  const key = (rawKey && typeof rawKey === "object" ? rawKey : {}) as Record<string, unknown>;
  if (key["fromMe"] === true) return;
  const phone = evolutionContactPhone(key);
  const externalId = cell(key, "id");
  const text = evolutionMessageText(record["message"]);
  if (!phone || !text || !externalId) return;
  const organizationId = cell(connection, "organization_id");
  const name = cell(record, "pushName") || phone;
  const existingContact = await table("chatbot_contacts")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("phone", phone)
    .maybeSingle();
  let contactId = cell(existingContact.data, "id");
  if (!contactId) {
    const created = await table("chatbot_contacts")
      .insert({ organization_id: organizationId, name, phone })
      .select("id")
      .maybeSingle();
    if (created.error || !created.data) {
      if (!duplicate(created.error)) return;
      const again = await table("chatbot_contacts")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("phone", phone)
        .maybeSingle();
      contactId = cell(again.data, "id");
      if (!contactId) return;
    } else {
      contactId = cell(created.data, "id");
    }
  }
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
  const saved = await table("chatbot_messages")
    .insert({
      organization_id: organizationId,
      conversation_id: conversationId,
      text,
      direction: "in",
      status: "sent",
      external_id: externalId,
    })
    .select("id")
    .maybeSingle();
  if (saved.error && !duplicate(saved.error)) return;
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

async function done(query: Query) {
  const result = await (query as unknown as Promise<{ error: DbError | null }>);
  if (result.error) fail(schemaMessage(result.error.message));
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
