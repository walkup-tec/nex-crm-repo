import { returnInstant } from "@/lib/chatbot-evo";
import { keepsAccessWithoutPayment } from "@/lib/finance-access";

export const meetingTimeZone = "America/Sao_Paulo";

export const meetingDurations = [15, 30, 45, 60] as const;

export type MeetingDuration = (typeof meetingDurations)[number];

export const googleCalendarScopes = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.freebusy",
] as const;

export type MeetingStatus = "scheduled" | "cancelled" | "failed";

export type LeadMeetingView = {
  id: string;
  leadId: string;
  leadName: string;
  userId: string;
  ownerName: string;
  title: string;
  description: string;
  attendeeEmail: string;
  attendees: string[];
  startAt: string;
  endAt: string;
  timezone: string;
  meetUrl: string;
  calendarUrl: string;
  status: MeetingStatus;
  mine: boolean;
  canManage: boolean;
};

export type GoogleCalendarConnectionView = {
  enabled: boolean;
  status: "missing" | "pending" | "connected" | "error" | "disconnected";
  email: string;
  calendarId: string;
};

export function googleCalendarForMms(legalName: string) {
  return keepsAccessWithoutPayment(legalName);
}

export type GoogleEventShape = {
  id?: string;
  status?: string;
  htmlLink?: string;
  hangoutLink?: string;
  start?: { dateTime?: string };
  end?: { dateTime?: string };
  conferenceData?: { entryPoints?: { entryPointType?: string; uri?: string }[] };
};

const availabilityScopes = new Set([
  "https://www.googleapis.com/auth/calendar.freebusy",
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/calendar",
]);

export function meetingRecordId(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.trim());
}

export function cleanEmail(value: string) {
  const email = value.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
}

export function cleanMeetingTitle(value: string) {
  const title = value.trim().replace(/\s+/g, " ");
  if (title.length < 2 || title.length > 120) return "";
  return title;
}

export function cleanMeetingDescription(value: string) {
  const description = value.trim();
  if (description.length > 2000) return null;
  return description;
}

export function meetingDuration(value: number): MeetingDuration | null {
  return meetingDurations.includes(value as MeetingDuration) ? (value as MeetingDuration) : null;
}

export function meetingGuests(leadEmail: string, extra: string, organizerEmail = "") {
  const lead = cleanEmail(leadEmail);
  if (!lead) return { error: "Informe o e-mail do lead." } as const;
  const organizer = cleanEmail(organizerEmail);
  const emails: string[] = [];
  const add = (email: string) => {
    if (email !== organizer && !emails.includes(email)) emails.push(email);
  };
  add(lead);
  for (const piece of extra.split(/[\s,;]+/)) {
    if (!piece.trim()) continue;
    const email = cleanEmail(piece);
    if (!email) return { error: "Há um participante com e-mail inválido." } as const;
    add(email);
  }
  if (emails.length > 10) return { error: "A reunião aceita no máximo 10 participantes." } as const;
  return { lead, emails } as const;
}

export function meetingSlot(input: { date: string; time: string; duration: number }, now = Date.now()) {
  const match = /^(\d{2}):(\d{2})$/.exec(input.time);
  const duration = meetingDuration(input.duration);
  if (!match || !duration) return null;
  const start = returnInstant({ date: input.date, hour: Number(match[1]), minute: Number(match[2]) }, now);
  if (!start) return null;
  return { start, end: new Date(Date.parse(start) + duration * 60_000).toISOString(), duration };
}

export function meetingFields(startAt: string) {
  const parsed = new Date(startAt);
  if (Number.isNaN(parsed.getTime())) return { date: "", time: "" };
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: meetingTimeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(parsed);
  const read = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return { date: `${read("year")}-${read("month")}-${read("day")}`, time: `${read("hour")}:${read("minute")}` };
}

export function meetingLength(startAt: string, endAt: string): MeetingDuration {
  const minutes = Math.round((Date.parse(endAt) - Date.parse(startAt)) / 60_000);
  return meetingDuration(minutes) ?? 30;
}

export function meetingWhen(startAt: string, endAt: string) {
  const start = new Date(startAt);
  const end = new Date(endAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return "";
  const day = new Intl.DateTimeFormat("pt-BR", { timeZone: meetingTimeZone, day: "2-digit", month: "2-digit", year: "numeric" }).format(start);
  const clock = new Intl.DateTimeFormat("pt-BR", { timeZone: meetingTimeZone, hour: "2-digit", minute: "2-digit" }).format(start);
  const finish = new Intl.DateTimeFormat("pt-BR", { timeZone: meetingTimeZone, hour: "2-digit", minute: "2-digit" }).format(end);
  return `${day} ${clock}–${finish}`;
}

export function canReadAvailability(scopes: string) {
  return scopes.split(/\s+/).some((scope) => availabilityScopes.has(scope));
}

export function overlapsBusy(
  start: string,
  end: string,
  busy: { start: string; end: string }[],
  ignore?: { start: string; end: string },
) {
  const from = Date.parse(start);
  const to = Date.parse(end);
  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) return true;
  const ignoreStart = ignore ? Date.parse(ignore.start) : NaN;
  const ignoreEnd = ignore ? Date.parse(ignore.end) : NaN;
  return busy.some((block) => {
    const blockStart = Date.parse(block.start);
    const blockEnd = Date.parse(block.end);
    if (!Number.isFinite(blockStart) || !Number.isFinite(blockEnd)) return false;
    if (Number.isFinite(ignoreStart) && blockStart >= ignoreStart && blockEnd <= ignoreEnd) return false;
    return blockStart < to && blockEnd > from;
  });
}

export function googleFailure(status: number, reason = "") {
  if (status === 401 || reason === "authError" || reason === "invalid_grant") return "A conexão com o Google expirou. Conecte novamente.";
  if (status === 403) return "O Google recusou esta operação na agenda. Conecte o Google Calendar novamente.";
  if (status === 404 || status === 410) return "Esse evento não está mais no Google Calendar.";
  if (status === 429) return "O Google limitou as consultas. Tente de novo em alguns minutos.";
  if (status >= 500) return "O Google Calendar não respondeu. Tente de novo.";
  return "Não foi possível concluir o agendamento no Google Calendar.";
}

function httpsLink(value: string | undefined) {
  return value && /^https:\/\//.test(value) ? value : "";
}

export function meetUrlFromEvent(event: GoogleEventShape) {
  const direct = httpsLink(event.hangoutLink);
  if (direct) return direct;
  const video = event.conferenceData?.entryPoints?.find((point) => point.entryPointType === "video");
  return httpsLink(video?.uri);
}

export function remoteMeetingPatch(
  current: { startAt: string; endAt: string; status: string; meetUrl: string; calendarUrl: string },
  event: GoogleEventShape,
) {
  const status = event.status === "cancelled" ? "cancelled" : current.status === "cancelled" ? "cancelled" : "scheduled";
  const startAt = event.start?.dateTime ? new Date(event.start.dateTime).toISOString() : current.startAt;
  const endAt = event.end?.dateTime ? new Date(event.end.dateTime).toISOString() : current.endAt;
  const meetUrl = meetUrlFromEvent(event) || current.meetUrl;
  const calendarUrl = httpsLink(event.htmlLink) || current.calendarUrl;
  if (
    status === current.status &&
    startAt === current.startAt &&
    endAt === current.endAt &&
    meetUrl === current.meetUrl &&
    calendarUrl === current.calendarUrl
  ) {
    return null;
  }
  return { status, startAt, endAt, meetUrl, calendarUrl };
}
