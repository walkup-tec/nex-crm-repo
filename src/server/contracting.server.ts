import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { chatbotMediaBucket, chatbotMediaMimeTypes } from "@/lib/chatbot-media";
import {
  contractingContentType,
  contractingFileKinds,
  contractingFileLabels,
  contractingFileProblem,
  contractingProblem,
  contractingSummary,
  cnpjMask,
  cpfMask,
  isContractingContactId,
  type ContractingFileKind,
  type ContractingInput,
} from "@/lib/contracting";
import { keepsAccessWithoutPayment } from "@/lib/finance-access";
import { lookupCnpj } from "@/server/cnpj.server";

const unavailable = "Este link de contratação não está disponível.";

type DbError = { message: string; code?: string };

type Query = {
  select: (columns?: string) => Query;
  insert: (value: Record<string, unknown> | Record<string, unknown>[]) => Query;
  update: (value: Record<string, unknown>) => Query;
  delete: () => Query;
  eq: (column: string, value: string) => Query;
  order: (column: string, options: { ascending: boolean }) => Query;
  limit: (count: number) => Query;
  maybeSingle: () => Promise<{ data: Record<string, unknown> | null; error: DbError | null }>;
};

function table(name: string) {
  return (supabaseAdmin as unknown as { from: (table: string) => Query }).from(name);
}

function cell(row: Record<string, unknown> | null | undefined, key: string) {
  const value = row?.[key];
  return value == null ? "" : String(value);
}

function fail(message: string): never {
  throw new Error(message);
}

function schemaMessage(message: string) {
  if (/representative_document/i.test(message)) {
    return "A migração do CPF do representante ainda não foi aplicada no Supabase.";
  }
  if (/contracting_intakes|contracting_intake_files/i.test(message)) {
    return "A migração da contratação ainda não foi aplicada no Supabase.";
  }
  return "Não foi possível receber a contratação.";
}

function duplicate(error: DbError | null) {
  return Boolean(error && (error.code === "23505" || /duplicate key/i.test(error.message)));
}

async function ensureDocumentBucket() {
  const options = { public: false, fileSizeLimit: 40 * 1024 * 1024, allowedMimeTypes: chatbotMediaMimeTypes };
  const existing = await supabaseAdmin.storage.getBucket(chatbotMediaBucket);
  if (!existing.error && existing.data) {
    await supabaseAdmin.storage.updateBucket(chatbotMediaBucket, options).catch(() => undefined);
    return;
  }
  const created = await supabaseAdmin.storage.createBucket(chatbotMediaBucket, options);
  if (created.error && !/already exists|duplicate/i.test(created.error.message)) fail("Não foi possível guardar os documentos.");
}

async function mmsOrganizationId() {
  const listed = await (table("organizations").select("id, legal_name") as unknown as Promise<{
    data: Record<string, unknown>[] | null;
    error: DbError | null;
  }>);
  if (listed.error) fail(schemaMessage(listed.error.message));
  const match = (listed.data ?? []).find((row) => keepsAccessWithoutPayment(cell(row, "legal_name")));
  return cell(match, "id");
}

export async function contractingContact(contactId: string) {
  try {
    if (!isContractingContactId(contactId)) return { ok: false as const, message: unavailable };
    const organizationId = await mmsOrganizationId();
    if (!organizationId) return { ok: false as const, message: unavailable };
    const contact = await table("chatbot_contacts").select("id, name, organization_id").eq("id", contactId).maybeSingle();
    if (contact.error || !contact.data || cell(contact.data, "organization_id") !== organizationId) return { ok: false as const, message: unavailable };
    const name = cell(contact.data, "name").trim();
    return { ok: true as const, name: name || "Cliente" };
  } catch {
    return { ok: false as const, message: unavailable };
  }
}

