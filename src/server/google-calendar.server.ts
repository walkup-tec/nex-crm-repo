import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { chatbotMenuAllowed, chatbotMenusFromStorage } from "@/lib/chatbot-menus";
import {
  canReadAvailability,
  googleCalendarForMms,
  googleCalendarScopes,
  googleFailure,
  meetingGuests,
  meetingRecordId,
  meetingSlot,
  meetingTimeZone,
  meetingCalendar,
  markMeetingCalendar,
  agendaEmailList,
  meetUrlFromEvent,
  overlapsBusy,
  remoteMeetingPatch,
  standardMeetingDescription,
  standardMeetingTitle,
  type GoogleCalendarConnectionView,
  type GoogleEventShape,
  type LeadMeetingView,
  type MeetingStatus,
} from "@/lib/google-calendar";

type Row = Record<string, unknown>;
type DbError = { message: string };
type Page = { data: Row[] | null; error: DbError | null };
type One = { data: Row | null; error: DbError | null };

interface Builder extends PromiseLike<Page> {
  select(columns?: string): Builder;
  insert(value: Row): Builder;
  update(value: Row): Builder;
  upsert(value: Row, options: { onConflict: string }): Builder;
  delete(): Builder;
  eq(column: string, value: string): Builder;
  in(column: string, values: string[]): Builder;
  is(column: string, value: null): Builder;
  lt(column: string, value: string): Builder;
  gte(column: string, value: string): Builder;
  order(column: string, options: { ascending: boolean }): Builder;
  limit(count: number): Builder;
  maybeSingle(): Promise<One>;
}

type GoogleBody = { status: number; body: unknown };

function fail(message: string): never {
  throw new Error(message);
}

function from(name: string) {
  return (supabaseAdmin as unknown as { from: (table: string) => Builder }).from(name);
}

