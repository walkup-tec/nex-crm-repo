import { createServerFn } from "@tanstack/react-start";

type Result<T> = { ok: true; data: T } | { ok: false; message: string };

function publicMessage(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : "";
  if (
    message.startsWith("Informe") ||
    message.startsWith("Envie") ||
    message.startsWith("Esse formato") ||
    message.startsWith("O arquivo") ||
    message.startsWith("CEP") ||
    message.startsWith("CNPJ") ||
    message.startsWith("A consulta") ||
    message.startsWith("Não foi possível") ||
    message === "Este link de contratação não está disponível." ||
    message === "A migração da contratação ainda não foi aplicada no Supabase."
  ) {
    return message;
  }
  console.error("contracting", message);
  return fallback;
}

async function guard<T>(work: () => Promise<T>, fallback: string): Promise<Result<T>> {
  try {
    return { ok: true, data: await work() };
  } catch (error) {
    return { ok: false, message: publicMessage(error, fallback) };
  }
}

export const contractingContactFn = createServerFn({ method: "POST" })
  .validator((data: { contactId: string }) => data)
  .handler(async ({ data }): Promise<Result<{ name: string }>> => {
    const { contractingContact } = await import("@/server/contracting.server");
    const found = await contractingContact(data.contactId);
    if (!found.ok) return found;
    return { ok: true, data: { name: found.name } };
  });

export const contractingAddressFn = createServerFn({ method: "POST" })
  .validator((data: { postalCode: string }) => data)
  .handler(async ({ data }) => {
    const { lookupPostalCode } = await import("@/server/contracting.server");
    return guard(() => lookupPostalCode(data.postalCode), "Não foi possível consultar o CEP.");
  });

export const contractingCompanyFn = createServerFn({ method: "POST" })
  .validator((data: { cnpj: string }) => data)
  .handler(async ({ data }) => {
    const { lookupContractingCompany } = await import("@/server/contracting.server");
    return guard(() => lookupContractingCompany(data.cnpj), "Não foi possível consultar o CNPJ.");
  });
