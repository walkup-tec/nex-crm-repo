import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { autentiqueEvent, autentiqueSignatureMatches, contractDispatch, contractDocumentName, contractFullySigned, contractLookupState } from "@/lib/autentique";

const autentiqueEndpoint = "https://api.autentique.com.br/v2/graphql";

type DbResult = { data: Record<string, unknown> | null; error: { message: string } | null };
type Chain = {
  eq: (column: string, value: string) => Chain;
  is: (column: string, value: null) => Chain;
  order: (column: string, options: { ascending: boolean }) => Chain;
  limit: (count: number) => Chain;
  select: (columns: string) => Chain;
  maybeSingle: () => Promise<DbResult>;
};

function signatures() {
  return (supabaseAdmin as unknown as {
    from: (table: string) => {
      select: (columns: string) => Chain;
      insert: (values: Record<string, unknown>) => Chain;
      update: (values: Record<string, unknown>) => Chain;
      delete: () => { eq: (column: string, value: string) => Promise<{ error: { message: string } | null }> };
    };
  }).from("contract_signatures");
}

function autentiqueKey() {
  const key = process.env.AUTENTIQUE_API_KEY?.trim() ?? "";
  if (!key) throw new Error("A assinatura do contrato ainda não está configurada.");
  return key;
}

function cell(row: Record<string, unknown> | null | undefined, key: string) {
  const value = row?.[key];
  return value == null ? "" : String(value);
}

export async function createContractSignature(input: {
  organizationId: string;
  contactId: string;
  clientName: string;
  clientEmail: string;
  witnessName: string;
  witnessEmail: string;
  pdfBase64: string;
}) {
  const existing = await signatures()
    .select("id, status, autentique_document_id")
    .eq("organization_id", input.organizationId)
    .eq("contact_id", input.contactId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing.error) {
    if (/contract_signatures|schema cache|does not exist|PGRST205/i.test(existing.error.message)) {
      throw new Error("A migração da assinatura ainda não foi aplicada no Supabase.");
    }
    throw new Error("Não foi possível consultar a assinatura do contrato.");
  }
  const status = cell(existing.data, "status");
  const documentIdOnFile = cell(existing.data, "autentique_document_id");
  if (status === "signed") throw new Error("O contrato deste contato já foi assinado.");
  if (status === "pending") {
    const remote = await findContract(documentIdOnFile);
    const action = contractDispatch(status, remote.state);
    if (action === "consult") throw new Error(remote.reason ? `Não foi possível consultar o contrato na Autentique. ${remote.reason}` : "Não foi possível consultar o contrato na Autentique.");
    if (action === "resend") await deleteContract(documentIdOnFile);
    await removeSignature(cell(existing.data, "id"));
  }
  const documentId = await uploadContract(input);
  const saved = await signatures().insert({
    organization_id: input.organizationId,
    contact_id: input.contactId,
    autentique_document_id: documentId,
    client_name: input.clientName,
    client_email: input.clientEmail,
    witness_name: input.witnessName,
    witness_email: input.witnessEmail,
    status: "pending",
  }).select("id").maybeSingle();
  if (saved.error || !saved.data) throw new Error("O contrato foi enviado, mas o acompanhamento da assinatura não foi gravado.");
  return { documentId, resent: false };
}