function cell(row: Row, key: string) {
  const value = row[key];
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function emailsOf(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function schemaFail(message: string): never {
  if (/google_calendar_connections|google_oauth_states|lead_meetings/i.test(message)) {
    fail("Falta aplicar a migração do Google Calendar no Supabase.");
  }
  fail("Não foi possível concluir a operação do Google Calendar.");
}

async function rows(query: PromiseLike<Page>) {
  const result = await query;
  if (result.error) schemaFail(result.error.message);
  return result.data ?? [];
}

function calendarConfig() {
  const clientId = process.env["GOOGLE_CALENDAR_CLIENT_ID"] || process.env["GOOGLE_CLIENT_ID"];
  const clientSecret = process.env["GOOGLE_CALENDAR_CLIENT_SECRET"] || process.env["GOOGLE_CLIENT_SECRET"];
  const redirectUri = process.env["GOOGLE_CALENDAR_REDIRECT_URI"] || process.env["GOOGLE_REDIRECT_URI"] || "https://app.nexmeta.com.br/auth/google/callback";
  if (!clientId || !clientSecret) fail("A conexão com o Google Calendar não está configurada no servidor.");
  return { clientId, clientSecret, redirectUri };
}

function tokenKey() {
  const raw = process.env["GOOGLE_CALENDAR_TOKEN_ENCRYPTION_KEY"];
  if (!raw) fail("A criptografia do Google Calendar não está configurada no servidor.");
  const decoded = Buffer.from(raw, "base64");
  if (decoded.length === 32) return decoded;
  return createHash("sha256").update(raw).digest();
}

function encryptToken(token: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", tokenKey(), iv);
  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

function decryptToken(payload: string) {
  const [iv, tag, data] = payload.split(".");
  if (!iv || !tag || !data) fail("A conexão com o Google precisa ser refeita.");
  try {
    const decipher = createDecipheriv("aes-256-gcm", tokenKey(), Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
  } catch (error) {
    if (error instanceof Error && error.message.includes("configurada")) throw error;
    fail("A conexão com o Google precisa ser refeita.");
  }
}

async function access(userId: string, menu: "inbox" | "schedules") {
  const [{ data: profile, error: profileError }, { data: roles, error: roleError }] = await Promise.all([
    supabaseAdmin.from("profiles").select("organization_id, is_blocked").eq("id", userId).maybeSingle(),
    supabaseAdmin.from("user_roles").select("role").eq("user_id", userId),
  ]);
  if (profileError) fail("Não foi possível confirmar o acesso.");
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
    if (perms.error) fail("Não foi possível confirmar o acesso.");
    if (perms.data?.can_use_chatbot !== true) fail("Você não tem permissão para usar o chatbot.");
    const stored = perms.data && "chatbot_menus" in perms.data ? perms.data.chatbot_menus : null;
    menus = chatbotMenusFromStorage(stored);
    if (!chatbotMenuAllowed(menus, menu)) fail("Você não tem permissão para esta área do chatbot.");
  }
  return { organizationId: profile.organization_id, admin, manager: admin || menus.overview };
}

async function accessAny(userId: string, menus: ("inbox" | "schedules")[]) {
  let last = "Você não tem permissão para esta área do chatbot.";
  for (const menu of menus) {
    try {
      return await access(userId, menu);
    } catch (error) {
      last = error instanceof Error ? error.message : last;
      if (!/permissão para esta área/.test(last)) throw error;
    }
  }
  fail(last);
}

function connectionView(row: Row | null): GoogleCalendarConnectionView {
  const status = cell(row ?? {}, "connection_status");
  const known = status === "pending" || status === "connected" || status === "error" || status === "disconnected" ? status : "missing";
  return {
    enabled: true,
    status: known,
    email: cell(row ?? {}, "google_account_email"),
    calendarId: cell(row ?? {}, "calendar_id") || "primary",
  };
}

const hiddenCalendar: GoogleCalendarConnectionView = { enabled: false, status: "missing", email: "", calendarId: "primary" };

async function mmsCalendar(organizationId: string) {
  const org = await supabaseAdmin.from("organizations").select("legal_name").eq("id", organizationId).maybeSingle();
  if (org.error || !org.data?.legal_name) fail("Sua conta ainda não está ligada a uma empresa.");
  return googleCalendarForMms(org.data.legal_name);
}

async function requireMms(organizationId: string) {
  if (!(await mmsCalendar(organizationId))) fail("O Google Calendar está disponível apenas para o MMS Master.");
}

async function connectionForUser(organizationId: string, userId: string) {
  const result = await from("google_calendar_connections").select("*").eq("organization_id", organizationId).eq("user_id", userId).maybeSingle();
  if (result.error) schemaFail(result.error.message);
  return result.data;
}

function googleReason(body: unknown) {
  if (!body || typeof body !== "object") return "";
  const error = (body as { error?: unknown }).error;
  if (typeof error === "string") return error.slice(0, 80);
  if (!error || typeof error !== "object") return "";
  const errors = (error as { errors?: unknown }).errors;
  if (Array.isArray(errors) && errors[0] && typeof errors[0] === "object") {
    const reason = (errors[0] as { reason?: unknown }).reason;
    if (typeof reason === "string") return reason.slice(0, 80);
  }
  const status = (error as { status?: unknown }).status;
  return typeof status === "string" ? status.slice(0, 80) : "";
}

async function googleJson(token: string, url: string, init?: { method?: string; body?: unknown }): Promise<GoogleBody> {
  const response = await fetch(url, {
    method: init?.method ?? "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      ...(init?.body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: init?.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const text = await response.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text) as unknown;
    } catch {
      body = null;
    }
  }
  return { status: response.status, body };
}

async function tokenRequest(payload: URLSearchParams) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: payload,
  });
  const text = await response.text();
  let body: { access_token?: string; refresh_token?: string; expires_in?: number; scope?: string; error?: string } = {};
  try {
    body = JSON.parse(text) as typeof body;
  } catch {
    body = {};
  }
  if (!response.ok || !body.access_token) fail(googleFailure(response.status, body.error || ""));
  return body;
}

async function refreshAccess(refreshToken: string) {
  const config = calendarConfig();
  return tokenRequest(new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: config.clientId,
    client_secret: config.clientSecret,
  }));
}

async function saveTokens(connection: Row, accessToken: string, expiresIn: number, refreshToken = "") {
  const now = new Date().toISOString();
  const payload: Row = {
    access_token_encrypted: encryptToken(accessToken),
    token_expires_at: new Date(Date.now() + Math.max(60, expiresIn) * 1000).toISOString(),
    connection_status: "connected",
    last_error: null,
    updated_at: now,
  };
  if (refreshToken) payload.encrypted_refresh_token = encryptToken(refreshToken);
  const saved = await from("google_calendar_connections").update(payload).eq("id", cell(connection, "id")).select("id").maybeSingle();
  if (saved.error) schemaFail(saved.error.message);
  return { ...connection, ...payload };
}

async function markDisconnected(connection: Row) {
  const now = new Date().toISOString();
  await from("google_calendar_connections").update({
    connection_status: "disconnected",
    access_token_encrypted: null,
    encrypted_refresh_token: null,
    token_expires_at: null,
    sync_token: null,
    last_error: "A conexão com o Google expirou.",
    updated_at: now,
  }).eq("id", cell(connection, "id"));
}

