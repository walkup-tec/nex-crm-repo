import { createHmac, timingSafeEqual } from "node:crypto";

export function contractDocumentName(contactId: string) {
  return `Contrato NEX — ${contactId.trim()}`;
}

export const contractCompanyWitnessEmail = "obotmoney@gmail.com";
export const contractOwnerEmail = "walkup@walkuptec.com.br";

export function contractSignedMessage(name: string) {
  const clean = name.trim().replace(/\s+/g, " ") || "cliente";
  return `Oi ${clean}! identificamos a assinatura do seu contrato. Por favor, me informe se já recebeu as instruções para acesso da plataforma NEX?`;
}

export function signatureDone(signed: unknown) {
  if (!signed) return false;
  if (typeof signed === "string") return signed.trim().length > 0;
  if (typeof signed === "object" && "created_at" in signed) return Boolean((signed as { created_at?: unknown }).created_at);
  return false;
}

export function contractFullySigned(
  signatures: { email: string; signed: unknown }[],
  clientEmail: string,
  witnessEmail: string,
) {
  const client = clientEmail.trim().toLowerCase();
  const witness = witnessEmail.trim().toLowerCase();
  const company = contractCompanyWitnessEmail.trim().toLowerCase();
  const owner = contractOwnerEmail.trim().toLowerCase();
  if (!client || !witness) return false;
  const present = new Set(signatures.map((item) => item.email.trim().toLowerCase()));
  const required = [client, witness];
  for (const email of [owner, company]) {
    if (email && email !== client && email !== witness && present.has(email) && !required.includes(email)) required.push(email);
  }
  const done = (email: string) => signatures.some((item) => item.email.trim().toLowerCase() === email && signatureDone(item.signed));
  return required.every(done);
}

export function autentiqueSignatureMatches(secret: string, rawBody: string, header: string) {
  const provided = header.trim();
  if (!secret || !provided) return false;
  const calculated = createHmac("sha256", secret).update(rawBody).digest("hex");
  const left = Buffer.from(calculated);
  const right = Buffer.from(provided);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export type RemoteContract = "missing" | "found" | "unknown";

export function contractDispatch(status: string, remote: RemoteContract) {
  if (status === "signed") {
    if (remote === "missing") return "create" as const;
    if (remote === "unknown") return "consult" as const;
    return "replace" as const;
  }
  if (status !== "pending") return "create" as const;
  if (remote === "found") return "resend" as const;
  if (remote === "missing") return "create" as const;
  return "consult" as const;
}

export function contractGone(reason: string) {
  return /document_not_found|signature_not_found|not[_\s]found|não encontrado|nao encontrado/i.test(reason);
}

export function contractLookupState(input: { ok: boolean; reason: string; documentId: string }): RemoteContract {
  if (contractGone(input.reason)) return "missing";
  if (input.documentId.trim()) return "found";
  if (input.ok && !input.reason.trim()) return "missing";
  return "unknown";
}

export function contractContactId(documentName: string) {
  const match = documentName.match(/Contrato NEX — ([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
  return match?.[1] ?? "";
}

export function autentiqueUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.trim());
}

export function autentiqueDocumentId(value: string) {
  const id = value.trim();
  return autentiqueUuid(id) || /^[A-Za-z0-9]{8,128}$/.test(id);
}

export function autentiqueEvent(body: unknown) {
  const event = nestedEvent(body);
  if (!event) return null;
  const type = event.type;
  if (typeof type !== "string") return null;
  const data = record(event.data);
  if (!data) return null;
  const object = record(data.object);
  const documentId = [data.document, data.id, object?.id, object?.document].find((item) => typeof item === "string" && autentiqueDocumentId(item));
  if (typeof documentId !== "string") return null;
  const documentName = typeof object?.name === "string" ? object.name : typeof data.name === "string" ? data.name : "";
  const source = Array.isArray(object?.signatures) ? object.signatures : Array.isArray(data.signatures) ? data.signatures : [];
  const signatures = source.flatMap((item) => {
    const row = record(item);
    if (!row) return [];
    const user = record(row.user);
    const email = typeof row.email === "string" ? row.email : user && typeof user.email === "string" ? user.email : "";
    return email.trim() ? [{ email, signed: row.signed }] : [];
  });
  return { type, documentId, documentName, signatures };
}

function record(value: unknown) {
  return value && typeof value === "object" ? value as Record<string, unknown> : null;
}

function nestedEvent(body: unknown) {
  const root = record(body);
  if (!root) return null;
  const nested = record(root.event);
  if (nested && typeof nested.type === "string") return nested;
  return typeof root.type === "string" ? root : null;
}