async function uploadContract(input: {
  contactId: string;
  clientEmail: string;
  witnessName: string;
  witnessEmail: string;
  pdfBase64: string;
}) {
  const bytes = Buffer.from(input.pdfBase64, "base64");
  const form = new FormData();
  form.append(
    "operations",
    JSON.stringify({
      query: "mutation CreateDocumentMutation($document: DocumentInput!, $signers: [SignerInput!]!, $file: Upload!) { createDocument(document: $document, signers: $signers, file: $file) { id signatures { email } } }",
      variables: {
        document: { name: contractDocumentName(input.contactId) },
        signers: [
          { email: input.clientEmail, action: "SIGN" },
          { email: input.witnessEmail, action: "SIGN_AS_A_WITNESS" },
        ],
        file: null,
      },
    }),
  );
  form.append("map", JSON.stringify({ file: ["variables.file"] }));
  form.append("file", new Blob([new Uint8Array(bytes)], { type: "application/pdf" }), "MINUTA NEX.pdf");
  let response: Response;
  try {
    response = await fetch(autentiqueEndpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${autentiqueKey()}` },
      body: form,
      signal: AbortSignal.timeout(60000),
    });
  } catch {
    throw new Error("A Autentique não concluiu o envio do contrato.");
  }
  const raw = await response.text();
  let body: AutentiqueBody = {};
  try {
    body = raw ? JSON.parse(raw) : {};
  } catch {
    body = {};
  }
  const documentId = body.data?.createDocument?.id ?? "";
  const reason = autentiqueReason(body);
  const signatures = body.data?.createDocument?.signatures;
  const linked = new Set(
    (signatures ?? []).flatMap((item) => (typeof item.email === "string" && item.email.trim() ? [item.email.trim().toLowerCase()] : [])),
  );
  if (!response.ok || !documentId || !Array.isArray(signatures) || !linked.has(input.clientEmail) || !linked.has(input.witnessEmail)) {
    console.error("autentique_create", response.status, reason);
    if (documentId && Array.isArray(signatures)) throw new Error("A Autentique não vinculou os e-mails do representante e da testemunha.");
    throw new Error(reason ? `A Autentique não concluiu o envio do contrato. ${reason}` : "A Autentique não concluiu o envio do contrato.");
  }
  return documentId;
}

type AutentiqueBody = {
  data?: {
    document?: { id?: string; signatures?: { public_id?: string }[] } | null;
    createDocument?: { id?: string; signatures?: { email?: string }[] };
    deleteDocument?: boolean;
  };
  errors?: { message?: string; extensions?: { code?: string } }[];
};

function autentiqueReason(body: AutentiqueBody) {
  return (body.errors ?? [])
    .map((item) => `${item.extensions?.code ?? ""} ${item.message ?? ""}`)
    .join(" ")
    .replace(/bearer\s+\S+/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
}

async function autentiqueGraphql(query: string, variables: Record<string, unknown>) {
  try {
    const response = await fetch(autentiqueEndpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${autentiqueKey()}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(20000),
    });
    const raw = await response.text();
    let body: AutentiqueBody = {};
    try {
      body = raw ? JSON.parse(raw) as AutentiqueBody : {};
    } catch {
      body = {};
    }
    return { ok: response.ok, body };
  } catch {
    return { ok: false, body: {} };
  }
}

async function findContract(documentId: string) {
  if (!documentId.trim()) return { state: "missing" as const, signerIds: [] as string[], reason: "" };
  const result = await autentiqueGraphql(
    "query ($id: UUID!) { document(id: $id) { id signatures { public_id } } }",
    { id: documentId },
  );
  const reason = autentiqueReason(result.body);
  const document = result.body.data?.document;
  const state = contractLookupState({ ok: result.ok, reason, documentId: document?.id ?? "" });
  if (state !== "found") return { state, signerIds: [] as string[], reason };
  const signerIds = (document?.signatures ?? []).flatMap((item) => (typeof item.public_id === "string" && item.public_id.trim() ? [item.public_id] : []));
  return { state, signerIds, reason };
}

async function deleteContract(documentId: string) {
  const result = await autentiqueGraphql(
    "mutation ($id: UUID!) { deleteDocument(id: $id) }",
    { id: documentId },
  );
  const reason = autentiqueReason(result.body);
  if (!result.ok || result.body.data?.deleteDocument !== true) {
    throw new Error(reason ? `A Autentique não excluiu o contrato anterior. ${reason}` : "A Autentique não excluiu o contrato anterior.");
  }
}

async function removeSignature(id: string) {
  const removed = await signatures().delete().eq("id", id);
  if (removed.error) throw new Error("Não foi possível liberar o contrato deste contato para um novo envio.");
}

async function documentSignatures(documentId: string) {
  const response = await fetch(autentiqueEndpoint, {
    method: "POST",
    headers: { Authorization: `Bearer ${autentiqueKey()}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      query: "query ($id: UUID!) { document(id: $id) { signatures { email signed { created_at } } } }",
      variables: { id: documentId },
    }),
    signal: AbortSignal.timeout(20000),
  });
  const raw = await response.text();
  let body: { data?: { document?: { signatures?: { email?: string; signed?: unknown }[] } } } = {};
  try {
    body = raw ? JSON.parse(raw) : {};
  } catch {
    body = {};
  }
  return (body.data?.document?.signatures ?? []).flatMap((item) =>
    typeof item.email === "string" ? [{ email: item.email, signed: item.signed }] : [],
  );
}

export async function applyAutentiqueWebhook(rawBody: string, signatureHeader: string) {
  const secret = process.env.AUTENTIQUE_WEBHOOK_SECRET?.trim() ?? "";
  if (secret && !autentiqueSignatureMatches(secret, rawBody, signatureHeader)) return;
  let parsed: unknown = null;
  try {
    parsed = rawBody ? JSON.parse(rawBody) : null;
  } catch {
    return;
  }
  const event = autentiqueEvent(parsed);
  if (!event || (event.type !== "document.finished" && event.type !== "signature.accepted")) return;
  const found = await signatures()
    .select("id, organization_id, contact_id, client_name, client_email, witness_email, status, notified_at")
    .eq("autentique_document_id", event.documentId)
    .maybeSingle();
  if (found.error || !found.data || found.data.notified_at) return;
  const listed = event.signatures.length ? event.signatures : await documentSignatures(event.documentId);
  const ready = listed.length
    ? contractFullySigned(listed, cell(found.data, "client_email"), cell(found.data, "witness_email"))
    : event.type === "document.finished";
  if (!ready) return;
  const claimed = await signatures()
    .update({ status: "signed", notified_at: new Date().toISOString() })
    .eq("id", cell(found.data, "id"))
    .is("notified_at", null)
    .select("id")
    .maybeSingle();
  if (claimed.error || !claimed.data) return;
  try {
    const { sendContractSignedWhatsApp } = await import("@/server/chatbot.server");
    await sendContractSignedWhatsApp({
      organizationId: cell(found.data, "organization_id"),
      contactId: cell(found.data, "contact_id"),
      name: cell(found.data, "client_name"),
    });
  } catch (error) {
    await signatures().update({ status: "pending", notified_at: null }).eq("id", cell(found.data, "id")).select("id").maybeSingle();
    throw error;
  }
}