async function usableToken(connection: Row) {
  const expires = Date.parse(cell(connection, "token_expires_at"));
  const encrypted = cell(connection, "access_token_encrypted");
  if (encrypted && Number.isFinite(expires) && expires > Date.now() + 60_000) {
    return { accessToken: decryptToken(encrypted), connection };
  }
  const refresh = cell(connection, "encrypted_refresh_token");
  if (!refresh) fail("Conecte o Google Calendar antes de agendar.");
  try {
    const renewed = await refreshAccess(decryptToken(refresh));
    const next = await saveTokens(connection, renewed.access_token || "", renewed.expires_in || 3600, renewed.refresh_token || "");
    return { accessToken: renewed.access_token || "", connection: next };
  } catch (error) {
    await markDisconnected(connection);
    if (error instanceof Error && /expirou|Conecte/.test(error.message)) throw error;
    fail("A conexão com o Google expirou. Conecte novamente.");
  }
}

async function withGoogle(connection: Row, run: (token: string) => Promise<GoogleBody>) {
  const first = await usableToken(connection);
  let result = await run(first.accessToken);
  if (result.status !== 401) return { ...result, connection: first.connection };
  const refresh = cell(first.connection, "encrypted_refresh_token");
  if (!refresh) {
    await markDisconnected(first.connection);
    fail("A conexão com o Google expirou. Conecte novamente.");
  }
  try {
    const renewed = await refreshAccess(decryptToken(refresh));
    const next = await saveTokens(first.connection, renewed.access_token || "", renewed.expires_in || 3600, renewed.refresh_token || "");
    result = await run(renewed.access_token || "");
    if (result.status === 401) {
      await markDisconnected(next);
      fail("A conexão com o Google expirou. Conecte novamente.");
    }
    return { ...result, connection: next };
  } catch (error) {
    await markDisconnected(first.connection);
    if (error instanceof Error && /expirou|Conecte/.test(error.message)) throw error;
    fail("A conexão com o Google expirou. Conecte novamente.");
  }
}

function requireConnected(row: Row | null) {
  if (!row || cell(row, "connection_status") !== "connected" || !cell(row, "encrypted_refresh_token")) {
    fail("Conecte o Google Calendar antes de agendar.");
  }
  return row;
}

export async function startGoogleCalendarConnect(userId: string) {
  const gate = await access(userId, "schedules");
  await requireMms(gate.organizationId);
  const config = calendarConfig();
  const state = randomBytes(32).toString("base64url");
  const now = new Date().toISOString();
  await from("google_oauth_states").delete().lt("expires_at", now);
  const inserted = await from("google_oauth_states").insert({
    state,
    user_id: userId,
    organization_id: gate.organizationId,
    expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  }).select("id").maybeSingle();
  if (inserted.error) schemaFail(inserted.error.message);
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", googleCalendarScopes.join(" "));
  url.searchParams.set("state", state);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "select_account consent");
  url.searchParams.set("include_granted_scopes", "true");
  return { url: url.toString() };
}

export async function completeGoogleCalendarOAuth(userId: string, input: { code?: string; state?: string; error?: string }) {
  if (input.error === "access_denied") fail("A autorização do Google foi cancelada.");
  if (input.error) fail("O Google não concluiu a autorização.");
  if (!input.code || !input.state) fail("A autorização do Google voltou incompleta.");
  const row = await from("google_oauth_states").select("id, user_id, organization_id, expires_at, used_at").eq("state", input.state).maybeSingle();
  if (row.error) schemaFail(row.error.message);
  if (!row.data || cell(row.data, "user_id") !== userId) fail("Esta conexão do Google não é válida. Comece de novo.");
  if (cell(row.data, "used_at")) fail("Esta conexão do Google já foi utilizada.");
  if (Date.parse(cell(row.data, "expires_at")) < Date.now()) fail("Esta conexão do Google expirou. Comece de novo.");
  const consumed = await from("google_oauth_states").update({ used_at: new Date().toISOString() }).eq("id", cell(row.data, "id")).is("used_at", null).select("id").maybeSingle();
  if (consumed.error) schemaFail(consumed.error.message);
  if (!consumed.data) fail("Esta conexão do Google já foi utilizada.");
  await requireMms(cell(row.data, "organization_id"));

  const config = calendarConfig();
  const exchanged = await tokenRequest(new URLSearchParams({
    code: input.code,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: config.redirectUri,
    grant_type: "authorization_code",
  }));
  const profile = await googleJson(exchanged.access_token || "", "https://openidconnect.googleapis.com/v1/userinfo");
  const email = profile.status === 200 && profile.body && typeof profile.body === "object" && typeof (profile.body as { email?: unknown }).email === "string"
    ? (profile.body as { email: string }).email.trim().toLowerCase()
    : "";
  if (!email) fail("O Google não informou o e-mail da conta. Conecte novamente.");
  const existing = await connectionForUser(cell(row.data, "organization_id"), userId);
  const storedRefresh = existing ? cell(existing, "encrypted_refresh_token") : "";
  const refreshToken = exchanged.refresh_token || (storedRefresh ? decryptToken(storedRefresh) : "");
  if (!refreshToken) fail("O Google não entregou a autorização permanente. Conecte novamente.");
  const now = new Date().toISOString();
  const saved = await from("google_calendar_connections").upsert({
    organization_id: cell(row.data, "organization_id"),
    user_id: userId,
    google_account_email: email,
    calendar_id: "primary",
    encrypted_refresh_token: encryptToken(refreshToken),
    access_token_encrypted: encryptToken(exchanged.access_token || ""),
    token_expires_at: new Date(Date.now() + (exchanged.expires_in || 3600) * 1000).toISOString(),
    scopes: exchanged.scope || googleCalendarScopes.join(" "),
    connection_status: "connected",
    sync_token: null,
    last_error: null,
    updated_at: now,
  }, { onConflict: "organization_id,user_id" }).select("id").maybeSingle();
  if (saved.error) schemaFail(saved.error.message);
  return { email };
}

