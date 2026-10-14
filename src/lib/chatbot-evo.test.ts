import assert from "node:assert/strict";
import {
  evolutionConnectionStatus,
  evolutionContactAvatar,
  evolutionContactPhone,
  evolutionIncomingMessages,
  evolutionMessageText,
  evolutionMessageContent,
  evolutionMediaFile,
  evolutionSameOwnerInstance,
  evolutionProfilePictureUrl,
  evolutionQrImage,
  tintQrPixel,
  attendanceLabel,
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
assert.equal(evolutionMessageContent({ message: { conversation: "Olá" } }).text, "Olá");
assert.deepEqual(evolutionMediaFile({ mimetype: "image/jpeg", base64: "data:image/jpeg;base64,abc" }), { mime: "image/jpeg", base64: "abc", kind: "image" });
assert.equal(evolutionMediaFile({ base64: "abc" }, "video").kind, "video");
assert.equal(
  evolutionQrImage({ qrcode: { base64: "data:image/png;base64,abc" } }),
  "data:image/png;base64,abc",
);
assert.equal(evolutionContactPhone({ remoteJid: "123@lid", remoteJidAlt: "5511999999999@s.whatsapp.net" }), "5511999999999");
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
