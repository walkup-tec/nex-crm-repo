import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { autentiqueEvent, autentiqueSignatureMatches, contractFullySigned } from "@/lib/autentique";

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
  signerName: string;
  clientEmail: string;
  witnessName: string;
  witnessEmail: string;
  pdfBase64: string;
}) {
  const existing = await signatures()
    .select("id, status")
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
  if (existing.data?.status === "pending") throw new Error("O contrato deste contato já está em assinatura.");
  if (existing.data?.status === "signed") throw new Error("O contrato deste contato já foi assinado.");
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
  return { documentId };
}

async function uploadContract(input: {
  signerName: string;
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
      query: "mutation CreateDocumentMutation($document: DocumentInput!, $signers: [SignerInput!]!, $file: Upload!) { createDocument(document: $document, signers: $signers, file: $file) { id } }",
      variables: {
        document: { name: `Contrato NEX — ${input.signerName}` },
        signers: [
          { email: input.clientEmail, name: input.signerName, action: "SIGN" },
          { email: input.witnessEmail, name: input.witnessName, action: "SIGN_AS_A_WITNESS" },
        ],
        file: null,
      },
    }),
  );
  form.append("map", JSON.stringify({ file: ["variables.file"] }));
  form.append("file", new Blob([new Uint8Array(bytes)], { type: "application/pdf" }), "MINUTA NEX.pdf");
  const response = await fetch(autentiqueEndpoint, {
    method: "POST",
    headers: { Authorization: `Bearer ${autentiqueKey()}` },
    body: form,
    signal: AbortSignal.timeout(60000),
  });
  const raw = await response.text();
  let body: { data?: { createDocument?: { id?: string } }; errors?: { message?: string }[] } = {};
  try {
    body = raw ? JSON.parse(raw) : {};
  } catch {
    body = {};
  }
  const documentId = body.data?.createDocument?.id ?? "";
  if (!response.ok || !documentId) {
    console.error("autentique_create", response.status);
    throw new Error("A Autentique não concluiu o envio do contrato.");
  }
  return documentId;
}

async function documentSignatures(documentId: string) {
  const response = await fetch(autentiqueEndpoint, {
    method: "POST",
    headers: { Authorization: `Bearer ${autentiqueKey()}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      query: "query ($id: ID!) { document(id: $id) { signatures { email signed { created_at } } } }",
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