export async function googleCalendarConnection(userId: string) {
  const gate = await access(userId, "schedules");
  if (!(await mmsCalendar(gate.organizationId))) return hiddenCalendar;
  return connectionView(await connectionForUser(gate.organizationId, userId));
}

export async function disconnectGoogleCalendar(userId: string) {
  const gate = await access(userId, "schedules");
  await requireMms(gate.organizationId);
  const connection = await connectionForUser(gate.organizationId, userId);
  if (!connection) return connectionView(null);
  const now = new Date().toISOString();
  const saved = await from("google_calendar_connections").update({
    connection_status: "disconnected",
    encrypted_refresh_token: null,
    access_token_encrypted: null,
    token_expires_at: null,
    sync_token: null,
    last_error: null,
    updated_at: now,
  }).eq("id", cell(connection, "id")).eq("organization_id", gate.organizationId).select("id, connection_status, google_account_email, calendar_id").maybeSingle();
  if (saved.error) schemaFail(saved.error.message);
  return connectionView(saved.data);
}

async function leadInOrg(organizationId: string, leadId: string) {
  if (!meetingRecordId(leadId)) fail("Escolha o lead da reunião.");
  const lead = await from("chatbot_contacts").select("id, name").eq("id", leadId).eq("organization_id", organizationId).maybeSingle();
  if (lead.error) schemaFail(lead.error.message);
  if (!lead.data) fail("Esse lead não está na sua empresa.");
  return lead.data;
}

export async function leadMeetingContext(userId: string, leadId: string) {
  const gate = await accessAny(userId, ["inbox", "schedules"]);
  await requireMms(gate.organizationId);
  const lead = await leadInOrg(gate.organizationId, leadId);
  const intake = await from("contracting_intakes").select("representative_email").eq("contact_id", leadId).eq("organization_id", gate.organizationId).order("created_at", { ascending: false }).limit(1).maybeSingle();
  let email = intake.error ? "" : cell(intake.data ?? {}, "representative_email");
  if (!email) {
    const saved = await from("lead_meetings").select("attendee_email, attendees").eq("lead_id", leadId).eq("organization_id", gate.organizationId).order("created_at", { ascending: false }).limit(20);
    if (!saved.error) email = agendaEmailList((saved.data ?? []).map((row) => ({ email: cell(row, "attendee_email"), attendees: row.attendees })))[0] ?? "";
  }
  const connection = await connectionForUser(gate.organizationId, userId);
  return {
    leadId,
    leadName: cell(lead, "name"),
    email,
    connected: cell(connection ?? {}, "connection_status") === "connected",
  };
}

function meetingView(row: Row, names: Map<string, string>, owners: Map<string, string>, userId: string, manager: boolean): LeadMeetingView {
  const status = cell(row, "status");
  const known: MeetingStatus = status === "cancelled" || status === "failed" ? status : "scheduled";
  const ownerId = cell(row, "user_id");
  return {
    id: cell(row, "id"),
    leadId: cell(row, "lead_id"),
    leadName: names.get(cell(row, "lead_id")) || "Lead",
    userId: ownerId,
    ownerName: owners.get(ownerId) || "",
    title: cell(row, "title"),
    description: cell(row, "description"),
    attendeeEmail: cell(row, "attendee_email"),
    attendees: emailsOf(row.attendees),
    startAt: cell(row, "start_at"),
    endAt: cell(row, "end_at"),
    timezone: cell(row, "timezone") || meetingTimeZone,
    meetUrl: cell(row, "meet_url"),
    calendarUrl: cell(row, "calendar_url"),
    status: known,
    mine: ownerId === userId,
    canManage: manager || ownerId === userId,
  };
}

