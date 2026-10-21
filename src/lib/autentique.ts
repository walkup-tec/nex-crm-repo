import { createHmac, timingSafeEqual } from "node:crypto";

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
  if (!client || !witness) return false;
  const done = (email: string) => signatures.some((item) => item.email.trim().toLowerCase() === email && signatureDone(item.signed));
  return done(client) && done(witness);
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
  if (status === "signed") return "signed" as const;
  if (status !== "pending") return "create" as const;
  if (remote === "found") return "resend" as const;
  if (remote === "missing") return "create" as const;
  return "consult" as const;
}

export function autentiqueEvent(body: unknown) {
  if (!body || typeof body !== "object") return null;
  const event = (body as { event?: unknown }).event;
  if (!event || typeof event !== "object") return null;
  const type = (event as { type?: unknown }).type;
  const data = (event as { data?: unknown }).data;
  if (typeof type !== "string" || !data || typeof data !== "object") return null;
  const record = data as Record<string, unknown>;
  const documentId = type.startsWith("signature.") ? record.document : record.id;
  if (typeof documentId !== "string" || !/^[A-Za-z0-9]{8,128}$/.test(documentId)) return null;
  const signatures = Array.isArray(record.signatures)
    ? record.signatures.flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const email = (item as { user?: { email?: unknown }; email?: unknown }).user?.email ?? (item as { email?: unknown }).email;
        if (typeof email !== "string") return [];
        return [{ email, signed: (item as { signed?: unknown }).signed }];
      })
    : [];
  return { type, documentId, signatures };
}
