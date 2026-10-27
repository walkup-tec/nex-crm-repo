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
  meetingOnContactCard,
  meetingLength,
  meetingSlot,
  meetingWhen,
  meetingWindowStarts,
  meetUrlFromEvent,
  overlapsBusy,
  agendaMenuForMmsMaster,
  mmsMasterAutomation,
  googleCalendarForMms,
  remoteMeetingPatch,
  standardMeetingDescription,
  standardMeetingTitle,
  meetingConfirmButton,
  meetingConfirmUrl,
  meetingNoticeMessages,
  agendaEmailList,
  lastMeetingFields,
  markMeetingCalendar,
  meetingForWindow,
  meetingCalendar,
  meetingChoices,
  releaseMeetingSlot,
} from "./google-calendar";

const now = Date.parse("2026-10-23T12:00:00-03:00");

assert.equal(googleCalendarForMms("MMS MARKETING E SISTEMAS DIGITAIS LTDA"), true);
assert.equal(googleCalendarForMms(" mms marketing e sistemas digitais ltda "), true);
assert.equal(googleCalendarForMms("WALKUP SISTEMAS E INTELIGENCIA LTDA"), false);
assert.equal(agendaMenuForMmsMaster("MMS MARKETING E SISTEMAS DIGITAIS LTDA", "client_admin"), true);
assert.equal(agendaMenuForMmsMaster("MMS MARKETING E SISTEMAS DIGITAIS LTDA", "master"), true);
assert.equal(agendaMenuForMmsMaster("MMS MARKETING E SISTEMAS DIGITAIS LTDA", "client_user"), false);
assert.equal(agendaMenuForMmsMaster("WALKUP SISTEMAS E INTELIGENCIA LTDA", "client_admin"), false);
assert.equal(mmsMasterAutomation("MMS MARKETING E SISTEMAS DIGITAIS LTDA", true), true);
assert.equal(mmsMasterAutomation("MMS MARKETING E SISTEMAS DIGITAIS LTDA", false), false);
assert.equal(mmsMasterAutomation("WALKUP SISTEMAS E INTELIGENCIA LTDA", true), false);
assert.equal(cleanEmail("  Ana@Empresa.com "), "ana@empresa.com");
assert.equal(cleanEmail("ana@"), "");
assert.equal(standardMeetingTitle, "Apresentação NEX Mkt Digital");
assert.equal(cleanMeetingTitle(standardMeetingTitle), standardMeetingTitle);
assert.equal(standardMeetingDescription.startsWith("Muito obrigado pelo seu tempo!"), true);
assert.equal(cleanMeetingDescription(standardMeetingDescription), standardMeetingDescription);
assert.equal(meetingNoticeMessages({ name: "Marcelo", when: "26/10/2026 13:00–14:00", email: "ana@empresa.com", meetUrl: "https://meet.google.com/abc" })[0], "Marcelo, segue os dados da nossa agenda.");
assert.equal(meetingNoticeMessages({ name: "  ", when: "", email: "", meetUrl: "" })[0], "Olá, segue os dados da nossa agenda.");
assert.equal(meetingNoticeMessages({ name: "Marcelo", when: "26/10/2026 13:00–14:00", email: "ana@empresa.com", meetUrl: "" })[2].includes("E-mail: ana@empresa.com"), true);
assert.equal(meetingConfirmUrl("9dcc028f-b4b8-4c79-b3cd-851b7d39bec9"), "https://app.nexmeta.com.br/agenda/9dcc028f-b4b8-4c79-b3cd-851b7d39bec9");
assert.equal(meetingConfirmButton("5511999999999", "https://app.nexmeta.com.br/agenda/1").buttons[0]?.displayText, "Confirmar Agendamento");
assert.equal(cleanMeetingTitle("  Reunião  inicial "), "Reunião inicial");
assert.equal(cleanMeetingTitle("A"), "");
assert.equal(cleanMeetingDescription("  pauta "), "pauta");
assert.equal(cleanMeetingDescription("x".repeat(2001)), null);