async function decorate(list: Row[], userId: string, manager: boolean) {
  const leadIds = [...new Set(list.map((row) => cell(row, "lead_id")).filter(Boolean))];
  const ownerIds = [...new Set(list.map((row) => cell(row, "user_id")).filter(Boolean))];
  const [leads, owners] = await Promise.all([
    leadIds.length ? rows(from("chatbot_contacts").select("id, name").in("id", leadIds)) : Promise.resolve([]),
    ownerIds.length ? rows(from("profiles").select("id, full_name").in("id", ownerIds)) : Promise.resolve([]),
  ]);
  const names = new Map(leads.map((row) => [cell(row, "id"), cell(row, "name")]));
  const ownerNames = new Map(owners.map((row) => [cell(row, "id"), cell(row, "full_name")]));
  return list.map((row) => meetingView(row, names, ownerNames, userId, manager));
}

function shown(list: LeadMeetingView[]) {
  const view = list[0];
  if (!view) fail("Não foi possível concluir o agendamento no Google Calendar.");
  return view;
}

function eventItems(body: unknown) {
  if (!body || typeof body !== "object" || !Array.isArray((body as { items?: unknown }).items)) return [];
  return (body as { items: GoogleEventShape[] }).items;
}

async function listedEvents(token: string, calendarId: string, syncToken: string) {
  const events: GoogleEventShape[] = [];
  let page = "";
  let nextSyncToken = "";
  for (let index = 0; index < 4; index += 1) {
    const params = new URLSearchParams({ singleEvents: "true", showDeleted: "true", maxResults: "50" });
    if (syncToken) params.set("syncToken", syncToken);
    else params.set("timeMin", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
    if (page) params.set("pageToken", page);
    const result = await googleJson(token, `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events?${params}`);
    if (result.status === 410) return { status: 410, events, nextSyncToken: "" };
    if (result.status !== 200) return { status: result.status, events, nextSyncToken: "" };
    const body = result.body as { nextPageToken?: string; nextSyncToken?: string };
    events.push(...eventItems(result.body));
    if (typeof body?.nextSyncToken === "string") nextSyncToken = body.nextSyncToken;
    if (!body?.nextPageToken) break;
    page = body.nextPageToken;
  }
  return { status: 200, events, nextSyncToken };
}

async function syncConnection(organizationId: string, connection: Row) {
  if (cell(connection, "connection_status") !== "connected") return;
  const calendarId = encodeURIComponent(cell(connection, "calendar_id") || "primary");
  const loaded = await withGoogle(connection, async (token) => {
    const page = await listedEvents(token, calendarId, cell(connection, "sync_token"));
    return { status: page.status, body: page };
  });
  let page = loaded.body as { status: number; events: GoogleEventShape[]; nextSyncToken: string };
  if (page.status === 410) {
    await from("google_calendar_connections").update({ sync_token: null, updated_at: new Date().toISOString() }).eq("id", cell(connection, "id"));
    const again = await withGoogle(loaded.connection, async (token) => {
      const listed = await listedEvents(token, calendarId, "");
      return { status: listed.status, body: listed };
    });
    page = again.body as typeof page;
  }
  if (page.status !== 200) return;
  const ids = page.events.map((event) => event.id || "").filter(Boolean);
  if (ids.length) {
    const locals = await rows(from("lead_meetings").select("*").eq("organization_id", organizationId).in("google_event_id", ids));
    const byEvent = new Map(locals.map((row) => [cell(row, "google_event_id"), row]));
    for (const event of page.events) {
      const local = event.id ? byEvent.get(event.id) : undefined;
      if (!local) continue;
      const patch = remoteMeetingPatch({
        startAt: cell(local, "start_at"),
        endAt: cell(local, "end_at"),
        status: cell(local, "status"),
        meetUrl: cell(local, "meet_url"),
        calendarUrl: cell(local, "calendar_url"),
      }, event);
      if (!patch) continue;
      await from("lead_meetings").update({
        status: patch.status,
        start_at: patch.startAt,
        end_at: patch.endAt,
        meet_url: patch.meetUrl || null,
        calendar_url: patch.calendarUrl || null,
        updated_at: new Date().toISOString(),
      }).eq("id", cell(local, "id")).eq("organization_id", organizationId);
    }
  }
  await from("google_calendar_connections").update({
    sync_token: page.nextSyncToken || null,
    last_sync_at: new Date().toISOString(),
    last_error: null,
    updated_at: new Date().toISOString(),
  }).eq("id", cell(loaded.connection, "id"));
}

async function syncQuietly(organizationId: string, userId: string, manager: boolean) {
  try {
    const mine = await connectionForUser(organizationId, userId);
    if (mine) await syncConnection(organizationId, mine);
    if (!manager) return;
    const others = await rows(from("google_calendar_connections").select("*").eq("organization_id", organizationId).eq("connection_status", "connected").limit(8));
    for (const connection of others) {
      if (cell(connection, "user_id") === userId) continue;
      await syncConnection(organizationId, connection);
    }
  } catch (error) {
    console.error("google_calendar_sync", error instanceof Error ? error.name : "error");
  }
}

export async function listLeadMeetings(userId: string, leadId = "") {
  const gate = leadId ? await accessAny(userId, ["inbox", "schedules"]) : await access(userId, "schedules");
  if (!(await mmsCalendar(gate.organizationId))) return [];
  if (leadId) await leadInOrg(gate.organizationId, leadId);
  await syncQuietly(gate.organizationId, userId, gate.manager);
  let query = from("lead_meetings").select("*").eq("organization_id", gate.organizationId);
  if (leadId) query = query.eq("lead_id", leadId).order("start_at", { ascending: false }).limit(20);
  else {
    query = query.eq("status", "scheduled").gte("end_at", new Date().toISOString()).order("start_at", { ascending: true }).limit(50);
    if (!gate.manager) query = query.eq("user_id", userId);
  }
  return decorate((await rows(query)).filter((row) => cell(row, "status") !== "failed"), userId, gate.manager);
}

export async function listMeetingCalendar(userId: string) {
  const gate = await access(userId, "schedules");
  if (!(await mmsCalendar(gate.organizationId))) return [];
  const days = meetingCalendar();
  const first = days[0];
  const last = days[days.length - 1];
  if (!first || !last) return days;
  const rangeStart = new Date(`${first.date}T00:00:00-03:00`).toISOString();
  const rangeEnd = new Date(`${last.date}T23:59:59-03:00`).toISOString();
  const named: { start: string; end: string; note?: string }[] = [];
  const stored = await from("lead_meetings").select("start_at, end_at, lead_id").eq("organization_id", gate.organizationId).eq("user_id", userId).eq("status", "scheduled").gte("end_at", rangeStart).lt("start_at", rangeEnd).order("start_at", { ascending: true }).limit(200);
  if (!stored.error) {
    const rows = stored.data ?? [];
    const leadIds = [...new Set(rows.map((row) => cell(row, "lead_id")).filter(Boolean))];
    const leads = leadIds.length ? await from("chatbot_contacts").select("id, name").in("id", leadIds) : { data: [], error: null };
    const names = new Map((leads.error ? [] : leads.data ?? []).map((row) => [cell(row, "id"), cell(row, "name")]));
    for (const row of rows) {
      const start = cell(row, "start_at");
      const end = cell(row, "end_at");
      if (start && end) named.push({ start, end, note: names.get(cell(row, "lead_id")) || "Ocupado" });
    }
  }
  const connection = await connectionForUser(gate.organizationId, userId);
  if (connection && cell(connection, "connection_status") === "connected") {
    try {
      const busy = await busyRanges(connection, rangeStart, rangeEnd);
      for (const block of busy ?? []) named.push(block);
    } catch (error) {
      console.error("google_calendar_busy", error instanceof Error ? error.name : "error");
    }
  }
  return markMeetingCalendar(days, named);
}

async function busyRanges(connection: Row, start: string, end: string) {
  if (!canReadAvailability(cell(connection, "scopes"))) return null;
  const calendarId = cell(connection, "calendar_id") || "primary";
  const result = await withGoogle(connection, (token) => googleJson(token, "https://www.googleapis.com/calendar/v3/freeBusy", {
    method: "POST",
    body: { timeMin: start, timeMax: end, timeZone: meetingTimeZone, items: [{ id: calendarId }] },
  }));
  if (result.status !== 200) fail(googleFailure(result.status, googleReason(result.body)));
  const calendars = result.body && typeof result.body === "object" ? (result.body as { calendars?: Record<string, { busy?: { start?: string; end?: string }[]; errors?: unknown[] }> }).calendars : undefined;
  const entry = calendars?.[calendarId];
  if (entry?.errors?.length) fail("Não foi possível consultar a disponibilidade. Tente de novo.");
  const busy = Object.values(calendars ?? {}).flatMap((calendar) => calendar.busy ?? []);
  return busy
    .map((block) => ({ start: block.start || "", end: block.end || "" }))
    .filter((block) => block.start && block.end);
}

async function findExistingEvent(token: string, calendarId: string, requestId: string) {
  const params = new URLSearchParams({
    privateExtendedProperty: `nexRequestId=${requestId}`,
    maxResults: "2",
    singleEvents: "true",
  });
  const result = await googleJson(token, `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events?${params}`);
  if (result.status !== 200) return null;
  return eventItems(result.body).find((event) => event.id && event.status !== "cancelled") ?? null;
}

async function readMeet(token: string, calendarId: string, event: GoogleEventShape) {
  let current = event;
  for (let attempt = 0; attempt < 3 && current.id && !meetUrlFromEvent(current); attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 400));
    const loaded = await googleJson(token, `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${encodeURIComponent(current.id)}`);
    if (loaded.status === 200 && loaded.body && typeof loaded.body === "object") current = loaded.body as GoogleEventShape;
  }
  return current;
}

