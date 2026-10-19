import { applyMask } from "@/lib/masks";

export const contractingFileKinds = [
  "cnpj_card",
  "social_contract",
  "representative_document",
  "address_proof",
] as const;

export type ContractingFileKind = (typeof contractingFileKinds)[number];

export const contractingFileLabels: Record<ContractingFileKind, string> = {
  cnpj_card: "Cartão de CNPJ",
  social_contract: "Contrato social",
  representative_document: "Documento do sócio representante legal",
  address_proof: "Comprovante de endereço da empresa",
};

const blockedExtensions = new Set([
  "exe",
  "bat",
  "cmd",
  "com",
  "msi",
  "js",
  "mjs",
  "html",
  "htm",
  "svg",
  "php",
  "sh",
  "ps1",
  "dll",
  "scr",
]);

export const contractingFileLimitBytes = 15 * 1024 * 1024;

export type ContractingInput = {
  cnpj: string;
  legalName: string;
  postalCode: string;
  street: string;
  addressNumber: string;
  complement: string;
  district: string;
  city: string;
  state: string;
  representativeName: string;
  representativeEmail: string;
  witnessName: string;
  witnessDocument: string;
  witnessEmail: string;
};

export function cepMask(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

export function cnpjMask(value: string) {
  return applyMask("doc", value.replace(/\D/g, "").slice(0, 14));
}

export function cpfMask(value: string) {
  return applyMask("doc", value.replace(/\D/g, "").slice(0, 11));
}

export function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function isValidCpf(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 11 || /^(\d)\1+$/.test(digits)) return false;
  const first = checkDigit(digits, [10, 9, 8, 7, 6, 5, 4, 3, 2]);
  const second = checkDigit(digits, [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]);
  return digits.endsWith(`${first}${second}`);
}

export function isValidCnpj(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 14 || /^(\d)\1+$/.test(digits)) return false;
  const first = checkDigit(digits, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const second = checkDigit(digits, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return digits.endsWith(`${first}${second}`);
}

export function contractingFileProblem(file: { name: string; size: number }) {
  if (file.size <= 0) return "Envie um arquivo.";
  if (file.size > contractingFileLimitBytes) return "O arquivo passa de 15 MB.";
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!extension || blockedExtensions.has(extension)) return "Esse formato de arquivo não é aceito.";
  return "";
}

export function isContractingContactId(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.trim());
}

export function contractingContentType(name: string) {
  const extension = name.split(".").pop()?.toLowerCase() ?? "";
  const types: Record<string, string> = {
    pdf: "application/pdf",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
    gif: "image/gif",
    heic: "image/heic",
    heif: "image/heif",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    odt: "application/vnd.oasis.opendocument.text",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    rtf: "application/rtf",
    txt: "text/plain",
    csv: "text/plain",
    zip: "application/zip",
  };
  return types[extension] ?? "application/octet-stream";
}

export function contractingAddressLine(input: Pick<ContractingInput, "street" | "addressNumber" | "complement" | "district" | "city" | "state" | "postalCode">) {
  const complement = input.complement.trim() ? ` — ${input.complement.trim()}` : "";
  return `${input.street.trim()}, ${input.addressNumber.trim()}${complement} — ${input.district.trim()}, ${input.city.trim()}/${input.state.trim().toUpperCase()} — CEP ${cepMask(input.postalCode)}`;
}

const contractingCodeAlphabet = "0123456789abcdefghijklmnopqrstuvwxyz";

export function contractingCode(contactId: string) {
  const hex = contactId.replace(/-/g, "").toLowerCase();
  if (!/^[0-9a-f]{32}$/.test(hex)) return "";
  let value = BigInt(`0x${hex}`);
  if (value === 0n) return "0";
  let out = "";
  while (value > 0n) {
    out = contractingCodeAlphabet[Number(value % 36n)] + out;
    value /= 36n;
  }
  return out;
}

