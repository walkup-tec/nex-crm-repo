import assert from "node:assert/strict";
import {
  canReadAvailability,
  cleanEmail,
  cleanMeetingDescription,
  cleanMeetingTitle,
  googleCalendarScopes,
  googleFailure,
  meetingFields,
  meetingGuests,
  meetingLength,
  meetingSlot,
  meetingWhen,
  meetUrlFromEvent,
  overlapsBusy,
  googleCalendarForMms,
  remoteMeetingPatch,
} from "./google-calendar";

const now = Date.parse("2026-10-23T12:00:00-03:00");

assert.equal(googleCalendarForMms("MMS MARKETING E SISTEMAS DIGITAIS LTDA"), true);
assert.equal(googleCalendarForMms(" mms marketing e sistemas digitais ltda "), true);
assert.equal(googleCalendarForMms("WALKUP SISTEMAS E INTELIGENCIA LTDA"), false);
assert.equal(cleanEmail("  Ana@Empresa.com "), "ana@empresa.com");
assert.equal(cleanEmail("ana@"), "");
assert.equal(cleanMeetingTitle("  Reunião  inicial "), "Reunião inicial");
assert.equal(cleanMeetingTitle("A"), "");
assert.equal(cleanMeetingDescription("  pauta "), "pauta");
assert.equal(cleanMeetingDescription("x".repeat(2001)), null);

const guests = meetingGuests("lead@empresa.com", "maria@empresa.com, lead@empresa.com", "dono@empresa.com");
assert.deepEqual(guests, { lead: "lead@empresa.com", emails: ["lead@empresa.com", "maria@empresa.com"] });
assert.equal(meetingGuests("invalido", "").error, "Informe o e-mail do lead.");
assert.equal(meetingGuests("lead@empresa.com", "sem-arroba").error, "Há um participante com e-mail inválido.");
assert.deepEqual(meetingGuests("dono@empresa.com", "", "dono@empresa.com"), { lead: "dono@empresa.com", emails: [] });

const slot = meetingSlot({ date: "2026-10-23", time: "15:00", duration: 30 }, now);
assert.equal(slot?.start, "2026-10-23T18:00:00.000Z");
assert.equal(slot?.end, "2026-10-23T18:30:00.000Z");
assert.equal(meetingSlot({ date: "2026-10-23", time: "09:00", duration: 30 }, now), null);
assert.equal(meetingSlot({ date: "2026-10-23", time: "15:00", duration: 20 }, now), null);
assert.deepEqual(meetingFields("2026-10-23T18:00:00.000Z"), { date: "2026-10-23", time: "15:00" });
assert.equal(meetingLength("2026-10-23T18:00:00.000Z", "2026-10-23T18:45:00.000Z"), 45);
assert.equal(meetingWhen("2026-10-23T18:00:00.000Z", "2026-10-23T18:30:00.000Z"), "23/10/2026 15:00–15:30");

assert.equal(canReadAvailability(googleCalendarScopes.join(" ")), true);
assert.equal(canReadAvailability("https://www.googleapis.com/auth/calendar.events"), false);

const busy = [{ start: "2026-10-23T18:00:00.000Z", end: "2026-10-23T18:30:00.000Z" }];
assert.equal(overlapsBusy("2026-10-23T18:15:00.000Z", "2026-10-23T18:45:00.000Z", busy), true);
assert.equal(overlapsBusy("2026-10-23T19:00:00.000Z", "2026-10-23T19:30:00.000Z", busy), false);
assert.equal(
  overlapsBusy("2026-10-23T18:00:00.000Z", "2026-10-23T18:30:00.000Z", busy, {
    start: "2026-10-23T18:00:00.000Z",
    end: "2026-10-23T18:30:00.000Z",
  }),
  false,
);

assert.equal(googleFailure(401), "A conexão com o Google expirou. Conecte novamente.");
assert.equal(googleFailure(400, "invalid_grant"), "A conexão com o Google expirou. Conecte novamente.");
assert.equal(googleFailure(429), "O Google limitou as consultas. Tente de novo em alguns minutos.");
assert.equal(googleFailure(500), "O Google Calendar não respondeu. Tente de novo.");
assert.equal(meetUrlFromEvent({ hangoutLink: "https://meet.google.com/abc-defg-hij" }), "https://meet.google.com/abc-defg-hij");
assert.equal(
  meetUrlFromEvent({ conferenceData: { entryPoints: [{ entryPointType: "video", uri: "https://meet.google.com/xyz" }] } }),
  "https://meet.google.com/xyz",
);
assert.equal(meetUrlFromEvent({ hangoutLink: "javascript:alert(1)" }), "");

const current = {
  startAt: "2026-10-23T18:00:00.000Z",
  endAt: "2026-10-23T18:30:00.000Z",
  status: "scheduled",
  meetUrl: "",
  calendarUrl: "",
};
assert.equal(remoteMeetingPatch(current, { status: "confirmed", start: { dateTime: current.startAt }, end: { dateTime: current.endAt } }), null);
assert.deepEqual(
  remoteMeetingPatch(current, { status: "cancelled", htmlLink: "https://www.google.com/calendar/event?eid=1" }),
  {
    status: "cancelled",
    startAt: current.startAt,
    endAt: current.endAt,
    meetUrl: "",
    calendarUrl: "https://www.google.com/calendar/event?eid=1",
  },
);
