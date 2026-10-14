import assert from "node:assert/strict";
import {
  evolutionConnectionStatus,
  evolutionContactAvatar,
  evolutionContactPhone,
  evolutionContactIdentity,
  learnLidPhones,
  resolveIncomingPhone,
  composerSendsOnEnter,
  shouldSyncEvolution,
  pendingOutgoing,
  messageClock,
  audioDurationLabel,
  audioWaveBars,
  acceptSnapshot,
  stickToLatestMessage,
  evolutionIncomingMessages,
  evolutionMessageText,
  evolutionMessageContent,
  evolutionMediaFile,
  evolutionSameOwnerInstance,
  evolutionProfilePictureUrl,
  evolutionQrImage,
  tintQrPixel,
  attendanceLabel,
  headerAttendant,
  negotiatedCents,
  negotiatedLabel,
  clientVisibleTo,
  overviewMetrics,
  protectedKanbanStage,
  withWonKanbanStage,
  inboxOrder,
  inboxUnread,
  inboxVisible,
  attendancePhone,
  preferredWhatsappPhone,
  sameWhatsappAccount,
  evolutionInstanceClosed,
  evolutionInstanceNameOf,
  evolutionNumberInUse,
  whatsappDeviceRemoved,
  whatsappJidPhone,
  whatsappMask,
  catalogName,
  tagColorValue,
  tagInk,
  keepWhatsappName,
  contactFileLabel,
  savedMediaTitle,
  internalNote,
  kanbanStageName,
  moveKanbanStage,
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
assert.equal(negotiatedCents(""), null);
assert.equal(negotiatedCents("R$ 1.250,00"), 125000);
assert.equal(negotiatedLabel(125000).replace(/\s/g, " "), "R$ 1.250,00");
assert.equal(clientVisibleTo("ana", "ana", false), true);
assert.equal(clientVisibleTo("ana", "bia", false), false);
assert.equal(clientVisibleTo("ana", "bia", true), true);
assert.equal(clientVisibleTo("", "ana", false), false);
assert.equal(protectedKanbanStage(" sucesso "), true);
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
  { received: 2, attending: 1, finished: 3, openDeals: 2, negotiatingCents: 35000, wonCents: 25000, clients: 1 },
);
assert.equal(attendanceLabel({ assigneeName: "", botPaused: false, botSpoke: false, closed: false }), "Em fila");
assert.equal(attendanceLabel({ assigneeName: "", botPaused: false, botSpoke: true, closed: false }), "Bot atendendo");
assert.equal(attendanceLabel({ assigneeName: "Marina Costa", botPaused: true, botSpoke: true, closed: false }), "Marina Costa");
assert.equal(attendanceLabel({ assigneeName: "Marina Costa", botPaused: true, botSpoke: true, closed: true }), "Encerrado");
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
assert.equal(evolutionConnectionStatus("open"), "connected");
assert.equal(evolutionConnectionStatus("close"), "disconnected");
assert.equal(evolutionMessageText({ conversation: "Olá" }), "Olá");
assert.equal(evolutionMessageText({ imageMessage: { url: "x" } }), "[imagem]");
assert.equal(evolutionMessageContent({ messageType: "imageMessage", message: { mimetype: "image/jpeg", url: "https://mmg.whatsapp.net/a", caption: "foto" } }).mediaKind, "image");
assert.equal(evolutionMessageContent({ messageType: "imageMessage", message: { mimetype: "image/jpeg", url: "https://mmg.whatsapp.net/a", caption: "foto" } }).text, "foto");
assert.equal(evolutionMessageContent({ message: { viewOnceMessageV2: { message: { videoMessage: { mimetype: "video/mp4" } } } } }).mediaKind, "video");
assert.equal(evolutionMessageContent({ messageType: "audioMessage", message: { audioMessage: { mimetype: "audio/ogg; codecs=opus" } } }).mediaKind, "audio");
assert.equal(evolutionMessageContent({ messageType: "audioMessage", message: { audioMessage: { mimetype: "audio/ogg; codecs=opus" } } }).mediaMime, "audio/ogg");
assert.equal(evolutionMediaFile({ mimetype: "audio/ogg", base64: "abc" }).kind, "audio");
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
assert.equal(evolutionContactIdentity({ remoteJid: marceloPhone, remoteJidAlt: marceloLid }).lid, marceloLid);
assert.equal(evolutionMessageText("segunda mensagem"), "segunda mensagem");
assert.equal(composerSendsOnEnter({ key: "Enter", code: "Enter", shiftKey: false, pending: false, text: "Bom dia" }), true);
assert.equal(composerSendsOnEnter({ key: "Enter", code: "NumpadEnter", shiftKey: false, pending: false, text: "Bom dia" }), true);
assert.equal(composerSendsOnEnter({ key: "Enter", code: "Enter", shiftKey: true, pending: false, text: "Bom dia" }), false);
assert.equal(composerSendsOnEnter({ key: "Enter", code: "Enter", shiftKey: false, pending: true, text: "Bom dia" }), false);
assert.equal(composerSendsOnEnter({ key: "Enter", code: "Enter", shiftKey: false, pending: false, text: "   " }), false);
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
assert.equal(evolutionProfilePictureUrl({ profilePictureUrl: "https://pps.whatsapp.net/foto.jpg" }), "https://pps.whatsapp.net/foto.jpg");
assert.equal(evolutionProfilePictureUrl({ profilePictureUrl: "" }), "");
assert.deepEqual(evolutionContactAvatar({ remoteJid: "5511999999999@s.whatsapp.net", profilePicUrl: "https://pps.whatsapp.net/foto.jpg" }), {
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
