import assert from "node:assert/strict";
import {
  evolutionConnectionStatus,
  evolutionContactPhone,
  evolutionIncomingMessages,
  evolutionMessageText,
  evolutionSameOwnerInstance,
  evolutionQrImage,
  tintQrPixel,
  attendancePhone,
  whatsappJidPhone,
  whatsappMask,
} from "./chatbot-evo";

assert.equal(whatsappMask("1"), "(1");
assert.equal(whatsappMask("11"), "(11");
assert.equal(whatsappMask("119"), "(11) 9");
assert.equal(whatsappMask("11999999999"), "(11) 99999-9999");
assert.equal(whatsappMask("5511999999999"), "(11) 99999-9999");
assert.equal(whatsappMask("55999999999"), "(55) 99999-9999");
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
assert.deepEqual(tintQrPixel(37, 211, 102, 255), [111, 2, 253, 255]);
assert.deepEqual(tintQrPixel(255, 255, 255, 255), [255, 255, 255, 255]);
