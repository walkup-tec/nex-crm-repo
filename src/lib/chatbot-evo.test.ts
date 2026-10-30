import assert from "node:assert/strict";
import { chatbotProfileLabel, chatbotProfilesFromStorage, defaultChatbotProfiles, profileForMenus } from "./chatbot-profiles";
import { allChatbotMenus } from "./chatbot-menus";
import {
  evolutionConnectionStatus,
  evolutionReportedStatus,
  evolutionContactAvatar,
  evolutionContactPhone,
  evolutionContactIdentity,
  flowSendAddresses,
  evolutionMessageKey,
  evolutionResolvedPhone,
  incomingMessageInstant,
  learnLidPhones,
  resolveIncomingPhone,
  composerDraftAfterSend,
  composerDraftChange,
  composerMediaFile,
  voiceNoteName,
  voiceRecorderMime,
  composerSendsOnEnter,
  channelsAllConnected,
  droppedChannels,
  shouldSyncEvolution,
  queueByKey,
  acceptsInboundMessageEvent,
  inboundStartsBot,
  inboundBotAction,
  sameInboundMessage,
  flowClaimAllowsSend,
  freshRunBlocksResend,
  freshFlowRunMs,
  shouldBlindResendAfterTimeout,
  panelRowsAreDistinct,
  pendingOutgoing,
  messageClock,
  audioDurationLabel,
  audioWaveBars,
  acceptSnapshot,
  messageHistoryScrollTop,
  stickToLatestMessage,
  evolutionIncomingMessages,
  evolutionMessageText,
  evolutionMessageContent,
  evolutionMediaFile,
  evolutionSameOwnerInstance,
  evolutionProfileNumber,
  evolutionProfilePictureUrl,
  evolutionQrImage,
  tintQrPixel,
  attendanceLabel,
  attendanceMark,
  inboxContactLane,
  inboxFiltersMatch,
  inboxLane,
  inboxList,
  inboxTabCounts,
  inboxQueryMatch,
  waitingForHuman,
  keepAttendanceBotsPaused,
  headerAttendant,
  finishAttendanceGate,
  finishAsksRating,
  negotiatedCents,
  negotiatedLabel,
  clientVisibleTo,
  applyOverviewFilters,
  attendanceSeries,
  percentAgainstPrevious,
  previousOverviewPeriod,
  dailyAttendanceCounts,
  overviewMetrics,
  stageDistribution,
  funnelWithEntry,
  leadOriginChoices,
  leadOriginSelection,
  leadOriginValue,
  attendanceKanbanStage,
  meetingKanbanStage,
  protectedKanbanStage,
  shouldAssignAttendanceStage,
  shouldAssignMeetingStage,
  withWonKanbanStage,
  inboxOrder,
  inboxUnread,
  inboxVisible,
  attendancePhone,
  artesFileNames,
  artesMime,
  activeClientTag,
  addedLeadTag,
  altoPotencialTag,
  minutaFileName,
  defaultReturnSlot,
  returnInstant,
  returnMonthCells,
  tagGrantedByMinuta,
  tagGrantedBySuccess,
  propostaFileName,
  propostaMessages,
  whatsappImagePayload,
  whatsappCadastroButton,
  whatsappDocumentPayload,
  whatsappFlowAudioPayload,
  whatsappFlowTextPayload,
  whatsappTextPayload,
  preferredWhatsappPhone,
  sameWhatsappAccount,
  evolutionInstanceClosed,
  evolutionInstanceNameOf,
  evolutionNumberInUse,
  whatsappDeviceRemoved,
  whatsappJidPhone,
  whatsappGroupJid,
  whatsappGroupLabel,
  sameChatbotContact,
  evolutionConversationPhone,
  evolutionGroupSubject,
  groupInboundText,
  clientPhoneLabel,
  whatsappMask,
  catalogName,
  quickReplyText,
  inboxContactTags,
  tagColorValue,
  tagInk,
  keepWhatsappName,
  contactFileLabel,
  contactExtraDataCount,
  savedMediaTitle,
  internalNote,
  kanbanStageName,
  moveKanbanStage,
  clientFilterOptions,
  filterChatbotClients,
  queueMinutes,
  chatbotCompanyName,
  defaultOfflineNotice,
  offlineNoticeText,
  reactivationMinutes,
  reactivatesClosedConversation,
  attendanceExpired,
  waitingMinutes,
  overdueQueue,
  noticeCue,
  botPresenceCue,
  noticePlayer,
  ratingScore,
  isRatingThanks,
  noticeMessageIds,
  ratingAverage,
  ratingAverageLabel,
  ratingMessage,
  ratingPrompt,
  type ChatbotClientRow,
} from "./chatbot-evo";