export async function lookupPostalCode(postalCode: string) {
  const cep = postalCode.replace(/\D/g, "");
  if (cep.length !== 8) fail("Informe um CEP válido.");
  const via = await fetch(`https://viacep.com.br/ws/${cep}/json/`, { signal: AbortSignal.timeout(8000) }).catch(() => null);
  if (via?.ok) {
    const body = (await via.json()) as { erro?: boolean; logradouro?: string; bairro?: string; localidade?: string; uf?: string };
    if (!body.erro && body.localidade && body.uf) {
      return {
        street: body.logradouro?.trim() ?? "",
        district: body.bairro?.trim() ?? "",
        city: body.localidade.trim(),
        state: body.uf.trim().toUpperCase(),
      };
    }
  }
  const brasil = await fetch(`https://brasilapi.com.br/api/cep/v2/${cep}`, {
    headers: { Accept: "application/json", "User-Agent": "NEX-Ads/1.0 (https://app.nexmeta.com.br)" },
    signal: AbortSignal.timeout(8000),
  }).catch(() => null);
  if (brasil?.ok) {
    const body = (await brasil.json()) as { street?: string; neighborhood?: string; city?: string; state?: string };
    if (body.city && body.state) {
      return {
        street: body.street?.trim() ?? "",
        district: body.neighborhood?.trim() ?? "",
        city: body.city.trim(),
        state: body.state.trim().toUpperCase(),
      };
    }
  }
  fail("CEP não encontrado. Informe o endereço.");
}

function textField(form: FormData, key: string) {
  const value = form.get(key);
  return typeof value === "string" ? value : "";
}

async function readUpload(form: FormData, kind: ContractingFileKind) {
  const value = form.get(kind);
  if (!(value instanceof File)) fail(`Envie o arquivo: ${contractingFileLabels[kind]}.`);
  const problem = contractingFileProblem({ name: value.name, size: value.size });
  if (problem) fail(`${contractingFileLabels[kind]}: ${problem}`);
  const bytes = new Uint8Array(await value.arrayBuffer());
  if (!bytes.byteLength) fail(`${contractingFileLabels[kind]}: Envie um arquivo.`);
  const extension = value.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8) || "bin";
  return { kind, name: value.name, bytes, extension, contentType: contractingContentType(value.name) };
}

function protocolCode() {
  const value = crypto.getRandomValues(new Uint32Array(1))[0] ?? 0;
  return String(100000 + (value % 900000));
}

async function removeStored(paths: string[]) {
  if (!paths.length) return;
  await supabaseAdmin.storage.from(chatbotMediaBucket).remove(paths);
}