function storedEvent(event: GoogleEventShape) {
  return {
    google_event_id: event.id || null,
    meet_url: meetUrlFromEvent(event) || null,
    calendar_url: event.htmlLink && /^https:\/\//.test(event.htmlLink) ? event.htmlLink : null,
    status: "scheduled",
    updated_at: new Date().toISOString(),
  };
}

export async function createLeadMeeting(userId: string, input: {
  leadId: string;
  requestId: string;
  email: string;
  attendees: string;
  date: string;
  time: string;
  meet: boolean;
}) {
  const gate = await accessAny(userId, ["inbox", "schedules"]);
  await requireMms(gate.organizationId);
  if (!meetingRecordId(input.requestId)) fail("Esse agendamento não é válido. Abra o formulário de novo.");
  const title = standardMeetingTitle;
  const description = standardMeetingDescription;
  const slot = meetingSlot({ date: input.date, time: input.time });
  if (!slot) fail("Escolha um dia e um horário disponíveis.");
  const lead = await leadInOrg(gate.organizationId, input.leadId);
  const connection = requireConnected(await connectionForUser(gate.organizationId, userId));
  const guests = meetingGuests(input.email, input.attendees, cell(connection, "google_account_email"));
  if ("error" in guests) fail(guests.error);
  const calendarId = encodeURIComponent(cell(connection, "calendar_id") || "primary");

  const existing = await from("lead_meetings").select("*").eq("organization_id", gate.organizationId).eq("request_id", input.requestId).maybeSingle();
  if (existing.error) schemaFail(existing.error.message);
  if (existing.data && cell(existing.data, "google_event_id") && cell(existing.data, "status") === "scheduled") {
    return shown(await decorate([existing.data], userId, gate.manager));
  }

  let reserved = existing.data;
  if (!reserved) {
    const inserted = await from("lead_meetings").insert({
      organization_id: gate.organizationId,
      lead_id: cell(lead, "id"),
      user_id: userId,
      google_connection_id: cell(connection, "id"),
      request_id: input.requestId,
      title,
      description,
      attendee_email: guests.lead,
      attendees: guests.emails,
      start_at: slot.start,
      end_at: slot.end,
      timezone: meetingTimeZone,
      status: "scheduled",
      updated_at: new Date().toISOString(),
    }).select("*").maybeSingle();
    if (inserted.error) {
      if (!/duplicate key|23505/i.test(inserted.error.message)) schemaFail(inserted.error.message);
      const raced = await from("lead_meetings").select("*").eq("organization_id", gate.organizationId).eq("request_id", input.requestId).maybeSingle();
      if (raced.data && cell(raced.data, "google_event_id")) return shown(await decorate([raced.data], userId, gate.manager));
      fail("Esse agendamento já está sendo criado. Tente de novo em instantes.");
    }
    reserved = inserted.data;
  }
  if (!reserved) fail("Esse agendamento já está sendo criado. Tente de novo em instantes.");

  try {
    const busy = await busyRanges(connection, slot.start, slot.end);
    if (busy && overlapsBusy(slot.start, slot.end, busy)) fail("Esse horário já está ocupado na agenda.");
    const saved = await withGoogle(connection, async (token) => {
      const found = await findExistingEvent(token, calendarId, input.requestId);
      if (found) return { status: 200, body: found };
      const event: Row = {
        summary: title,
        description,
        start: { dateTime: slot.start, timeZone: meetingTimeZone },
        end: { dateTime: slot.end, timeZone: meetingTimeZone },
        extendedProperties: { private: { nexRequestId: input.requestId } },
      };
      if (guests.emails.length) event.attendees = guests.emails.map((email) => ({ email }));
      if (input.meet) {
        event.conferenceData = {
          createRequest: {
            requestId: input.requestId,
            conferenceSolutionKey: { type: "hangoutsMeet" },
          },
        };
      }
      const params = new URLSearchParams({ sendUpdates: "all" });
      if (input.meet) params.set("conferenceDataVersion", "1");
      const created = await googleJson(token, `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events?${params}`, { method: "POST", body: event });
      if ((created.status !== 200 && created.status !== 201) || !created.body || typeof created.body !== "object") return created;
      const ready = input.meet ? await readMeet(token, calendarId, created.body as GoogleEventShape) : created.body as GoogleEventShape;
      return { status: 200, body: ready };
    });
    if ((saved.status !== 200 && saved.status !== 201) || !saved.body || typeof saved.body !== "object") fail(googleFailure(saved.status, googleReason(saved.body)));
    const event = saved.body as GoogleEventShape;
    const updated = await from("lead_meetings").update({
      ...storedEvent(event),
      title,
      description,
      attendee_email: guests.lead,
      attendees: guests.emails,
      start_at: slot.start,
      end_at: slot.end,
      google_connection_id: cell(connection, "id"),
    }).eq("id", cell(reserved, "id")).eq("organization_id", gate.organizationId).select("*").maybeSingle();
    if (updated.error || !updated.data) schemaFail(updated.error?.message || "lead_meetings");
    return shown(await decorate([updated.data], userId, gate.manager));
  } catch (error) {
    await from("lead_meetings").update({ status: "failed", updated_at: new Date().toISOString() }).eq("id", cell(reserved, "id")).eq("organization_id", gate.organizationId).is("google_event_id", null);
    throw error;
  }
}