assert.equal(whatsappMask("1"), "(1");
assert.equal(whatsappMask("11"), "(11");
assert.equal(whatsappMask("119"), "(11) 9");
assert.equal(whatsappMask("11999999999"), "(11) 99999-9999");
assert.equal(whatsappMask("5511999999999"), "(11) 99999-9999");
assert.equal(whatsappMask("55999999999"), "(55) 99999-9999");
assert.equal(whatsappMask("555198335401"), "(51) 99833-5401");
assert.equal(whatsappMask("5551998335401"), "(51) 99833-5401");
assert.equal(whatsappMask("5199833540"), "(51) 99833-540");
assert.equal(preferredWhatsappPhone("5551998335401", "555198335401"), "5551998335401");
assert.equal(sameWhatsappAccount("5551998335401", "555198335401"), true);
assert.equal(sameWhatsappAccount("5551998335401", "555198335401@s.whatsapp.net"), true);
assert.equal(sameWhatsappAccount("5551998335401", "5511999999999"), false);
assert.equal(whatsappDeviceRemoved(401), true);
assert.equal(whatsappDeviceRemoved(428), false);
assert.equal(headerAttendant("  Marina Costa  "), "Marina Costa");
assert.equal(headerAttendant("   "), "Fila");
assert.equal(finishAttendanceGate({ status: "queue", assigneeId: "", userId: "ana", admin: false }), "ok");
assert.equal(finishAttendanceGate({ status: "active", assigneeId: "ana", userId: "ana", admin: false }), "ok");
assert.equal(finishAttendanceGate({ status: "active", assigneeId: "bia", userId: "ana", admin: false }), "other");
assert.equal(finishAttendanceGate({ status: "active", assigneeId: "bia", userId: "ana", admin: true }), "ok");
assert.equal(finishAttendanceGate({ status: "closed", assigneeId: "", userId: "ana", admin: true }), "closed");
assert.equal(finishAsksRating(""), false);
assert.equal(finishAsksRating("ana"), true);
assert.equal(negotiatedCents(""), null);
assert.equal(negotiatedCents("R$ 1.250,00"), 125000);
assert.equal(negotiatedLabel(125000).replace(/\s/g, " "), "R$ 1.250,00");
assert.equal(clientVisibleTo("ana", "ana", false), true);
assert.equal(clientVisibleTo("ana", "bia", false), false);
assert.equal(clientVisibleTo("ana", "bia", true), true);
assert.equal(clientVisibleTo("", "ana", false), false);
assert.equal(protectedKanbanStage(" sucesso "), true);
assert.equal(meetingKanbanStage, "Reunião");
assert.equal(shouldAssignMeetingStage("Atendimento", true), true);
assert.equal(shouldAssignMeetingStage("", true), true);
assert.equal(shouldAssignMeetingStage("Reunião", true), false);
assert.equal(shouldAssignMeetingStage("reunião", true), false);
assert.equal(shouldAssignMeetingStage("Sucesso", true), false);
assert.equal(shouldAssignMeetingStage("Proposta", true), true);
assert.equal(shouldAssignMeetingStage("Contrato", true), true);
assert.equal(shouldAssignMeetingStage("Atendimento", false), false);
assert.equal(shouldAssignAttendanceStage("Proposta"), false);
assert.equal(shouldAssignAttendanceStage("Contrato"), false);
assert.equal(shouldAssignAttendanceStage("Reunião"), false);
assert.equal(attendanceKanbanStage, "Atendimento");
assert.equal(shouldAssignAttendanceStage("Novos leads"), true);
assert.equal(shouldAssignAttendanceStage("Atendimento"), false);
assert.equal(shouldAssignAttendanceStage("Sucesso"), false);
assert.deepEqual(withWonKanbanStage(["Proposta"]), ["Proposta", "Sucesso"]);
assert.deepEqual(withWonKanbanStage(["Sucesso", "Proposta"]), ["Sucesso", "Proposta"]);
assert.deepEqual(
  overviewMetrics({
    conversations: [
      { contactId: "c1", assigneeId: "ana", finishedCount: 1 },
      { contactId: "c1", assigneeId: "", finishedCount: 0 },
      { contactId: "c2", assigneeId: "", finishedCount: 2 },
    ],
    contacts: [
      { negotiatedCents: 10000, stage: "Proposta", ownerId: "ana" },
      { negotiatedCents: 25000, stage: "Sucesso", ownerId: "bia" },
      { negotiatedCents: null, stage: "", ownerId: "" },
    ],
    userId: "ana",
    admin: false,
  }),
  { received: 2, attending: 1, finished: 3, openDeals: 2, negotiatingCents: 35000, wonCents: 25000, clients: 1, ratingAverage: null, ratingCount: 0, stages: [], days: [] },
);
assert.equal(
  overviewMetrics({
    conversations: [],
    contacts: [],
    scores: [5, 4, 4],
    userId: "ana",
    admin: true,
  }).ratingAverage,
  4.3,
);
assert.deepEqual(
  stageDistribution(["Atendimento", "Sucesso", "Perdido"], [
    { stage: "Atendimento" },
    { stage: "Atendimento" },
    { stage: "Perdido" },
    { stage: "" },
    { stage: "sucesso" },
  ]),
  [
    { name: "Atendimento", count: 2 },
    { name: "Sucesso", count: 0 },
    { name: "Perdido", count: 1 },
  ],
);
assert.deepEqual(
  funnelWithEntry(
    [
      { name: "Atendimento", count: 2 },
      { name: "Entrada", count: 9 },
      { name: "Reunião", count: 3 },
    ],
    15,
  ),
  [
    { name: "Entrada", count: 15 },
    { name: "Atendimento", count: 2 },
    { name: "Reunião", count: 3 },
  ],
);
assert.deepEqual(leadOriginChoices([{ id: "1", name: "Marca", platform: "meta" }]), []);
assert.deepEqual(
  leadOriginChoices([
    { id: "1", name: "Marca", platform: "meta" },
    { id: "1", name: "Marca", platform: "meta" },
    { id: "2", name: "Leads", platform: "google" },
    { id: "3", name: "Leads", platform: "meta" },
  ]).map((item) => item.label),
  ["Leads · Google", "Leads · Meta", "Marca"],
);
assert.equal(leadOriginValue({ platform: "google", id: "2" }), "google:2");
assert.deepEqual(leadOriginSelection("meta:15"), { platform: "meta", id: "15" });
assert.equal(leadOriginSelection("campanha"), null);
assert.deepEqual(
  dailyAttendanceCounts(["2026-10-15T02:30:00.000Z", "2026-10-15T15:00:00.000Z", "2026-10-15T18:00:00.000Z", ""]),
  [
    { day: "2026-10-14", count: 1 },
    { day: "2026-10-15", count: 2 },
  ],
);
assert.deepEqual(
  attendanceSeries(
    [{ day: "2026-10-14", count: 1 }, { day: "2026-10-15", count: 2 }, { day: "2026-09-01", count: 9 }],
    { mode: "custom", since: "2026-10-09", until: "2026-10-15" },
    new Date("2026-10-15T15:00:00.000Z"),
  ).filter((point) => point.count > 0),
  [
    { label: "14/10", count: 1 },
    { label: "15/10", count: 2 },
  ],
);
assert.equal(attendanceSeries([], { mode: "custom", since: "2026-10-15", until: "2026-10-15" }, new Date("2026-10-15T15:00:00.000Z")).length, 1);
assert.equal(attendanceSeries([], { mode: "custom", since: "2026-09-16", until: "2026-10-15" }, new Date("2026-10-15T15:00:00.000Z")).length, 30);
assert.equal(attendanceSeries([], { mode: "custom", since: "2026-10-01", until: "2026-10-15" }, new Date("2026-10-15T15:00:00.000Z"))[0]?.label, "01/10");
assert.deepEqual(previousOverviewPeriod({ mode: "custom", since: "2026-10-01", until: "2026-10-15" }), { mode: "custom", since: "2026-09-16", until: "2026-09-30" });
assert.equal(previousOverviewPeriod({ mode: "total" }), null);
assert.equal(percentAgainstPrevious(23, 17), 35);
assert.equal(percentAgainstPrevious(2, 4), -50);
assert.equal(percentAgainstPrevious(5, 0), null);
assert.equal(percentAgainstPrevious(0, 0), 0);
assert.deepEqual(
  applyOverviewFilters(
    {
      stages: ["Proposta", "Sucesso"],
      attendants: [],
      channels: [{ id: "w1", name: "Principal" }],
      conversations: [
        { id: "a1", contactId: "c1", connectionId: "w1", assigneeId: "ana", finishedCount: 0, createdAt: "2026-10-14T15:00:00.000Z" },
        { id: "a2", contactId: "c1", connectionId: "w1", assigneeId: "", finishedCount: 1, createdAt: "2026-10-15T15:00:00.000Z" },
        { id: "b1", contactId: "c2", connectionId: "w1", assigneeId: "bia", finishedCount: 2, createdAt: "2026-10-15T18:00:00.000Z" },
      ],
      contacts: [
        { id: "c1", negotiatedCents: 10000, stage: "Proposta", ownerId: "ana" },
        { id: "c2", negotiatedCents: 25000, stage: "Sucesso", ownerId: "bia" },
      ],
      ratings: [{ conversationId: "b1", score: 4, createdAt: "2026-10-15T19:00:00.000Z" }],
      userId: "ana",
      admin: true,
    },
    { period: { mode: "custom", since: "2026-10-14", until: "2026-10-15" }, attendantId: "", channelId: "" },
  ).trends,
  {
    received: [1, 1],
    attending: [1, 1],
    finished: [0, 3],
    openDeals: [1, 1],
    negotiatingCents: [10000, 25000],
    wonCents: [0, 25000],
    clients: [1, 1],
    rating: [4, 4],
  },
);
assert.equal(
  applyOverviewFilters(
    {
      stages: ["Proposta", "Sucesso"],
      attendants: [
        { id: "ana", name: "Ana", team: "Comercial" },
        { id: "bia", name: "Bia", team: "" },
      ],
      channels: [
        { id: "w1", name: "Principal" },
        { id: "w2", name: "Suporte" },
      ],
      conversations: [
        { id: "a1", contactId: "c1", connectionId: "w1", assigneeId: "ana", finishedCount: 1, createdAt: "2026-10-15T15:00:00.000Z" },
        { id: "b1", contactId: "c2", connectionId: "w2", assigneeId: "bia", finishedCount: 2, createdAt: "2026-10-01T15:00:00.000Z" },
      ],
      contacts: [
        { id: "c1", negotiatedCents: 10000, stage: "Proposta", ownerId: "ana" },
        { id: "c2", negotiatedCents: 25000, stage: "Sucesso", ownerId: "bia" },
      ],
      ratings: [
        { conversationId: "a1", score: 5, createdAt: "2026-10-15T16:00:00.000Z" },
        { conversationId: "b1", score: 3, createdAt: "2026-10-01T16:00:00.000Z" },
      ],
      userId: "ana",
      admin: true,
    },
    { period: { mode: "custom", since: "2026-10-15", until: "2026-10-15" }, attendantId: "ana", channelId: "w1" },
  ).received,
  1,
);
assert.deepEqual(
  applyOverviewFilters(
    {
      stages: ["Atendimento", "Reunião"],
      attendants: [],
      channels: [],
      conversations: [
        { id: "a1", contactId: "c1", connectionId: "w1", assigneeId: "ana", finishedCount: 0, createdAt: "2026-10-15T15:00:00.000Z" },
        { id: "a2", contactId: "c2", connectionId: "w1", assigneeId: "", finishedCount: 0, createdAt: "2026-10-15T16:00:00.000Z" },
        { id: "a3", contactId: "c1", connectionId: "w1", assigneeId: "ana", finishedCount: 0, createdAt: "2026-10-15T17:00:00.000Z" },
      ],
      contacts: [
        { id: "c1", negotiatedCents: null, stage: "Atendimento", ownerId: "" },
        { id: "c2", negotiatedCents: null, stage: "Reunião", ownerId: "" },
      ],
      ratings: [],
      userId: "bia",
      admin: false,
    },
    { period: { mode: "total" }, attendantId: "", channelId: "" },
  ).stages,
  [
    { name: "Entrada", count: 2 },
    { name: "Atendimento", count: 1 },
    { name: "Reunião", count: 1 },
  ],
);
const humanAttendance = {
  stages: ["Atendimento", "Reunião"],
  attendants: [],
  channels: [],
  conversations: [
    { id: "a1", contactId: "c1", connectionId: "w1", assigneeId: "ana", finishedCount: 0, createdAt: "2026-10-15T15:00:00.000Z" },
    { id: "a2", contactId: "c2", connectionId: "w1", assigneeId: "bia", finishedCount: 0, createdAt: "2026-10-15T16:00:00.000Z" },
    { id: "a3", contactId: "c3", connectionId: "w1", assigneeId: "", finishedCount: 0, createdAt: "2026-10-15T17:00:00.000Z" },
  ],
  contacts: [
    { id: "c1", negotiatedCents: null, stage: "Reunião", ownerId: "" },
    { id: "c2", negotiatedCents: null, stage: "Proposta", ownerId: "" },
    { id: "c3", negotiatedCents: null, stage: "Atendimento", ownerId: "" },
  ],
  ratings: [],
  userId: "bia",
  admin: true,
};
const everyPeriod = { period: { mode: "total" as const }, attendantId: "", channelId: "" };
assert.equal(applyOverviewFilters(humanAttendance, everyPeriod).attending, 2);
assert.equal(applyOverviewFilters(humanAttendance, everyPeriod).stages.find((stage) => stage.name === "Atendimento")?.count, 1);
assert.equal(applyOverviewFilters({ ...humanAttendance, mmsMaster: true }, everyPeriod).stages.find((stage) => stage.name === "Atendimento")?.count, 2);
assert.equal(applyOverviewFilters({ ...humanAttendance, mmsMaster: true }, everyPeriod).stages.find((stage) => stage.name === "Reunião")?.count, 1);
assert.equal(
  applyOverviewFilters(
    {
      stages: ["Proposta", "Sucesso"],
      attendants: [{ id: "ana", name: "Ana", team: "Comercial" }],
      channels: [{ id: "w1", name: "Principal" }],
      conversations: [
        { id: "a1", contactId: "c1", connectionId: "w1", assigneeId: "ana", finishedCount: 1, createdAt: "2026-10-15T15:00:00.000Z" },
        { id: "b1", contactId: "c2", connectionId: "w2", assigneeId: "bia", finishedCount: 2, createdAt: "2026-10-01T15:00:00.000Z" },
      ],
      contacts: [
        { id: "c1", negotiatedCents: 10000, stage: "Proposta", ownerId: "ana" },
        { id: "c2", negotiatedCents: 25000, stage: "Sucesso", ownerId: "bia" },
      ],
      ratings: [{ conversationId: "b1", score: 3, createdAt: "2026-10-01T16:00:00.000Z" }],
      userId: "ana",
      admin: true,
    },
    { period: { mode: "total" }, attendantId: "", channelId: "w1" },
  ).stages.find((stage) => stage.name === "Sucesso")?.count,
  0,
);
assert.deepEqual(
  applyOverviewFilters(
    {
      stages: ["Proposta", "Sucesso"],
      attendants: [
        { id: "ana", name: "Ana", team: "Comercial" },
        { id: "bia", name: "Bia", team: "" },
      ],
      channels: [{ id: "w1", name: "Principal" }],
      conversations: [
        { id: "a1", contactId: "c1", connectionId: "w1", assigneeId: "ana", finishedCount: 1, createdAt: "2026-10-15T15:00:00.000Z" },
        { id: "b1", contactId: "c2", connectionId: "w1", assigneeId: "bia", finishedCount: 1, createdAt: "2026-10-15T15:00:00.000Z" },
        { id: "b2", contactId: "c2", connectionId: "w1", assigneeId: "bia", finishedCount: 1, createdAt: "2026-10-15T18:00:00.000Z" },
      ],
      contacts: [
        { id: "c1", negotiatedCents: 10000, stage: "Proposta", ownerId: "ana" },
        { id: "c2", negotiatedCents: 25000, stage: "Sucesso", ownerId: "bia", stageSetBy: "bia" },
      ],
      ratings: [],
      userId: "ana",
      admin: true,
    },
    { period: { mode: "total" }, attendantId: "", channelId: "" },
  ).agents.map((agent) => ({ name: agent.name, total: agent.total, success: agent.success })),
  [
    { name: "Ana", total: 2, success: 0 },
    { name: "Bia", total: 3, success: 1 },
  ],
);
assert.deepEqual(
  applyOverviewFilters(
    {
      stages: ["Proposta", "Sucesso"],
      attendants: [
        { id: "ana", name: "Ana", team: "Comercial" },
        { id: "bia", name: "Bia", team: "" },
      ],
      channels: [{ id: "w1", name: "Principal" }],
      conversations: [
        { id: "a1", contactId: "c1", connectionId: "w1", assigneeId: "ana", finishedCount: 1, createdAt: "2026-10-15T15:00:00.000Z" },
        { id: "b1", contactId: "c2", connectionId: "w1", assigneeId: "", assumedBy: "bia", finishedCount: 1, createdAt: "2026-10-15T15:00:00.000Z" },
        { id: "c3", contactId: "c3", connectionId: "w1", assigneeId: "bia", finishedCount: 0, createdAt: "2026-10-15T15:00:00.000Z" },
      ],
      contacts: [
        { id: "c1", negotiatedCents: 10000, stage: "Proposta", ownerId: "ana" },
        { id: "c2", negotiatedCents: 25000, stage: "Sucesso", ownerId: "ana", stageSetBy: "bia" },
        { id: "c3", negotiatedCents: null, stage: "Sucesso", ownerId: "bia", stageSetBy: "ana" },
      ],
      ratings: [],
      userId: "ana",
      admin: true,
    },
    { period: { mode: "total" }, attendantId: "", channelId: "" },
  ).agents.map((agent) => ({ name: agent.name, total: agent.total, success: agent.success })),
  [
    { name: "Ana", total: 2, success: 1 },
    { name: "Bia", total: 2, success: 1 },
  ],
);
assert.deepEqual(
  applyOverviewFilters(
    {
      stages: [],
      attendants: [
        { id: "ana", name: "Ana", team: "" },
        { id: "bia", name: "Bia", team: "" },
      ],
      channels: [{ id: "w1", name: "Principal" }],
      conversations: [
        { id: "a1", contactId: "c1", connectionId: "w1", assigneeId: "ana", finishedCount: 0, createdAt: "2026-10-15T15:00:00.000Z" },
        { id: "a2", contactId: "c1", connectionId: "w1", assigneeId: "ana", finishedCount: 0, createdAt: "2026-10-15T16:00:00.000Z" },
        { id: "a3", contactId: "c3", connectionId: "w1", assigneeId: "", assumedBy: "ana", finishedCount: 2, createdAt: "2026-10-15T17:00:00.000Z" },
        { id: "b1", contactId: "c2", connectionId: "w1", assigneeId: "", assumedBy: "bia", finishedCount: 1, createdAt: "2026-09-01T15:00:00.000Z" },
      ],
      contacts: [],
      ratings: [],
      userId: "ana",
      admin: true,
    },
    { period: { mode: "custom", since: "2026-10-15", until: "2026-10-15" }, attendantId: "", channelId: "" },
  ).agents.map((agent) => ({ name: agent.name, total: agent.total })),
  [
    { name: "Ana", total: 3 },
    { name: "Bia", total: 0 },
  ],
);
assert.deepEqual(
  applyOverviewFilters(
    {
      stages: ["Proposta", "Sucesso"],
      attendants: [
        { id: "ana", name: "Ana", team: "Comercial" },
        { id: "bia", name: "Bia", team: "" },
      ],
      channels: [{ id: "w1", name: "Principal" }],
      conversations: [
        { id: "a1", contactId: "c1", connectionId: "w1", assigneeId: "ana", finishedCount: 1, createdAt: "2026-10-15T15:00:00.000Z" },
        { id: "b1", contactId: "c2", connectionId: "w1", assigneeId: "", assumedBy: "bia", finishedCount: 1, createdAt: "2026-10-15T15:00:00.000Z" },
        { id: "c3", contactId: "c3", connectionId: "w1", assigneeId: "bia", finishedCount: 0, createdAt: "2026-10-15T15:00:00.000Z" },
      ],
      contacts: [
        { id: "c1", negotiatedCents: 10000, stage: "Proposta", ownerId: "ana" },
        { id: "c2", negotiatedCents: 25000, stage: "Sucesso", ownerId: "ana", stageSetBy: "bia" },
        { id: "c3", negotiatedCents: 40000, stage: "Sucesso", ownerId: "bia", stageSetBy: "ana" },
      ],
      ratings: [],
      userId: "ana",
      admin: true,
    },
    { period: { mode: "total" }, attendantId: "", channelId: "" },
  ).agents.map((agent) => ({ name: agent.name, success: agent.success, wonCents: agent.wonCents })),
  [
    { name: "Ana", success: 1, wonCents: 40000 },
    { name: "Bia", success: 1, wonCents: 25000 },
  ],
);
assert.deepEqual(
  applyOverviewFilters(
    {
      stages: ["Sucesso"],
      attendants: [
        { id: "ana", name: "Ana", team: "" },
        { id: "bia", name: "Bia", team: "" },
      ],
      channels: [{ id: "w1", name: "Principal" }],
      conversations: [
        { id: "b1", contactId: "c2", connectionId: "w1", assigneeId: "bia", finishedCount: 0, createdAt: "2026-10-15T15:00:00.000Z" },
        { id: "a1", contactId: "c4", connectionId: "w1", assigneeId: "ana", finishedCount: 0, createdAt: "2026-10-15T15:00:00.000Z" },
        { id: "a2", contactId: "c4", connectionId: "w1", assigneeId: "", assumedBy: "bia", finishedCount: 1, createdAt: "2026-10-15T16:00:00.000Z" },
      ],
      contacts: [
        { id: "c2", negotiatedCents: 140000, stage: "Sucesso", ownerId: "ana" },
        { id: "c4", negotiatedCents: 90000, stage: "Sucesso", ownerId: "bia" },
      ],
      ratings: [],
      userId: "ana",
      admin: true,
    },
    { period: { mode: "total" }, attendantId: "", channelId: "" },
  ).agents.map((agent) => ({ name: agent.name, success: agent.success, wonCents: agent.wonCents })),
  [
    { name: "Ana", success: 0, wonCents: 0 },
    { name: "Bia", success: 1, wonCents: 140000 },
  ],
);
assert.deepEqual(
  applyOverviewFilters(
    {
      stages: [],
      attendants: [],
      channels: [
        { id: "w1", name: "Principal" },
        { id: "w2", name: "Suporte" },
      ],
      conversations: [
        { id: "a1", contactId: "c1", connectionId: "w1", assigneeId: "ana", finishedCount: 0, createdAt: "2026-10-15T15:00:00.000Z" },
        { id: "b1", contactId: "c2", connectionId: "w2", assigneeId: "bia", finishedCount: 0, createdAt: "2026-10-15T15:00:00.000Z" },
      ],
      contacts: [],
      ratings: [],
      products: [
        { id: "p1", name: "Meta Ads" },
        { id: "p2", name: "Site" },
      ],
      productLinks: [
        { contactId: "c1", productId: "p1" },
        { contactId: "c2", productId: "p1" },
        { contactId: "c2", productId: "p2" },
      ],
      userId: "ana",
      admin: true,
    },
    { period: { mode: "total" }, attendantId: "", channelId: "" },
  ).productShares,
  [
    { name: "Meta Ads", count: 2 },
    { name: "Site", count: 1 },
  ],
);
assert.deepEqual(
  applyOverviewFilters(
    {
      stages: [],
      attendants: [],
      channels: [
        { id: "w1", name: "Principal" },
        { id: "w2", name: "Suporte" },
      ],
      conversations: [
        { id: "a1", contactId: "c1", connectionId: "w1", assigneeId: "ana", finishedCount: 0, createdAt: "2026-10-15T15:00:00.000Z" },
        { id: "b1", contactId: "c2", connectionId: "w2", assigneeId: "bia", finishedCount: 0, createdAt: "2026-10-15T15:00:00.000Z" },
      ],
      contacts: [],
      ratings: [],
      products: [{ id: "p1", name: "Meta Ads" }],
      productLinks: [{ contactId: "c1", productId: "p1" }],
      userId: "ana",
      admin: true,
    },
    { period: { mode: "total" }, attendantId: "", channelId: "w1" },
  ).channelShares,
  [{ name: "Principal", count: 1 }],
);
assert.equal(attendanceLabel({ assigneeName: "", botPaused: false, botSpoke: false, closed: false }), "Em fila");
assert.equal(attendanceLabel({ assigneeName: "", botPaused: false, botSpoke: true, closed: false }), "Bot atendendo");
assert.equal(attendanceLabel({ assigneeName: "Marina Costa", botPaused: true, botSpoke: true, closed: false }), "Marina Costa");
assert.equal(attendanceLabel({ assigneeName: "Marina Costa", botPaused: true, botSpoke: true, closed: true }), "Encerrado");
assert.equal(attendanceMark({ assigneeName: "", botPaused: false, botSpoke: true, closed: false }), "bot");
assert.equal(attendanceMark({ assigneeName: "", botPaused: true, botSpoke: false, closed: false }), "human");
assert.equal(attendanceMark({ assigneeName: "Marina Costa", botPaused: true, botSpoke: true, closed: false }), "human");
assert.equal(attendanceMark({ assigneeName: "", botPaused: false, botSpoke: false, closed: false }), "");
assert.equal(attendanceMark({ assigneeName: "Marina Costa", botPaused: true, botSpoke: true, closed: true }), "");
assert.equal(waitingForHuman({ assigneeName: "", botPaused: true, closed: false }), true);
assert.equal(waitingForHuman({ assigneeName: "", botPaused: false, closed: false }), false);
assert.equal(waitingForHuman({ assigneeName: "Marina Costa", botPaused: true, closed: false }), false);
assert.equal(waitingForHuman({ assigneeName: "", botPaused: true, closed: true }), false);
assert.equal(waitingForHuman({ assigneeName: "Ana", botPaused: true, closed: false, unreadCount: 2 }), true);
assert.equal(inboxLane({ assigneeName: "Ana", botPaused: true, closed: false }), "atendimento");
assert.equal(inboxLane({ assigneeName: "", botPaused: true, closed: false }), "aguardando");
assert.equal(inboxLane({ assigneeName: "", botPaused: false, closed: false }), "robo");
assert.equal(inboxLane({ assigneeName: "Ana", botPaused: true, closed: true }), "");
assert.equal(inboxLane({ assigneeName: "Ana", botPaused: true, closed: false, unreadCount: 4 }), "aguardando");
assert.equal(inboxLane({ assigneeName: "", botPaused: false, closed: false, unreadCount: 1 }), "aguardando");
const lanes = [
  { id: "human", contactId: "mozart", assigneeName: "Ana", botPaused: true, status: "active", pinned: false, updatedAt: "2026-10-22T12:00:00.000Z", unreadCount: 0 },
  { id: "bot", contactId: "mozart", assigneeName: "", botPaused: false, status: "queue", pinned: false, updatedAt: "2026-10-22T12:05:00.000Z", unreadCount: 0 },
  { id: "wait", contactId: "paulo", assigneeName: "", botPaused: true, status: "queue", pinned: true, updatedAt: "2026-10-22T11:00:00.000Z", unreadCount: 0 },
  { id: "robot", contactId: "grupo", assigneeName: "", botPaused: false, status: "queue", pinned: false, updatedAt: "2026-10-22T10:00:00.000Z", unreadCount: 0 },
  { id: "done", contactId: "grupo", assigneeName: "", botPaused: false, status: "closed", pinned: false, updatedAt: "2026-10-22T13:00:00.000Z", unreadCount: 0 },
];
const unreadHuman = [
  { id: "human", contactId: "focus", assigneeName: "Ana", botPaused: true, status: "active", pinned: false, updatedAt: "2026-10-22T12:00:00.000Z", unreadCount: 4 },
  { id: "sister", contactId: "focus", assigneeName: "", botPaused: false, status: "queue", pinned: false, updatedAt: "2026-10-22T11:00:00.000Z", unreadCount: 0 },
];
const unreadPeople = [{ id: "focus", name: "AI FOCUS", phone: "5598984054833", products: [], tags: [], stage: "" }];
const people = [
  { id: "mozart", name: "Mozart", phone: "5551999666841", products: ["Meta Ads"], tags: [{ name: "Suporte" }], stage: "Proposta" },
  { id: "paulo", name: "Paulo", phone: "5515998007677", products: [], tags: [], stage: "" },
  { id: "grupo", name: "Grupo V8", phone: "5551999999999", products: ["Google Ads"], tags: [{ name: "Curioso" }], stage: "Novos leads" },
];
const none = { products: [], tags: [], stages: [] };
assert.equal(inboxContactLane(lanes, "mozart"), "atendimento");
assert.deepEqual(inboxList(lanes, people, "atendimento", "", none).map((item) => item.id), ["human"]);
assert.deepEqual(inboxList(lanes, people, "robo", "", none).map((item) => item.id), ["robot"]);
assert.deepEqual(inboxList(lanes, people, "aguardando", "", none).map((item) => item.id), ["wait"]);
assert.deepEqual(inboxList(lanes, people, "atendimento", "moz", none).map((item) => item.id), ["human"]);
assert.deepEqual(inboxList(lanes, people, "aguardando", "98007677", none).map((item) => item.id), ["wait"]);
assert.deepEqual(inboxList(lanes, people, "todos", "", none).map((item) => item.id), ["wait", "done", "bot", "human", "robot"]);
assert.deepEqual(inboxList(lanes, people, "todos", "moz", none).map((item) => item.id), ["bot", "human"]);
assert.deepEqual(inboxTabCounts(lanes, people, "", none), {
  todos: 5,
  atendimento: 1,
  aguardando: 1,
  robo: 1,
});
assert.equal(inboxContactLane(unreadHuman, "focus"), "aguardando");
assert.deepEqual(inboxList(unreadHuman, unreadPeople, "aguardando", "", none).map((item) => item.id), ["human"]);
assert.deepEqual(inboxList(unreadHuman, unreadPeople, "atendimento", "", none).map((item) => item.id), []);
assert.deepEqual(inboxTabCounts(unreadHuman, unreadPeople, "", none), {
  todos: 2,
  atendimento: 0,
  aguardando: 1,
  robo: 0,
});
assert.equal(inboxQueryMatch("José", "Jose Silva", ""), true);
assert.equal(inboxFiltersMatch(people[0]!, { products: ["Meta Ads"], tags: ["Suporte"], stages: ["Proposta"] }), true);
assert.equal(inboxFiltersMatch(people[0]!, { products: ["Google Ads"], tags: [], stages: [] }), false);
assert.equal(keepAttendanceBotsPaused(true, false), true);
assert.equal(keepAttendanceBotsPaused(true, true), true);
assert.equal(keepAttendanceBotsPaused(false, true), true);
assert.equal(keepAttendanceBotsPaused(false, false), false);
assert.equal(quickReplyText("  Olá\r\n\nmundo  "), "Olá\n\nmundo");
assert.equal(quickReplyText(" a "), "");
assert.equal(quickReplyText("ab"), "ab");
assert.equal(inboxVisible({ assigneeId: "", userId: "a", admin: false }), true);
assert.equal(inboxVisible({ assigneeId: "a", userId: "a", admin: false }), true);
assert.equal(inboxVisible({ assigneeId: "b", userId: "a", admin: false }), false);
assert.equal(inboxVisible({ assigneeId: "b", userId: "a", admin: true }), true);
assert.equal(inboxUnread(["2026-10-13T12:00:00.000Z", "2026-10-13T12:05:00.000Z"], ""), 2);
assert.equal(inboxUnread(["2026-10-13T12:00:00.000Z", "2026-10-13T12:05:00.000Z"], "2026-10-13T12:01:00.000Z"), 1);
assert.deepEqual(
  inboxOrder([
    { id: "antiga", pinned: false, updatedAt: "2026-10-13T10:00:00.000Z" },
    { id: "fixa", pinned: true, updatedAt: "2026-10-13T09:00:00.000Z" },
    { id: "nova", pinned: false, updatedAt: "2026-10-13T12:00:00.000Z" },
  ]).map((item) => item.id),
  ["fixa", "nova", "antiga"],
);
assert.deepEqual(
  inboxOrder([
    { id: "b", pinned: false, updatedAt: "2026-10-13T12:00:00.000Z" },
    { id: "a", pinned: false, updatedAt: "2026-10-13T12:00:00.000Z" },
  ]).map((item) => item.id),
  ["a", "b"],
);
assert.equal(attendancePhone("+55 (11) 99999-9999"), "5511999999999");
assert.equal(attendancePhone("+55 (11) 99999-9"), "");
assert.equal(attendancePhone("11999999999"), "5511999999999");
assert.equal(attendancePhone("123"), "");
assert.equal(whatsappJidPhone("5511999999999@s.whatsapp.net"), "5511999999999");
assert.equal(whatsappJidPhone("120363@g.us"), "");
assert.equal(whatsappGroupJid("120363@g.us"), "");
assert.equal(whatsappGroupJid("status@broadcast"), "");
const grupo = "120363025246125269@g.us";
assert.equal(whatsappGroupJid(grupo), grupo);
assert.equal(whatsappGroupLabel(grupo), "Grupo 5269");
assert.equal(sameChatbotContact(grupo, "5511999999999"), false);
assert.equal(sameChatbotContact(grupo, grupo), true);
assert.equal(sameChatbotContact("5511999999999", "5511999999999"), true);
assert.equal(
  evolutionConversationPhone({ remoteJid: grupo, participant: "5511999999999@s.whatsapp.net" }, {}),
  grupo,
);
assert.equal(evolutionConversationPhone({ remoteJid: "5511999999999@s.whatsapp.net" }, {}), "5511999999999");
assert.equal(evolutionGroupSubject({ subject: "Equipe Comercial" }), "Equipe Comercial");
assert.equal(evolutionGroupSubject({ data: { subject: "Vendas" } }), "Vendas");
assert.equal(evolutionGroupSubject({}), "");
assert.equal(groupInboundText("Maria", "oi"), "Maria: oi");
assert.equal(groupInboundText("Maria", "Maria: oi"), "Maria: oi");
assert.equal(groupInboundText("", "oi"), "oi");
assert.equal(clientPhoneLabel(grupo), "Grupo");
assert.equal(clientPhoneLabel("5511999999999"), "(11) 99999-9999");
assert.equal(evolutionConnectionStatus("open"), "connected");
assert.equal(evolutionConnectionStatus("close"), "disconnected");
assert.equal(evolutionReportedStatus({ state: "open", instancePresent: true, removed: false, qrReady: false }), "connected");
assert.equal(evolutionReportedStatus({ state: "close", instancePresent: true, removed: false, qrReady: false }), "disconnected");
assert.equal(evolutionReportedStatus({ state: "", instancePresent: false, removed: false, qrReady: false }), "disconnected");
assert.equal(evolutionReportedStatus({ state: "close", instancePresent: true, removed: false, qrReady: true }), "qr");
assert.equal(evolutionMessageText({ conversation: "Olá" }), "Olá");
assert.equal(evolutionMessageText({ buttonsResponseMessage: { selectedButtonId: "1", selectedDisplayText: "Vendas" } }), "Vendas");
assert.equal(evolutionMessageText({ imageMessage: { url: "x" } }), "[imagem]");
assert.equal(evolutionMessageContent({ messageType: "imageMessage", message: { mimetype: "image/jpeg", url: "https://mmg.whatsapp.net/a", caption: "foto" } }).mediaKind, "image");
assert.equal(evolutionMessageContent({ messageType: "imageMessage", message: { mimetype: "image/jpeg", url: "https://mmg.whatsapp.net/a", caption: "foto" } }).text, "foto");
assert.equal(evolutionMessageContent({ message: { viewOnceMessageV2: { message: { videoMessage: { mimetype: "video/mp4" } } } } }).mediaKind, "video");
assert.equal(evolutionMessageContent({ messageType: "audioMessage", message: { audioMessage: { mimetype: "audio/ogg; codecs=opus" } } }).mediaKind, "audio");
assert.equal(evolutionMessageContent({ messageType: "audioMessage", message: { audioMessage: { mimetype: "audio/ogg; codecs=opus" } } }).mediaMime, "audio/ogg");
assert.equal(evolutionMediaFile({ mimetype: "audio/ogg", base64: "abc" }).kind, "audio");
assert.equal(
  evolutionMessageContent({
    messageType: "documentMessage",
    message: { documentMessage: { mimetype: "application/pdf", fileName: "boleto.pdf" } },
  }).mediaKind,
  "document",
);
assert.equal(
  evolutionMessageContent({
    messageType: "documentMessage",
    message: { documentMessage: { mimetype: "application/pdf", fileName: "boleto.pdf" } },
  }).text,
  "boleto.pdf",
);
assert.equal(evolutionMessageContent({ message: { conversation: "Olá" } }).text, "Olá");
assert.deepEqual(evolutionMediaFile({ mimetype: "image/jpeg", base64: "data:image/jpeg;base64,abc" }), { mime: "image/jpeg", base64: "abc", kind: "image" });
assert.equal(evolutionMediaFile({ base64: "abc" }, "video").kind, "video");
assert.equal(
  evolutionQrImage({ qrcode: { base64: "data:image/png;base64,abc" } }),
  "data:image/png;base64,abc",
);
assert.equal(evolutionContactPhone({ remoteJid: "123@lid", remoteJidAlt: "5511999999999@s.whatsapp.net" }), "5511999999999");
assert.equal(evolutionContactPhone({ remoteJid: "999@lid", senderPn: "5551999666841@s.whatsapp.net" }), "5551999666841");
const marceloLid = "123456789012345@lid";
const marceloPhone = "5551999666841@s.whatsapp.net";
const learned = learnLidPhones([
  { remoteJid: marceloLid, remoteJidAlt: marceloPhone },
  { remoteJid: marceloPhone, remoteJidAlt: marceloLid },
]);
assert.equal(learned[marceloLid], "5551999666841");
assert.equal(resolveIncomingPhone({ remoteJid: marceloLid }, learned), "5551999666841");
assert.equal(resolveIncomingPhone({ remoteJid: marceloLid }, {}), "");
assert.equal(evolutionContactPhone({ remoteJid: marceloLid }), "");
assert.equal(
  evolutionContactIdentity(evolutionMessageKey({ senderPn: marceloPhone }, { remoteJid: marceloLid, fromMe: false, id: "ABC" })).phone,
  "5551999666841",
);
assert.equal(
  evolutionResolvedPhone({ id: marceloLid, remoteJid: marceloLid, wuid: marceloPhone }),
  "5551999666841",
);
assert.equal(evolutionResolvedPhone([{ remoteJid: marceloLid }]), "");
const sentAt = Date.parse("2026-10-22T13:31:00.000Z");
assert.equal(incomingMessageInstant(Math.floor(sentAt / 1000), sentAt + 5 * 60_000), new Date(Math.floor(sentAt / 1000) * 1000).toISOString());
assert.equal(incomingMessageInstant("texto", sentAt), "");
assert.equal(evolutionContactIdentity({ remoteJid: marceloPhone, remoteJidAlt: marceloLid }).lid, marceloLid);
assert.deepEqual(flowSendAddresses("5551999666841", { "5551999666841": marceloLid }), ["5551999666841", marceloLid]);
assert.deepEqual(flowSendAddresses("(51) 99966-6841", new Map([["51999666841", marceloLid]])), ["5551999666841", marceloLid]);
assert.deepEqual(flowSendAddresses("5551999666841", {}), ["5551999666841"]);
assert.deepEqual(flowSendAddresses("120363000000000000@g.us", { "5551999666841": marceloLid }), ["120363000000000000@g.us"]);
assert.equal(evolutionMessageText("segunda mensagem"), "segunda mensagem");
assert.equal(channelsAllConnected([{ status: "connected" }, { status: "connected" }]), true);
assert.equal(channelsAllConnected([{ status: "connected" }, { status: "disconnected" }]), false);
assert.equal(channelsAllConnected([]), false);
assert.equal(droppedChannels([{ status: "connected" }, { status: "disconnected" }, { status: "error" }, { status: "qr" }]).length, 2);
assert.equal(composerSendsOnEnter({ key: "Enter", code: "NumpadEnter", shiftKey: false, pending: false, text: "Bom dia" }), true);
assert.equal(composerSendsOnEnter({ key: "Enter", code: "Enter", shiftKey: true, pending: false, text: "Bom dia" }), false);
assert.equal(composerSendsOnEnter({ key: "Enter", code: "Enter", shiftKey: false, pending: true, text: "Bom dia" }), false);
assert.equal(composerSendsOnEnter({ key: "Enter", code: "Enter", shiftKey: false, pending: false, text: "   " }), false);
assert.equal(composerDraftAfterSend("Podemos agendar", "Podemos agendar"), "");
assert.equal(composerDraftAfterSend("Podemos agendar amanhã", "Podemos agendar"), "Podemos agendar amanhã");
assert.equal(composerDraftAfterSend("", "Podemos agendar"), "");
assert.equal(composerDraftChange("Podemos agendar", "Podemos agendar"), "");
assert.equal(composerDraftChange("Nova mensagem", "Podemos agendar"), "Nova mensagem");
assert.equal(composerMediaFile({ name: "foto.jpg", mime: "image/jpeg", size: 1200, kind: "image" }).ok, true);
assert.equal(composerMediaFile({ name: "contrato.pdf", mime: "", size: 1200, kind: "document" }).ok, true);
assert.equal(composerMediaFile({ name: "fala.mp3", mime: "audio/mpeg", size: 1200, kind: "audio" }).ok, true);
assert.equal(composerMediaFile({ name: "clipe.mp4", mime: "video/mp4", size: 1200, kind: "video" }).ok, true);
assert.equal(composerMediaFile({ name: "foto.jpg", mime: "image/jpeg", size: 1200, kind: "document" }).ok, false);
assert.equal(composerMediaFile({ name: "grande.pdf", mime: "application/pdf", size: 16 * 1024 * 1024 + 1, kind: "document" }).ok, false);
assert.equal(voiceRecorderMime((mime) => mime === "audio/webm"), "audio/webm");
assert.equal(voiceRecorderMime(() => false), "");
assert.equal(voiceNoteName("audio/webm;codecs=opus"), "audio.webm");
assert.equal(voiceNoteName("audio/mp4"), "audio.m4a");
assert.equal(composerMediaFile({ name: voiceNoteName("audio/webm;codecs=opus"), mime: "audio/webm;codecs=opus", size: 2400, kind: "audio" }).ok, true);
assert.equal(evolutionMediaFile({ mimetype: "application/pdf", base64: "abc" }, "document").kind, "document");
assert.equal(shouldSyncEvolution(0, 10000), true);
assert.equal(shouldSyncEvolution(1000, 5000), false);
assert.deepEqual(
  pendingOutgoing(
    [{ conversationId: "conversa", direction: "out", text: "Oi", createdAt: "2026-10-14T12:00:00.000Z" }],
    [{ id: "novo", conversationId: "conversa", text: "Bom dia", createdAt: "2026-10-14T12:01:00.000Z" }],
  ).map((item) => item.id),
  ["novo"],
);
assert.deepEqual(
  pendingOutgoing(
    [{ conversationId: "conversa", direction: "out", text: "Bom dia", createdAt: "2026-10-14T12:01:01.000Z" }],
    [{ id: "novo", conversationId: "conversa", text: "Bom dia", createdAt: "2026-10-14T12:01:00.000Z" }],
  ),
  [],
);
assert.deepEqual(
  pendingOutgoing(
    [{ conversationId: "conversa", direction: "out", text: "Oi", createdAt: "2026-10-14T11:00:00.000Z" }],
    [{ id: "novo", conversationId: "conversa", text: "Oi", createdAt: "2026-10-14T12:01:00.000Z" }],
  ).map((item) => item.id),
  ["novo"],
);
assert.equal(messageClock("2026-10-14T12:05:00.000Z", "2026-10-14T15:00:00.000Z"), "Hoje, 09:05");
assert.equal(messageClock("2026-10-13T12:05:00.000Z", "2026-10-14T15:00:00.000Z"), "Ontem, 09:05");
assert.equal(messageClock("2026-10-10T15:10:00.000Z", "2026-10-14T15:00:00.000Z"), "10/10, 12:10");
assert.equal(audioDurationLabel(12), "0:12");
assert.equal(audioDurationLabel(125), "2:05");
assert.equal(audioWaveBars([0, 0.2, 0.8, 0.4], 2).length, 2);
assert.equal(Math.max(...audioWaveBars([0, 0.2, 0.8, 0.4], 2)), 1);
assert.equal(acceptSnapshot(1, 0), true);
assert.equal(acceptSnapshot(2, 1), true);
assert.equal(acceptSnapshot(1, 2), false);
let lastApplied = 0;
let started = 0;
function startSnapshot() {
  started += 1;
  return started;
}
function finishSnapshot(requestId: number) {
  const keep = acceptSnapshot(requestId, lastApplied);
  if (keep) lastApplied = requestId;
  return keep;
}
const firstLoad = startSnapshot();
const overlappedLoad = startSnapshot();
assert.equal(started, 2);
assert.equal(finishSnapshot(firstLoad), true);
assert.equal(finishSnapshot(overlappedLoad), true);
assert.equal(finishSnapshot(firstLoad), false);
assert.equal(stickToLatestMessage(0), true);
assert.equal(stickToLatestMessage(120), false);
assert.equal(
  messageHistoryScrollTop({ stickToBottom: true, scrollTop: 400, previousHeight: 800, nextHeight: 1200 }),
  1200,
);
assert.equal(
  messageHistoryScrollTop({ stickToBottom: false, scrollTop: 400, previousHeight: 800, nextHeight: 1200 }),
  800,
);
assert.equal(
  messageHistoryScrollTop({ stickToBottom: false, scrollTop: 400, previousHeight: 800, nextHeight: 800 }),
  400,
);
assert.equal(evolutionIncomingMessages({ message: { key: { id: "2", remoteJid: "5511999999999@s.whatsapp.net" }, message: { conversation: "segunda" } } }).length, 1);
assert.equal(evolutionIncomingMessages({ messages: { records: [{ key: { id: "1" } }] } }).length, 1);
assert.equal(evolutionIncomingMessages({ key: { id: "1" }, message: { conversation: "Oi" } }).length, 1);
assert.equal(evolutionIncomingMessages([{ key: { id: "1" } }, { key: { id: "2" } }]).length, 2);
assert.equal(evolutionIncomingMessages({ messages: [{ key: { id: "1" } }] }).length, 1);
assert.equal(
  evolutionSameOwnerInstance(
    [
      { name: "atual", ownerJid: "5551@s.whatsapp.net", _count: { Message: 0 } },
      { name: "anterior", ownerJid: "5551@s.whatsapp.net", _count: { Message: 4 } },
      { name: "outro", ownerJid: "5599@s.whatsapp.net", _count: { Message: 9 } },
    ],
    "atual",
  ),
  "anterior",
);
assert.equal(evolutionSameOwnerInstance([{ name: "atual", ownerJid: "5551@s.whatsapp.net", _count: { Message: 2 } }], "atual"), "");
assert.equal(evolutionProfileNumber("5551997451409"), "5551997451409@s.whatsapp.net");
assert.equal(evolutionProfileNumber("555197451409"), "5551997451409@s.whatsapp.net");
assert.equal(evolutionProfileNumber("(51) 99745-1409"), "5551997451409@s.whatsapp.net");
assert.equal(evolutionProfilePictureUrl({ profilePictureUrl: "https://pps.whatsapp.net/foto.jpg" }), "https://pps.whatsapp.net/foto.jpg");
assert.equal(evolutionProfilePictureUrl({ profilePictureUrl: null, picture: "https://pps.whatsapp.net/foto.jpg" }), "https://pps.whatsapp.net/foto.jpg");
assert.equal(evolutionProfilePictureUrl([{ profilePicUrl: "https://pps.whatsapp.net/foto.jpg" }]), "https://pps.whatsapp.net/foto.jpg");
assert.equal(evolutionProfilePictureUrl({ profilePictureUrl: "" }), "");
assert.deepEqual(evolutionContactAvatar({ remoteJid: "5511999999999@s.whatsapp.net", profilePicUrl: "https://pps.whatsapp.net/foto.jpg" }), {
  jid: "5511999999999@s.whatsapp.net",
  phone: "5511999999999",
  url: "https://pps.whatsapp.net/foto.jpg",
  changed: false,
});
assert.equal(evolutionContactAvatar({ id: "5511999999999@s.whatsapp.net", imgUrl: "changed" })?.changed, true);
assert.deepEqual(tintQrPixel(255, 255, 255, 255), [255, 255, 255, 255]);
assert.equal(evolutionInstanceNameOf({ name: "nex-walkup" }), "nex-walkup");
assert.equal(evolutionInstanceNameOf({ instance: { instanceName: "nex-walkup" } }), "nex-walkup");
assert.equal(evolutionInstanceClosed({ connectionStatus: "close", disconnectionReasonCode: 401 }), true);
assert.equal(evolutionInstanceClosed({ connectionStatus: "open" }), false);
assert.equal(evolutionInstanceClosed(null), true);
assert.equal(
  evolutionNumberInUse(
    [
      { name: "caiu", number: "5551997979224", connectionStatus: "close" },
      { name: "ativo", number: "5551998335401", connectionStatus: "open" },
    ],
    "5551997979224",
  ),
  false,
);
assert.equal(evolutionNumberInUse([{ name: "ativo", ownerJid: "5551998335401@s.whatsapp.net", connectionStatus: "open" }], "5551998335401"), true);
assert.equal(catalogName("  Marcelo Mozart  "), "Marcelo Mozart");
assert.equal(catalogName("a"), "");
assert.equal(catalogName("Etiqueta", 32), "Etiqueta");
assert.equal(tagColorValue("#6F02FD"), "#6f02fd");
assert.equal(tagColorValue("roxo"), "");
assert.equal(tagInk("#ffffff"), "#1a1a1a");
assert.equal(tagInk("#6f02fd"), "#ffffff");
const cardTags = inboxContactTags(
  [
    { contactId: "drax", tagId: "1" },
    { contactId: "drax", tagId: "1" },
    { contactId: "drax", tagId: "missing" },
  ],
  [{ id: "1", name: "Cliente", color: "#6F02FD" }],
);
assert.deepEqual(cardTags.get("drax"), [{ name: "Cliente", color: "#6f02fd" }]);
assert.equal(keepWhatsappName("5551999666841", false, "Marcelo Mozart", "5551999666841"), "Marcelo Mozart");
assert.equal(keepWhatsappName("Cliente VIP", true, "Marcelo Mozart", "5551999666841"), "Cliente VIP");
assert.equal(keepWhatsappName("Marcelo Mozart", false, "5551999666841", "5551999666841"), "Marcelo Mozart");
assert.equal(contactFileLabel("audio/ogg", "audio.ogg"), "Áudio");
assert.equal(contactFileLabel("image/jpeg", "imagem.jpg"), "Imagem");
assert.equal(savedMediaTitle("image/jpeg", "imagem.jpg"), "Imagem");
assert.equal(savedMediaTitle("audio/ogg", "audio.ogg"), "Áudio");
assert.equal(savedMediaTitle("image/jpeg", "Fachada"), "Fachada");
assert.equal(internalNote("  Cliente pediu retorno  "), "Cliente pediu retorno");
assert.equal(internalNote(` ${"a".repeat(500)} `), "a".repeat(500));
assert.equal(internalNote("a".repeat(501)), "");
assert.equal(kanbanStageName("  Proposta  "), "Proposta");
assert.equal(kanbanStageName("a"), "");
assert.deepEqual(moveKanbanStage(["Novos leads", "Proposta", "Ganho"], 2, -1), ["Novos leads", "Ganho", "Proposta"]);
assert.deepEqual(moveKanbanStage(["Novos leads", "Ganho"], 0, -1), ["Novos leads", "Ganho"]);

