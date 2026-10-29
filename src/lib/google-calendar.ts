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

export function meetingOnContactCard(status: string) {
  return status === "scheduled";
}

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

export function agendaMenuForMmsMaster(legalName: string, role: string) {
  return googleCalendarForMms(legalName) && (role === "client_admin" || role === "master");
}

export function activeClientMeetingName(userName: string) {
  const name = userName.trim().replace(/\s+/g, " ");
  return `${name || "Cliente"}-[Cliente ativo]`;
}

export function mmsMasterAutomation(legalName: string, admin: boolean) {
  return googleCalendarForMms(legalName) && admin;
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

export const standardMeetingTitle = "Apresentação NEX Mkt Digital";

export const standardMeetingDescription = [
  "Muito obrigado pelo seu tempo!",
  "Em breve teremos um momento produtivo, aonde você poderá conhecer melhor a NEX e retirar todas as dúvidas a respeito das ações de marketing digital que irão impulsionar o seu negócio.",
].join("\n");

export function meetingConfirmUrl(meetingId: string) {
  return `https://app.nexmeta.com.br/agenda/${meetingId}`;
}

export function meetingNoticeMessages(input: { name: string; when: string; email: string; meetUrl: string }) {
  const name = input.name.trim() || "Olá";
  const details = [
    "Dados do agendamento",
    `Assunto: ${standardMeetingTitle}`,
    input.when ? `Quando: ${input.when}` : "",
    input.email ? `E-mail: ${input.email}` : "",
    input.meetUrl ? `Google Meet: ${input.meetUrl}` : "",
  ].filter(Boolean);
  return [
    `${name}, segue os dados da nossa agenda.`,
    "É muito importante que você entre no seu e-mail para confirmar o nosso horário, dessa forma você está reservando um horário onde o nosso especialista estará, inteiramente, à sua disposição.",
    details.join("\n"),
  ];
}

export function meetingConfirmButton(phone: string, url: string) {
  return {
    number: phone,
    title: "Agendamento",
    description: "Toque no botão para abrir o horário e confirmar.",
    footer: "",
    buttons: [{ type: "url", displayText: "Confirmar Agendamento", url }],
  };
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

export const standardMeetingMinutes = 30;

function padTimePart(value: number) {
  return String(value).padStart(2, "0");
}

function halfHourTimes(hours: number[]) {
  return hours.flatMap((hour) => [`${padTimePart(hour)}:00`, `${padTimePart(hour)}:30`]);
}

export function meetingWindowStarts(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return [] as string[];
  const weekday = new Date(`${date}T12:00:00-03:00`).getUTCDay();
  if (weekday === 1) return halfHourTimes([13, 14, 15]);
  if (weekday >= 2 && weekday <= 4) return halfHourTimes([9, 10, 11, 12, 13, 14, 15]);
  if (weekday === 5) return halfHourTimes([9, 10, 11]);
  return [] as string[];
}

function saoPauloDate(instant: number) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: meetingTimeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(instant));
}

function shiftDate(date: string, days: number) {
  return saoPauloDate(Date.parse(`${date}T12:00:00-03:00`) + days * 24 * 60 * 60 * 1000);
}

function windowBounds(date: string, time: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match) return null;
  const start = Date.parse(`${date}T${match[1]}:${match[2]}:00-03:00`);
  if (!Number.isFinite(start)) return null;
  return { start: new Date(start).toISOString(), end: new Date(start + standardMeetingMinutes * 60_000).toISOString() };
}

export type MeetingWindowState = "available" | "occupied" | "past";

export type MeetingWindow = {
  time: string;
  label: string;
  start: string;
  end: string;
  state: MeetingWindowState;
  note: string;
};

export type MeetingCalendarDay = {
  date: string;
  title: string;
  closed: boolean;
  windows: MeetingWindow[];
};

export const meetingCalendarWeeks = 4;

function mondayOfWeek(date: string) {
  const weekday = new Date(`${date}T12:00:00-03:00`).getUTCDay();
  const offset = weekday === 0 ? -6 : 1 - weekday;
  return shiftDate(date, offset);
}