export async function saveContracting(form: FormData) {
  const contactId = textField(form, "contato");
  const contact = await contractingContact(contactId);
  if (!contact.ok) fail(contact.message);
  const input: ContractingInput = {
    cnpj: textField(form, "cnpj"),
    legalName: textField(form, "legalName"),
    postalCode: textField(form, "postalCode"),
    street: textField(form, "street"),
    addressNumber: textField(form, "addressNumber"),
    complement: textField(form, "complement"),
    district: textField(form, "district"),
    city: textField(form, "city"),
    state: textField(form, "state"),
    representativeName: textField(form, "representativeName"),
    representativeDocument: textField(form, "representativeDocument"),
    representativeEmail: textField(form, "representativeEmail"),
    witnessName: textField(form, "witnessName"),
    witnessDocument: textField(form, "witnessDocument"),
    witnessEmail: textField(form, "witnessEmail"),
  };
  const problem = contractingProblem(input);
  if (problem) fail(problem);
  const uploads = [];
  for (const kind of contractingFileKinds) uploads.push(await readUpload(form, kind));
  const organizationId = await mmsOrganizationId();
  if (!organizationId) fail(unavailable);
  const stored = {
    cnpj: input.cnpj.replace(/\D/g, ""),
    legal_name: input.legalName.trim(),
    postal_code: input.postalCode.replace(/\D/g, ""),
    street: input.street.trim(),
    address_number: input.addressNumber.trim(),
    address_complement: input.complement.trim(),
    district: input.district.trim(),
    city: input.city.trim(),
    state: input.state.trim().toUpperCase(),
    representative_name: input.representativeName.trim(),
    representative_document: input.representativeDocument.replace(/\D/g, ""),
    representative_email: input.representativeEmail.trim().toLowerCase(),
    witness_name: input.witnessName.trim(),
    witness_document: input.witnessDocument.replace(/\D/g, ""),
    witness_email: input.witnessEmail.trim().toLowerCase(),
  };
  let intakeId = "";
  let protocol = "";
  for (let attempt = 0; attempt < 8; attempt += 1) {
    protocol = protocolCode();
    const inserted = await table("contracting_intakes")
      .insert({
        protocol,
        organization_id: organizationId,
        contact_id: contactId,
        ...stored,
      })
      .select("id, protocol")
      .maybeSingle();
    if (inserted.data) {
      intakeId = cell(inserted.data, "id");
      protocol = cell(inserted.data, "protocol");
      break;
    }
    if (!duplicate(inserted.error)) fail(schemaMessage(inserted.error?.message ?? ""));
  }
  if (!intakeId) fail("Não foi possível registrar a contratação.");
  await ensureDocumentBucket();
  const storedPaths: string[] = [];
  const storedFileIds: string[] = [];
  try {
    for (const upload of uploads) {
      const id = crypto.randomUUID();
      const storagePath = `${organizationId}/${contactId}/${id}.${upload.extension}`;
      const uploaded = await supabaseAdmin.storage.from(chatbotMediaBucket).upload(storagePath, Buffer.from(upload.bytes), {
        contentType: upload.contentType,
        upsert: false,
      });
      if (uploaded.error) fail("Não foi possível guardar os documentos.");
      storedPaths.push(storagePath);
      const fileName = `${contractingFileLabels[upload.kind]} ${protocol}.${upload.extension}`;
      const media = await table("chatbot_contact_files")
        .insert({
          id,
          organization_id: organizationId,
          contact_id: contactId,
          name: fileName,
          mime_type: upload.contentType,
          storage_path: storagePath,
        })
        .select("id")
        .maybeSingle();
      if (media.error) fail(schemaMessage(media.error.message));
      storedFileIds.push(id);
      const recorded = await table("contracting_intake_files")
        .insert({
          intake_id: intakeId,
          kind: upload.kind,
          file_name: fileName,
          content_type: upload.contentType,
          storage_path: storagePath,
        })
        .select("id")
        .maybeSingle();
      if (recorded.error) fail(schemaMessage(recorded.error.message));
    }
  } catch (error) {
    await removeStored(storedPaths);
    for (const id of storedFileIds) {
      await (table("chatbot_contact_files").delete().eq("id", id) as unknown as Promise<unknown>).catch(() => undefined);
    }
    await (table("contracting_intakes").delete().eq("id", intakeId) as unknown as Promise<unknown>).catch(() => undefined);
    throw error;
  }
  try {
    const conversation = await table("chatbot_conversations")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("contact_id", contactId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const conversationId = cell(conversation.data, "id");
    if (conversationId) {
      const note = contractingSummary({ ...input, contactName: contact.name, protocol });
      await table("chatbot_messages")
        .insert({
          organization_id: organizationId,
          conversation_id: conversationId,
          text: note,
          direction: "out",
          status: "sent",
          internal: true,
        })
        .select("id")
        .maybeSingle();
      await (table("chatbot_conversations").update({ updated_at: new Date().toISOString() }).eq("id", conversationId) as unknown as Promise<unknown>);
    }
  } catch (error) {
    console.error("contracting_note", error instanceof Error ? error.message : "falha");
  }
  return { id: intakeId, protocol, name: contact.name, cnpj: cnpjMask(stored.cnpj), witnessDocument: cpfMask(stored.witness_document) };
}

export async function lookupContractingCompany(document: string) {
  return lookupCnpj(document);
}