const guests = meetingGuests("lead@empresa.com", "maria@empresa.com, lead@empresa.com", "dono@empresa.com");
assert.deepEqual(guests, { lead: "lead@empresa.com", emails: ["lead@empresa.com", "maria@empresa.com"] });
assert.equal(meetingGuests("invalido", "").error, "Informe o e-mail do lead.");
assert.equal(meetingGuests("lead@empresa.com", "sem-arroba").error, "Há um participante com e-mail inválido.");
assert.deepEqual(meetingGuests("dono@empresa.com", "", "dono@empresa.com"), { lead: "dono@empresa.com", emails: [] });

const slot = meetingSlot({ date: "2026-10-26", time: "13:00" }, now);
assert.equal(slot?.start, "2026-10-26T16:00:00.000Z");
assert.equal(slot?.end, "2026-10-26T17:00:00.000Z");
assert.equal(slot?.duration, 60);
assert.equal(meetingSlot({ date: "2026-10-23", time: "11:00" }, now), null);
assert.equal(meetingSlot({ date: "2026-10-23", time: "15:00" }, now), null);
assert.equal(meetingSlot({ date: "2026-10-24", time: "10:00" }, now), null);
assert.deepEqual(meetingWindowStarts("2026-10-23"), [9, 10, 11]);
assert.deepEqual(meetingWindowStarts("2026-10-26"), [13, 14, 15]);
assert.deepEqual(meetingWindowStarts("2026-10-27"), [9, 10, 11, 12, 13, 14, 15]);
assert.equal(meetingCalendar(now).length, 30);
assert.equal(meetingCalendar(now)[0]?.closed, false);
assert.equal(meetingCalendar(now)[1]?.closed, true);
assert.equal(meetingChoices(now)[0]?.date, "2026-10-26");
assert.deepEqual(meetingChoices(now)[0]?.times, ["13:00", "14:00", "15:00"]);
const painted = markMeetingCalendar(meetingCalendar(now), [{ start: "2026-10-26T16:00:00.000Z", end: "2026-10-26T17:00:00.000Z", note: "Marcelo" }]);
assert.equal(painted.find((day) => day.date === "2026-10-26")?.windows[0]?.state, "occupied");
assert.equal(painted.find((day) => day.date === "2026-10-26")?.windows[1]?.state, "available");
assert.equal(
  meetingForWindow(
    [
      { status: "cancelled", startAt: "2026-10-26T16:00:00.000Z", endAt: "2026-10-26T17:00:00.000Z" },
      { status: "scheduled", startAt: "2026-10-26T16:00:00.000Z", endAt: "2026-10-26T17:00:00.000Z" },
    ],
    "2026-10-26T16:00:00.000Z",
    "2026-10-26T17:00:00.000Z",
  )?.status,
  "scheduled",
);
assert.equal(meetingForWindow([{ status: "scheduled", startAt: "2026-10-26T17:00:00.000Z", endAt: "2026-10-26T18:00:00.000Z" }], "2026-10-26T16:00:00.000Z", "2026-10-26T17:00:00.000Z"), null);
assert.deepEqual(meetingChoices(now, painted).find((day) => day.date === "2026-10-26")?.times, ["14:00", "15:00"]);
assert.deepEqual(meetingChoices(now, releaseMeetingSlot(painted, "2026-10-26T16:00:00.000Z", "2026-10-26T17:00:00.000Z")).find((day) => day.date === "2026-10-26")?.times, ["13:00", "14:00", "15:00"]);
assert.deepEqual(agendaEmailList([{ email: " Ana@Empresa.com ", attendees: ["maria@empresa.com", "ana@empresa.com"] }]), ["ana@empresa.com", "maria@empresa.com"]);
assert.deepEqual(lastMeetingFields({ email: " Mozart@Hotmart.com ", attendees: ["mozart@hotmart.com", "maria@empresa.com", "maria@empresa.com"] }), { email: "mozart@hotmart.com", attendees: "maria@empresa.com" });
assert.deepEqual(lastMeetingFields({ email: "", attendees: ["ana@empresa.com"] }), { email: "ana@empresa.com", attendees: "" });
assert.deepEqual(lastMeetingFields(null), { email: "", attendees: "" });
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
assert.equal(meetingOnContactCard("scheduled"), true);
assert.equal(meetingOnContactCard("cancelled"), false);
assert.equal(meetingOnContactCard("failed"), false);

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