export function contactIdFromContractingCode(code: string) {
  const clean = code.trim().toLowerCase();
  if (!/^[0-9a-z]{20,26}$/.test(clean)) return "";
  let value = 0n;
  for (const char of clean) {
    const digit = contractingCodeAlphabet.indexOf(char);
    if (digit < 0) return "";
    value = value * 36n + BigInt(digit);
  }
  const hex = value.toString(16).padStart(32, "0");
  if (hex.length !== 32) return "";
  const id = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  return isContractingContactId(id) ? id : "";
}

export function contractingFormUrl(origin: string, contactId: string) {
  const code = contractingCode(contactId);
  const base = "https://app.nexmeta.com.br";
  if (!code) return `${origin.trim().replace(/\/$/, "")}/contratacao/${contactId}`;
  return `${base}/c/${code}`;
}

export function contractingButtonText(url: string) {
  return `Para seguir com a contratação, preencha o formulário neste link:\nCadastro\n${url}`;
}

export function isContractingFormUrl(url: string, contactId: string) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || parsed.search !== "" || parsed.hash !== "") return false;
    if (parsed.pathname === `/contratacao/${contactId}`) return true;
    const code = contractingCode(contactId);
    return Boolean(code) && parsed.pathname === `/c/${code}`;
  } catch {
    return false;
  }
}

export function contractingContactId(pathname: string, search: string) {
  const query = new URLSearchParams(search).get("contato") ?? "";
  if (isContractingContactId(query)) return query;
  const segment = pathname.split("/").filter(Boolean).at(-1) ?? "";
  if (isContractingContactId(segment)) return segment;
  return contactIdFromContractingCode(segment);
}

export function contractingInviteMessages(contactId: string, origin: string) {
  return ["Para seguir com a contratação, preencha o formulário neste link:", contractingFormUrl(origin, contactId)] as const;
}

export function contractingSummary(input: ContractingInput & { contactName: string; protocol: string }) {
  return [
    "Contratação recebida",
    `Cliente ${input.contactName.trim()} (ID: ${input.protocol})`,
    `CNPJ: ${cnpjMask(input.cnpj)}`,
    `Razão social: ${input.legalName.trim()}`,
    `Endereço: ${contractingAddressLine(input)}`,
    `Representante legal: ${input.representativeName.trim()} — ${input.representativeEmail.trim()}`,
    `Testemunha: ${input.witnessName.trim()} — ${cpfMask(input.witnessDocument)} — ${input.witnessEmail.trim()}`,
    "Anexos em Mídias salvas.",
  ].join("\n");
}

export function contractingProblem(input: ContractingInput) {
  if (!isValidCnpj(input.cnpj)) return "Informe um CNPJ válido.";
  if (input.legalName.trim().length < 2) return "Informe a razão social.";
  if (input.postalCode.replace(/\D/g, "").length !== 8) return "Informe um CEP válido.";
  if (input.street.trim().length < 2) return "Informe o logradouro.";
  if (!input.addressNumber.trim()) return "Informe o número do endereço.";
  if (input.district.trim().length < 2) return "Informe o bairro.";
  if (input.city.trim().length < 2) return "Informe a cidade.";
  if (!/^[A-Za-z]{2}$/.test(input.state.trim())) return "Informe a UF.";
  if (!fullName(input.representativeName)) return "Informe o nome completo do representante legal.";
  if (!isValidEmail(input.representativeEmail)) return "Informe o e-mail do representante legal.";
  if (!fullName(input.witnessName)) return "Informe o nome completo da testemunha.";
  if (!isValidCpf(input.witnessDocument)) return "Informe um CPF válido da testemunha.";
  if (!isValidEmail(input.witnessEmail)) return "Informe o e-mail da testemunha.";
  return "";
}

function fullName(value: string) {
  const parts = value.trim().split(/\s+/).filter((part) => part.length >= 2);
  return parts.length >= 2;
}

function checkDigit(digits: string, factors: number[]) {
  const sum = factors.reduce((total, factor, index) => total + Number(digits[index]) * factor, 0);
  const rest = sum % 11;
  return rest < 2 ? 0 : 11 - rest;
}
