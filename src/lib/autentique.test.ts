import assert from "node:assert/strict";
import { autentiqueEvent, contractContactId, contractDispatch, contractDocumentName, contractFullySigned, contractGone, contractLookupState, contractSignedMessage, signatureDone } from "./autentique";

assert.equal(contractDocumentName("  8f3c1a20-1111-2222-3333-444455556666  "), "Contrato NEX — 8f3c1a20-1111-2222-3333-444455556666");
assert.equal(
  contractSignedMessage("  Marcelo   Mozart "),
  "Oi Marcelo Mozart! identificamos a assinatura do seu contrato. Por favor, me informe se já recebeu as instruções para acesso da plataforma NEX?",
);
assert.equal(signatureDone(null), false);
assert.equal(signatureDone(""), false);
assert.equal(signatureDone("2026-10-19T12:00:00.000Z"), true);
assert.equal(signatureDone({ created_at: "2026-10-19T12:00:00.000Z" }), true);
assert.equal(
  contractFullySigned(
    [
      { email: "Ana@Empresa.com", signed: "2026-10-19T12:00:00.000Z" },
      { email: "bia@empresa.com", signed: null },
    ],
    "ana@empresa.com",
    "bia@empresa.com",
  ),
  false,
);
assert.equal(
  contractFullySigned(
    [
      { email: "ana@empresa.com", signed: { created_at: "2026-10-19T12:00:00.000Z" } },
      { email: "bia@empresa.com", signed: "2026-10-19T12:05:00.000Z" },
    ],
    "ana@empresa.com",
    "bia@empresa.com",
  ),
  true,
);
assert.equal(
  contractFullySigned(
    [
      { email: "ana@empresa.com", signed: { created_at: "2026-10-19T12:00:00.000Z" } },
      { email: "bia@empresa.com", signed: "2026-10-19T12:05:00.000Z" },
      { email: "obotmoney@gmail.com", signed: null },
    ],
    "ana@empresa.com",
    "bia@empresa.com",
  ),
  false,
);
assert.equal(
  contractFullySigned(
    [
      { email: "ana@empresa.com", signed: { created_at: "2026-10-19T12:00:00.000Z" } },
      { email: "bia@empresa.com", signed: "2026-10-19T12:05:00.000Z" },
      { email: "obotmoney@gmail.com", signed: "2026-10-19T12:06:00.000Z" },
      { email: "walkup@walkuptec.com.br", signed: null },
    ],
    "ana@empresa.com",
    "bia@empresa.com",
  ),
  false,
);
const finished = autentiqueEvent({
  event: {
    type: "document.finished",
    data: {
      id: "abc123def456",
      signatures: [{ user: { email: "ana@empresa.com" }, signed: "2026-10-19T12:00:00.000Z" }],
    },
  },
});
assert.equal(finished?.type, "document.finished");
assert.equal(finished?.documentId, "abc123def456");
assert.equal(finished?.signatures[0]?.email, "ana@empresa.com");
const official = autentiqueEvent({
  event: {
    type: "document.finished",
    data: {
      object: {
        id: "89c7d2ab31f9f5a13b3d20ecf53319af387e54d240ae7be993",
        name: "Contrato NEX — 9dcc028f-b4b8-4c79-b3cd-851b7d39bec9",
        signatures: [
          { email: "mozart.hotmart@gmail.com", signed: "2026-10-21T18:15:00.000000Z" },
          { email: "walkup@walkuptec.com.br", signed: "2026-10-21T18:16:00.000000Z" },
        ],
      },
    },
  },
});
assert.equal(official?.documentId, "89c7d2ab31f9f5a13b3d20ecf53319af387e54d240ae7be993");
assert.equal(contractContactId(official?.documentName ?? ""), "9dcc028f-b4b8-4c79-b3cd-851b7d39bec9");
assert.equal(official?.signatures[1]?.email, "walkup@walkuptec.com.br");
assert.equal(signatureDone(official?.signatures[1]?.signed), true);
assert.equal(
  autentiqueEvent({
    event: { type: "document.finished", data: { id: "9dcc028f-b4b8-4c79-b3cd-851b7d39bec9" } },
  })?.documentId,
  "9dcc028f-b4b8-4c79-b3cd-851b7d39bec9",
);
assert.equal(autentiqueEvent({ event: { type: "signature.accepted", data: { document: "curto" } } }), null);
assert.equal(contractDispatch("", "missing"), "create");
assert.equal(contractDispatch("signed", "missing"), "create");
assert.equal(contractDispatch("signed", "found"), "replace");
assert.equal(contractDispatch("signed", "unknown"), "consult");
assert.equal(contractDispatch("pending", "found"), "resend");
assert.equal(contractDispatch("pending", "missing"), "create");
assert.equal(contractDispatch("pending", "unknown"), "consult");
assert.equal(contractGone("signature_not_found"), true);
assert.equal(contractGone("without_permission"), false);
assert.equal(contractLookupState({ ok: true, reason: "document_not_found Document not found", documentId: "" }), "missing");
assert.equal(contractLookupState({ ok: false, reason: "signature_not_found", documentId: "abc123def456" }), "missing");
assert.equal(contractLookupState({ ok: true, reason: "Documento não encontrado", documentId: "" }), "missing");
assert.equal(contractLookupState({ ok: true, reason: "", documentId: "" }), "missing");
assert.equal(contractLookupState({ ok: true, reason: "", documentId: "abc123def456" }), "found");
assert.equal(contractLookupState({ ok: false, reason: 'Variable "$id" of type "ID!" used in position expecting type "UUID!".', documentId: "" }), "unknown");

console.log("autentique tests ok");