export function meetingCalendar(now = Date.now(), weeks = meetingCalendarWeeks): MeetingCalendarDay[] {
  const monday = mondayOfWeek(saoPauloDate(now));
  return Array.from({ length: weeks * 5 }, (_, index) => {
    const week = Math.floor(index / 5);
    const weekday = index % 5;
    const date = shiftDate(monday, week * 7 + weekday);
    const parsed = new Date(`${date}T12:00:00-03:00`);
    const title = `${new Intl.DateTimeFormat("pt-BR", { timeZone: meetingTimeZone, weekday: "short" }).format(parsed)} ${new Intl.DateTimeFormat("pt-BR", { timeZone: meetingTimeZone, day: "2-digit", month: "2-digit" }).format(parsed)}`;
    const windows = meetingWindowStarts(date).flatMap((time) => {
      const bounds = windowBounds(date, time);
      if (!bounds) return [];
      const finishAt = Date.parse(bounds.end);
      const finish = new Intl.DateTimeFormat("en-GB", {
        timeZone: meetingTimeZone,
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }).format(new Date(finishAt));
      return [{
        time,
        label: `${time}–${finish}`,
        start: bounds.start,
        end: bounds.end,
        state: Date.parse(bounds.start) < now + 60_000 ? "past" as const : "available" as const,
        note: "",
      }];
    });
    return { date, title, closed: windows.length === 0, windows };
  });
}

export function meetingChoices(now = Date.now(), days: MeetingCalendarDay[] = meetingCalendar(now)) {
  return days
    .map((day) => ({ date: day.date, title: day.title, times: day.windows.filter((window) => window.state === "available").map((window) => window.time) }))
    .filter((day) => day.times.length > 0);
}

export function releaseMeetingSlot(days: MeetingCalendarDay[], startAt: string, endAt: string) {
  const start = Date.parse(startAt);
  const end = Date.parse(endAt);
  return days.map((day) => ({
    ...day,
    windows: day.windows.map((window) => {
      if (window.state !== "occupied" || Date.parse(window.start) !== start || Date.parse(window.end) !== end) return window;
      return { ...window, state: "available" as const, note: "" };
    }),
  }));
}

export function markMeetingCalendar(days: MeetingCalendarDay[], busy: { start: string; end: string; note?: string }[]) {
  return days.map((day) => ({
    ...day,
    windows: day.windows.map((window) => {
      if (window.state === "past") return window;
      const hit = busy.find((block) => overlapsBusy(window.start, window.end, [block]));
      if (!hit) return window;
      return { ...window, state: "occupied" as const, note: hit.note || "Ocupado" };
    }),
  }));
}

export function meetingForWindow<T extends { status: string; startAt: string; endAt: string }>(meetings: T[], start: string, end: string) {
  const startMs = Date.parse(start);
  const endMs = Date.parse(end);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return null;
  return (
    meetings.find((meeting) => {
      if (meeting.status !== "scheduled") return false;
      const meetingStart = Date.parse(meeting.startAt);
      return Number.isFinite(meetingStart) && meetingStart >= startMs && meetingStart < endMs;
    }) ?? null
  );
}

export function meetingSlot(input: { date: string; time: string }, now = Date.now()) {
  const match = /^(\d{2}):(\d{2})$/.exec(input.time);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || (minute !== 0 && minute !== 30)) return null;
  if (!meetingWindowStarts(input.date).includes(input.time)) return null;
  const start = returnInstant({ date: input.date, hour, minute }, now);
  if (!start) return null;
  return { start, end: new Date(Date.parse(start) + standardMeetingMinutes * 60_000).toISOString(), duration: standardMeetingMinutes };
}

export function lastMeetingFields(entry: { email?: string; attendees?: unknown } | null | undefined) {
  const stored = cleanEmail(entry?.email ?? "");
  const extras: string[] = [];
  const list = Array.isArray(entry?.attendees) ? entry.attendees : [];
  for (const item of list) {
    const cleaned = cleanEmail(typeof item === "string" ? item : "");
    if (cleaned && !extras.includes(cleaned)) extras.push(cleaned);
  }
  const email = stored || extras[0] || "";
  return { email, attendees: extras.filter((item) => item !== email).join(", ") };
}

export function agendaEmailList(entries: { email?: string; attendees?: unknown }[]) {
  const emails: string[] = [];
  const add = (value: string) => {
    const email = cleanEmail(value);
    if (email && !emails.includes(email)) emails.push(email);
  };
  for (const entry of entries) {
    add(entry.email ?? "");
    if (!Array.isArray(entry.attendees)) continue;
    for (const item of entry.attendees) {
      if (typeof item === "string") add(item);
    }
  }
  return emails;
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