const listedClients: ChatbotClientRow[] = [
  { id: "1", name: "Marcelo Mozart", phone: "51999666841", negotiatedCents: 140000, tags: ["Alto Potencial"], attendant: "Walkup", stage: "Proposta", products: ["Site", "Tráfego"] },
  { id: "2", name: "Ana", phone: "51988887777", negotiatedCents: null, tags: ["Novo"], attendant: "Nex", stage: "Sucesso", products: ["Site"] },
];
assert.deepEqual(filterChatbotClients(listedClients, { search: "", name: "", tag: "Alto Potencial", attendant: "", stage: "", product: "" }).map((client) => client.id), ["1"]);
assert.deepEqual(filterChatbotClients(listedClients, { search: "", name: "", tag: "", attendant: "", stage: "", product: "Site" }).map((client) => client.id), ["1", "2"]);
assert.deepEqual(filterChatbotClients(listedClients, { search: "ana", name: "", tag: "", attendant: "", stage: "Sucesso", product: "" }).map((client) => client.id), ["2"]);
assert.deepEqual(filterChatbotClients(listedClients, { search: "99966", name: "", tag: "", attendant: "", stage: "", product: "" }).map((client) => client.id), ["1"]);
assert.deepEqual(filterChatbotClients(listedClients, { search: "mozart", name: "", tag: "", attendant: "", stage: "", product: "" }).map((client) => client.id), ["1"]);
assert.equal(clientFilterOptions(listedClients).product.join(","), "Site,Tráfego");
assert.equal(ratingScore("5"), 5);
assert.equal(ratingScore("4 — Bom"), 4);
assert.equal(ratingScore("Excelente"), 5);
assert.equal(ratingScore("nota 3"), 3);
assert.equal(ratingScore("quero continuar o atendimento"), null);
assert.equal(isRatingThanks("Obrigado pela sua avaliação."), true);
assert.equal(isRatingThanks("Obrigado pela sua avaliação. "), true);
assert.equal(isRatingThanks("5"), false);
assert.deepEqual(noticeMessageIds([{ id: "nota", conversationId: "fechada" }, { id: "nova", conversationId: "aberta" }], ["fechada"]), ["nova"]);
assert.equal(ratingScore("15"), null);
assert.equal(ratingAverage([5, 4, 4]), 4.3);
assert.equal(ratingAverage([]), null);
assert.equal(ratingAverageLabel(4.3), "4,3");
assert.equal(ratingAverageLabel(null), "—");
assert.equal(ratingPrompt("  "), "");
assert.equal(ratingMessage("Como foi?").includes("1 — Péssimo"), true);
assert.equal(defaultChatbotProfiles().attendant.inbox, true);
assert.equal(defaultChatbotProfiles().attendant.settings, false);
assert.equal(defaultChatbotProfiles().supervisor.team, true);
assert.equal(defaultChatbotProfiles().supervisor.connection, false);
assert.equal(defaultChatbotProfiles().manager.settings, true);
assert.equal(profileForMenus(defaultChatbotProfiles().supervisor, defaultChatbotProfiles()), "supervisor");
assert.equal(profileForMenus(allChatbotMenus(false), defaultChatbotProfiles()), null);
assert.equal(chatbotProfilesFromStorage({ attendant: { inbox: true } }).attendant.kanban, false);
assert.equal(chatbotProfilesFromStorage(null).manager.inbox, true);
assert.equal(chatbotProfileLabel("manager"), "Gerente");
assert.equal(botPresenceCue({ audio: true }).presence, "recording");
assert.equal(botPresenceCue({ audio: true }).delay, 2800);
assert.equal(botPresenceCue({ text: "Oi" }).presence, "composing");
assert.equal(botPresenceCue({ text: "Oi" }).delay, 1100);
assert.equal(botPresenceCue({ text: "a".repeat(400) }).delay, 5000);
assert.equal(noticeCue(null, { messages: ["m1"], queues: ["q1"] }).play, false);
assert.equal(noticeCue({ messages: ["m1"], queues: ["q1"] }, { messages: ["m1", "m2"], queues: ["q1"] }).play, false);
assert.equal(noticeCue({ messages: ["m1"], queues: [] }, { messages: ["m1", "m2"], queues: ["q1"] }).play, true);
assert.equal(noticeCue({ messages: ["m1"], queues: ["q1"] }, { messages: ["m1"], queues: [] }).play, false);
assert.equal(noticeCue({ messages: ["m1"], queues: [] }, { messages: ["m1"], queues: ["q1"] }).play, true);
assert.equal(noticePlayer("a", [{ tabId: "a", visible: true }, { tabId: "b", visible: false }]), true);
assert.equal(noticePlayer("b", [{ tabId: "a", visible: true }, { tabId: "b", visible: false }]), false);
assert.equal(noticePlayer("a", [{ tabId: "b", visible: false }, { tabId: "a", visible: false }]), true);
assert.equal(noticePlayer("b", [{ tabId: "b", visible: false }, { tabId: "a", visible: false }]), false);
assert.equal(queueMinutes("5"), 5);
assert.equal(queueMinutes(15), 15);
assert.equal(queueMinutes("0"), null);
assert.equal(queueMinutes("15.5"), null);
assert.equal(chatbotCompanyName("  Nex  Marketing  "), "Nex Marketing");
assert.equal(chatbotCompanyName("a"), "");
assert.equal(chatbotCompanyName("a".repeat(121)), "");
assert.equal(reactivationMinutes(20), 20);
assert.equal(reactivationMinutes(10), 15);
assert.equal(reactivatesClosedConversation("2026-10-15T12:00:00.000Z", 15, Date.parse("2026-10-15T12:14:00.000Z")), true);
assert.equal(reactivatesClosedConversation("2026-10-15T12:00:00.000Z", 15, Date.parse("2026-10-15T12:15:00.000Z")), false);
assert.equal(reactivatesClosedConversation("", 15, Date.parse("2026-10-15T12:01:00.000Z")), false);
assert.equal(attendanceExpired("2026-10-15T12:00:00.000Z", 15, Date.parse("2026-10-15T12:14:00.000Z")), false);
assert.equal(attendanceExpired("2026-10-15T12:00:00.000Z", 15, Date.parse("2026-10-15T12:15:00.000Z")), true);
assert.equal(attendanceExpired("", 15, Date.parse("2026-10-15T12:20:00.000Z")), false);
assert.equal(offlineNoticeText(`  ${defaultOfflineNotice}  `), defaultOfflineNotice);
assert.equal(offlineNoticeText("a"), "");
assert.equal(waitingMinutes("2026-10-15T12:00:00.000Z", Date.parse("2026-10-15T12:05:00.000Z")), 5);
assert.deepEqual(
  overdueQueue(
    [
      { name: "Ana", since: "2026-10-15T12:00:00.000Z" },
      { name: "Eduardo", since: "2026-10-15T12:03:00.000Z" },
    ],
    5,
    Date.parse("2026-10-15T12:05:30.000Z"),
  ).map((lead) => lead.name),
  ["Ana"],
);
const lane: string[] = [];
const firstLane = queueByKey("conversa", async () => {
  lane.push("inicio");
  await new Promise((resolve) => setTimeout(resolve, 20));
  lane.push("fim");
});
const secondLane = queueByKey("conversa", async () => {
  lane.push("seguinte");
});
await Promise.all([firstLane, secondLane]);
assert.deepEqual(lane, ["inicio", "fim", "seguinte"]);
assert.deepEqual(whatsappTextPayload("5547992082637", "https://app.nexmeta.com.br/contratacao?contato=9dcc028f-b4b8-4c79-b3cd-851b7d39bec9"), {
  number: "5547992082637",
  text: "https://app.nexmeta.com.br/contratacao?contato=9dcc028f-b4b8-4c79-b3cd-851b7d39bec9",
  linkPreview: false,
});
assert.deepEqual(whatsappFlowTextPayload("5547992082637", "Olá, tudo bem! Marcelo aqui...", 1800), {
  number: "5547992082637",
  text: "Olá, tudo bem! Marcelo aqui...",
  linkPreview: false,
  delay: 1800,
});
assert.equal(whatsappFlowTextPayload("5547992082637", "Podemos conversar hoje?").linkPreview, false);
assert.deepEqual(whatsappFlowAudioPayload("5547992082637", "QQ==", 2800), { number: "5547992082637", audio: "QQ==", encoding: true, delay: 2800 });
assert.equal(whatsappCadastroButton("5547992082637", "https://app.nexmeta.com.br/c/exemplo").buttons[0]?.displayText, "Cadastro");
assert.equal(whatsappCadastroButton("5547992082637", "https://app.nexmeta.com.br/c/exemplo").buttons[0]?.type, "url");
const proposta = whatsappDocumentPayload("5547992082637", propostaFileName, "QUJERg==");
assert.equal(proposta.fileName, "NEX_Apresentacao.pdf");
assert.deepEqual([...propostaMessages], [
  "Conforme combinado segue a proposta da NEX.",
  "Quando posso retornar para darmos continuidade?",
]);
assert.equal(tagGrantedByMinuta(true), altoPotencialTag);
assert.equal(tagGrantedByMinuta(false), "");
assert.equal(tagGrantedBySuccess("Sucesso"), activeClientTag);
assert.equal(tagGrantedBySuccess("sucesso"), activeClientTag);
assert.equal(tagGrantedBySuccess("Proposta"), "");
assert.equal(addedLeadTag, "Lead adicionado");
assert.equal(returnInstant({ date: "2026-10-23", hour: 15, minute: 30 }, Date.parse("2026-10-22T12:00:00-03:00")), "2026-10-23T18:30:00.000Z");
assert.equal(returnInstant({ date: "2026-10-22", hour: 11, minute: 0 }, Date.parse("2026-10-22T12:00:00-03:00")), "");
assert.equal(returnInstant({ date: "2026-02-31", hour: 10, minute: 0 }, Date.parse("2026-02-01T12:00:00-03:00")), "");
assert.equal(returnMonthCells("2026-10").filter(Boolean).length, 31);
assert.equal(returnMonthCells("2026-10")[3], "2026-10-01");
assert.equal(defaultReturnSlot(Date.parse("2026-10-22T15:40:00-03:00")).hour, 16);
const minuta = whatsappDocumentPayload("5547992082637", minutaFileName, "QUJERg==");
assert.equal(minuta.mediatype, "document");
assert.equal(minuta.mimetype, "application/pdf");
assert.equal(minuta.fileName, "MINUTA NEX.pdf");
assert.equal(minuta.caption, "");
assert.equal(minuta.media, "QUJERg==");
assert.deepEqual(artesFileNames(["SIAPE.png", "nota.txt", ".gitkeep", "CLT1.PNG", "foto.jpg", "CLT1.PNG"]), ["CLT1.PNG", "foto.jpg", "SIAPE.png"]);
assert.equal(artesMime("CONVENIO SP.png"), "image/png");
assert.equal(artesMime("arte.webp"), "image/webp");
assert.equal(whatsappImagePayload("5547992082637", "CLT1.png", "image/png", "aaa").mediatype, "image");
const emptyExtra = { contracting: null, document: "", rg: "", showDocument: true, showRg: true };
assert.equal(contactExtraDataCount(emptyExtra), 0);
assert.equal(contactExtraDataCount({ ...emptyExtra, document: "12345678901", rg: "1234567", agendaEmails: ["ana@empresa.com"] }), 3);
assert.equal(
  contactExtraDataCount({
    ...emptyExtra,
    contracting: {
      id: "1",
      protocol: "123456",
      cnpj: "04.252.011/0001-10",
      legalName: "Empresa",
      address: "Rua 1",
      representativeName: "Ana",
      representativeDocument: "390.533.447-05",
      representativeEmail: "ana@empresa.com",
      witnessName: "Bia",
      witnessDocument: "123.456.789-09",
      witnessEmail: "bia@empresa.com",
    },
  }),
  6,
);
assert.equal(acceptsInboundMessageEvent("MESSAGES_UPSERT"), true);
assert.equal(acceptsInboundMessageEvent("messages.update"), false);
assert.equal(inboundStartsBot({ fromMe: false, event: "messages.upsert" }), true);
assert.equal(inboundStartsBot({ fromMe: true, event: "messages.upsert" }), false);
assert.equal(inboundBotAction({ inserted: true, source: "webhook" }), "run");
assert.equal(inboundBotAction({ inserted: false, source: "webhook" }), "retry");
assert.equal(inboundBotAction({ inserted: true, source: "import" }), "store");
assert.equal(inboundBotAction({ inserted: false, source: "import" }), "store");
assert.equal(sameInboundMessage({ instance: "nex", externalId: "A", fromMe: false }, { instance: "nex", externalId: "A", fromMe: false }), true);
assert.equal(sameInboundMessage({ instance: "nex", externalId: "A", fromMe: false }, { instance: "nex", externalId: "B", fromMe: false }), false);
assert.equal(flowClaimAllowsSend(true), true);
assert.equal(flowClaimAllowsSend(false), false);
const now = Date.parse("2026-10-23T18:12:00.000Z");
assert.equal(freshRunBlocksResend({ manual: false, hasOutbound: false, updatedAt: now - 1000, now }), true);
assert.equal(freshRunBlocksResend({ manual: false, hasOutbound: true, updatedAt: now - 1000, now }), false);
assert.equal(freshRunBlocksResend({ manual: false, hasOutbound: false, updatedAt: now - freshFlowRunMs - 1, now }), false);
assert.equal(shouldBlindResendAfterTimeout(), false);
assert.equal(panelRowsAreDistinct([{ externalId: "A" }, { externalId: "A" }]), false);
assert.equal(panelRowsAreDistinct([{ externalId: "A" }, { externalId: "B" }]), true);
const seenIds = new Set<string>();
function claimOnce(id: string) {
  if (seenIds.has(id)) return false;
  seenIds.add(id);
  return true;
}
assert.equal([claimOnce("A"), claimOnce("A")].filter(flowClaimAllowsSend).length, 1);
assert.equal([claimOnce("B"), claimOnce("C")].filter(flowClaimAllowsSend).length, 2);
const orderedLane: number[] = [];
await Promise.all([
  queueByKey("ordem", async () => {
    orderedLane.push(1);
    await new Promise((resolve) => setTimeout(resolve, 20));
    orderedLane.push(2);
  }),
  queueByKey("ordem", async () => {
    orderedLane.push(3);
  }),
]);
assert.deepEqual(orderedLane, [1, 2, 3]);
