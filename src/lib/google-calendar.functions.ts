import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { AgendaBoardView, GoogleCalendarConnectionView, LeadMeetingView, MeetingCalendarDay } from "@/lib/google-calendar";

type Result<T> = { ok: true; data: T } | { ok: false; message: string };

function text(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function publicMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  const secret = /access_token|refresh_token|client_secret|GOCSPX|ya29\.|encrypted/i.test(message);
  console.error("google_calendar", secret ? "redacted" : message);
  if (secret) return "Não foi possível concluir a operação do Google Calendar.";
  if (/migração do Google Calendar/.test(message)) return message;
  if (!message || /postgres|PGRST|JWT|fetch failed|duplicate key|violates/i.test(message)) {
    return "Não foi possível concluir a operação do Google Calendar.";
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

export const startGoogleCalendarConnectFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { startGoogleCalendarConnect } = await import("@/server/google-calendar.server");
    return guard(() => startGoogleCalendarConnect(context.userId));
  });

export const completeGoogleCalendarOAuthFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { code?: string; state?: string; error?: string }) => ({
    code: text(data.code, 2048),
    state: text(data.state, 256),
    error: text(data.error, 80),
  }))
  .handler(async ({ context, data }) => {
    const { completeGoogleCalendarOAuth } = await import("@/server/google-calendar.server");
    return guard(() => completeGoogleCalendarOAuth(context.userId, data));
  });

export const googleCalendarConnectionFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Result<GoogleCalendarConnectionView>> => {
    const { googleCalendarConnection } = await import("@/server/google-calendar.server");
    return guard(() => googleCalendarConnection(context.userId));
  });

export const disconnectGoogleCalendarFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Result<GoogleCalendarConnectionView>> => {
    const { disconnectGoogleCalendar } = await import("@/server/google-calendar.server");
    return guard(() => disconnectGoogleCalendar(context.userId));
  });

export const leadMeetingContextFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { leadId?: string }) => ({ leadId: text(data.leadId, 80) }))
  .handler(async ({ context, data }) => {
    const { leadMeetingContext } = await import("@/server/google-calendar.server");
    return guard(() => leadMeetingContext(context.userId, data.leadId));
  });

export const listLeadMeetingsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { leadId?: string }) => ({ leadId: text(data.leadId, 80) }))
  .handler(async ({ context, data }): Promise<Result<LeadMeetingView[]>> => {
    const { listLeadMeetings } = await import("@/server/google-calendar.server");
    return guard(() => listLeadMeetings(context.userId, data.leadId));
  });

export const requestClientMeetingContextFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { requestClientMeetingContext } = await import("@/server/google-calendar.server");
    return guard(() => requestClientMeetingContext(context.userId));
  });

export const requestClientMeetingFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { requestId?: string; attendees?: string; date?: string; time?: string; meet?: boolean }) => ({
    requestId: text(data.requestId, 80),
    attendees: text(data.attendees, 500),
    date: text(data.date, 10),
    time: text(data.time, 5),
    meet: data.meet === true,
  }))
  .handler(async ({ context, data }) => {
    const { requestClientMeeting } = await import("@/server/google-calendar.server");
    return guard(() => requestClientMeeting(context.userId, data));
  });

export const listMeetingCalendarFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Result<MeetingCalendarDay[]>> => {
    const { listMeetingCalendar } = await import("@/server/google-calendar.server");
    return guard(() => listMeetingCalendar(context.userId));
  });

export const listAgendaBoardFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data?: { weekStart?: string }) => ({ weekStart: text(data?.weekStart, 10) }))
  .handler(async ({ context, data }): Promise<Result<AgendaBoardView>> => {
    const { listAgendaBoard } = await import("@/server/google-calendar.server");
    return guard(() => listAgendaBoard(context.userId, data.weekStart));
  });

export const createLeadMeetingFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: {
    leadId?: string;
    requestId?: string;
    email?: string;
    attendees?: string;
    date?: string;
    time?: string;
    meet?: boolean;
  }) => ({
    leadId: text(data.leadId, 80),
    requestId: text(data.requestId, 80),
    email: text(data.email, 160),
    attendees: text(data.attendees, 500),
    date: text(data.date, 10),
    time: text(data.time, 5),
    meet: data.meet === true,
  }))
  .handler(async ({ context, data }): Promise<Result<LeadMeetingView>> => {
    const { createLeadMeeting } = await import("@/server/google-calendar.server");
    return guard(() => createLeadMeeting(context.userId, data));
  });

export const rescheduleLeadMeetingFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { meetingId?: string; date?: string; time?: string }) => ({
    meetingId: text(data.meetingId, 80),
    date: text(data.date, 10),
    time: text(data.time, 5),
  }))
  .handler(async ({ context, data }): Promise<Result<LeadMeetingView>> => {
    const { rescheduleLeadMeeting } = await import("@/server/google-calendar.server");
    return guard(() => rescheduleLeadMeeting(context.userId, data));
  });

export const cancelLeadMeetingFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { meetingId?: string }) => ({ meetingId: text(data.meetingId, 80) }))
  .handler(async ({ context, data }): Promise<Result<LeadMeetingView>> => {
    const { cancelLeadMeeting } = await import("@/server/google-calendar.server");
    return guard(() => cancelLeadMeeting(context.userId, data.meetingId));
  });

export const publicMeetingCardFn = createServerFn({ method: "POST" })
  .validator((data: { meetingId?: string }) => ({ meetingId: text(data.meetingId, 80) }))
  .handler(async ({ data }) => {
    const { publicMeetingCard } = await import("@/server/google-calendar.server");
    return guard(() => publicMeetingCard(data.meetingId));
  });