async function managedMeeting(userId: string, meetingId: string) {
  const gate = await accessAny(userId, ["inbox", "schedules"]);
  await requireMms(gate.organizationId);
  if (!meetingRecordId(meetingId)) fail("Essa reunião não é válida.");
  const result = await from("lead_meetings").select("*").eq("id", meetingId).eq("organization_id", gate.organizationId).maybeSingle();
  if (result.error) schemaFail(result.error.message);
  if (!result.data) fail("Essa reunião não está na sua empresa.");
  if (!gate.manager && cell(result.data, "user_id") !== userId) fail("Essa reunião está com outro usuário.");
  if (cell(result.data, "status") !== "scheduled") fail("Essa reunião não pode mais ser alterada.");
  const connectionId = cell(result.data, "google_connection_id");
  const connection = connectionId
    ? await from("google_calendar_connections").select("*").eq("id", connectionId).eq("organization_id", gate.organizationId).maybeSingle()
    : { data: null, error: null };
  if (connection.error) schemaFail(connection.error.message);
  return { gate, meeting: result.data, connection: requireConnected(connection.data) };
}

export async function rescheduleLeadMeeting(userId: string, input: { meetingId: string; date: string; time: string }) {
  const slot = meetingSlot({ date: input.date, time: input.time });
  if (!slot) fail("Escolha um dia e um horário disponíveis.");
  const { gate, meeting, connection } = await managedMeeting(userId, input.meetingId);
  const busy = await busyRanges(connection, slot.start, slot.end);
  if (busy && overlapsBusy(slot.start, slot.end, busy, { start: cell(meeting, "start_at"), end: cell(meeting, "end_at") })) {
    fail("Esse horário já está ocupado na agenda.");
  }
  const eventId = cell(meeting, "google_event_id");
  if (!eventId) fail("Essa reunião ainda não está no Google Calendar.");
  const calendarId = encodeURIComponent(cell(connection, "calendar_id") || "primary");
  const patched = await withGoogle(connection, (token) => googleJson(
    token,
    `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${encodeURIComponent(eventId)}?sendUpdates=all`,
    { method: "PATCH", body: { start: { dateTime: slot.start, timeZone: meetingTimeZone }, end: { dateTime: slot.end, timeZone: meetingTimeZone } } },
  ));
  if (patched.status !== 200 || !patched.body || typeof patched.body !== "object") fail(googleFailure(patched.status, googleReason(patched.body)));
  const event = patched.body as GoogleEventShape;
  const updated = await from("lead_meetings").update({
    start_at: slot.start,
    end_at: slot.end,
    meet_url: meetUrlFromEvent(event) || cell(meeting, "meet_url") || null,
    calendar_url: event.htmlLink && /^https:\/\//.test(event.htmlLink) ? event.htmlLink : cell(meeting, "calendar_url") || null,
    updated_at: new Date().toISOString(),
  }).eq("id", cell(meeting, "id")).eq("organization_id", gate.organizationId).select("*").maybeSingle();
  if (updated.error || !updated.data) schemaFail(updated.error?.message || "lead_meetings");
  return shown(await decorate([updated.data], userId, gate.manager));
}

export async function cancelLeadMeeting(userId: string, meetingId: string) {
  const { gate, meeting, connection } = await managedMeeting(userId, meetingId);
  const eventId = cell(meeting, "google_event_id");
  if (eventId) {
    const calendarId = encodeURIComponent(cell(connection, "calendar_id") || "primary");
    const removed = await withGoogle(connection, (token) => googleJson(
      token,
      `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${encodeURIComponent(eventId)}?sendUpdates=all`,
      { method: "DELETE" },
    ));
    if (removed.status !== 204 && removed.status !== 200 && removed.status !== 404 && removed.status !== 410) {
      fail(googleFailure(removed.status, googleReason(removed.body)));
    }
  }
  const updated = await from("lead_meetings").update({
    status: "cancelled",
    updated_at: new Date().toISOString(),
  }).eq("id", cell(meeting, "id")).eq("organization_id", gate.organizationId).select("*").maybeSingle();
  if (updated.error || !updated.data) schemaFail(updated.error?.message || "lead_meetings");
  return shown(await decorate([updated.data], userId, gate.manager));
}
