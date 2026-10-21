import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { autentiqueEvent, autentiqueSignatureMatches, contractCompanyWitnessEmail, contractContactId, contractDispatch, contractDocumentName, contractFullySigned, contractGone, contractLookupState, contractOwnerEmail } from "@/lib/autentique";

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
    .select("id, status, autentique_document_id, client_name, client_email, witness_email")
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
  if (status === "signed" || status === "pending") {
    const remote = await findContract(documentIdOnFile);
    const action = contractDispatch(status, remote.state);
    if (action === "consult") throw new Error(remote.reason ? `Não foi possível consultar o contrato na Autentique. ${remote.reason}` : "Não foi possível consultar o contrato na Autentique.");
    if (action === "replace") await deleteContract(documentIdOnFile);
    if (action === "resend") {
      const listed = await documentSignatures(documentIdOnFile);
      if (contractFullySigned(listed, cell(existing.data, "client_email"), cell(existing.data, "witness_email"))) {
        await confirmSignedContract({
          id: cell(existing.data, "id"),
          organizationId: input.organizationId,
          contactId: input.contactId,
          name: cell(existing.data, "client_name"),
        });
        throw new Error("O contrato deste contato já foi assinado.");
      }
      await deleteContract(documentIdOnFile);
    }
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

function contractSigners(clientEmail: string, witnessEmail: string) {
  const signers: { email: string; action: string }[] = [];
  const add = (email: string, action: string) => {
    const clean = email.trim().toLowerCase();
    if (!clean || signers.some((item) => item.email === clean)) return;
    signers.push({ email: clean, action });
  };
  add(clientEmail, "SIGN");
  add(contractOwnerEmail, "SIGN");
  add(witnessEmail, "SIGN_AS_A_WITNESS");
  add(contractCompanyWitnessEmail, "SIGN_AS_A_WITNESS");
  return signers;
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
        signers: contractSigners(input.clientEmail, input.witnessEmail),
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
  if (!response.ok || !documentId || !Array.isArray(signatures) || contractSigners(input.clientEmail, input.witnessEmail).some((signer) => !linked.has(signer.email))) {
    console.error("autentique_create", response.status, reason);
    if (documentId && Array.isArray(signatures)) throw new Error("A Autentique não vinculou os e-mails do representante e das testemunhas.");
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
  if (result.body.data?.deleteDocument === true) return;
  const reason = autentiqueReason(result.body);
  if (contractGone(reason)) return;
  throw new Error(reason ? `A Autentique não excluiu o contrato anterior. ${reason}` : "A Autentique não excluiu o contrato anterior.");
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
      query: "query ($id: UUID!) { document(id: $id) { signatures { email user { email } signed { created_at } } } }",
      variables: { id: documentId },
    }),
    signal: AbortSignal.timeout(20000),
  });
  const raw = await response.text();
  let body: { data?: { document?: { signatures?: { email?: string; user?: { email?: string }; signed?: unknown }[] } } } = {};
  try {
    body = raw ? JSON.parse(raw) : {};
  } catch {
    body = {};
  }
  return (body.data?.document?.signatures ?? []).flatMap((item) => {
    const email = typeof item.email === "string" && item.email.trim() ? item.email : item.user?.email;
    return typeof email === "string" && email.trim() ? [{ email, signed: item.signed }] : [];
  });
}

async function confirmSignedContract(input: { id: string; organizationId: string; contactId: string; name: string }) {
  const claimed = await signatures()
    .update({ status: "signed", notified_at: new Date().toISOString() })
    .eq("id", input.id)
    .is("notified_at", null)
    .select("id")
    .maybeSingle();
  if (claimed.error || !claimed.data) return;
  try {
    const { sendContractSignedWhatsApp } = await import("@/server/chatbot.server");
    await sendContractSignedWhatsApp({
      organizationId: input.organizationId,
      contactId: input.contactId,
      name: input.name,
    });
  } catch (error) {
    console.error("contract_signed_notice", error instanceof Error ? error.message : "fail");
  }
}

export async function syncContractSignature(organizationId: string, contactId: string) {
  const existing = await signatures()
    .select("id, status, autentique_document_id, client_name, client_email, witness_email, notified_at")
    .eq("organization_id", organizationId)
    .eq("contact_id", contactId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing.error || !existing.data || cell(existing.data, "notified_at")) return cell(existing.data, "status") === "signed";
  if (cell(existing.data, "status") !== "pending") return false;
  const listed = await documentSignatures(cell(existing.data, "autentique_document_id"));
  if (!contractFullySigned(listed, cell(existing.data, "client_email"), cell(existing.data, "witness_email"))) return false;
  await confirmSignedContract({
    id: cell(existing.data, "id"),
    organizationId,
    contactId,
    name: cell(existing.data, "client_name"),
  });
  return true;
}

async function pendingContracts() {
  const result = await (supabaseAdmin as unknown as {
    from: (table: string) => {
      select: (columns: string) => {
        eq: (column: string, value: string) => {
          is: (column: string, value: null) => {
            order: (column: string, options: { ascending: boolean }) => {
              limit: (count: number) => Promise<{ data: Record<string, unknown>[] | null; error: { message: string } | null }>;
            };
          };
        };
      };
    };
  }).from("contract_signatures")
    .select("id, organization_id, contact_id, autentique_document_id, client_name, client_email, witness_email")
    .eq("status", "pending")
    .is("notified_at", null)
    .order("created_at", { ascending: false })
    .limit(8);
  if (result.error || !result.data) return [];
  return result.data;
}

async function confirmReadyContract(row: Record<string, unknown>) {
  const listed = await documentSignatures(cell(row, "autentique_document_id"));
  if (!contractFullySigned(listed, cell(row, "client_email"), cell(row, "witness_email"))) return false;
  await confirmSignedContract({
    id: cell(row, "id"),
    organizationId: cell(row, "organization_id"),
    contactId: cell(row, "contact_id"),
    name: cell(row, "client_name"),
  });
  return true;
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
  const columns = "id, organization_id, contact_id, autentique_document_id, client_name, client_email, witness_email, status, notified_at";
  let found = await signatures().select(columns).eq("autentique_document_id", event.documentId).maybeSingle();
  if ((found.error || !found.data) && contractContactId(event.documentName)) {
    found = await signatures()
      .select(columns)
      .eq("contact_id", contractContactId(event.documentName))
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
  }
  if (found.data && !found.data.notified_at) {
    const clientEmail = cell(found.data, "client_email");
    const witnessEmail = cell(found.data, "witness_email");
    const ready = event.signatures.length > 0 && contractFullySigned(event.signatures, clientEmail, witnessEmail);
    if (ready) {
      await confirmSignedContract({
        id: cell(found.data, "id"),
        organizationId: cell(found.data, "organization_id"),
        contactId: cell(found.data, "contact_id"),
        name: cell(found.data, "client_name"),
      });
      return;
    }
    if (await confirmReadyContract(found.data)) return;
  }
  for (const row of await pendingContracts()) {
    if (await confirmReadyContract(row)) return;
  }
}
