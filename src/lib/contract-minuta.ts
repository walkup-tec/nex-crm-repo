import { readZip, writeZip } from "./docx-zip";

export type ContractMinutaFields = {
  legalName: string;
  cnpj: string;
  address: string;
  representativeName: string;
  representativeDocument: string;
  witnessName: string;
  witnessDocument: string;
  monthlyFeeCents: number;
  startsOn: string;
};

const tokens = [
  "[ENDEREÇO COMPLETO DO CLIENTE]",
  "[NOME DO REPRESENTANTE LEGAL]",
  "[CPF DO REPRESENTANTE LEGAL]",
  "[RAZÃO SOCIAL CLIENTE]",
  "[CARGO DO CLIENTE]",
  "[DATA COMEÇO VIGÊNCIA CLIENTE]",
  "[DATA DO VENCIMENTO]",
  "[DATA DE INÍCIO]",
  "[VALOR PROMOÇÃO]",
  "[CNPJ CLIENTE]",
  "[NOME DA TESTEMUNHA]",
  "[ CPF DA TESTEMUNHA]",
  "[CPF DA TESTEMUNHA]",
] as const;

export function contractMoney(cents: number) {
  const whole = Math.trunc(Math.abs(cents) / 100);
  const centsPart = String(Math.abs(cents) % 100).padStart(2, "0");
  const grouped = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `R$ ${grouped},${centsPart}`;
}

export function contractDate(iso: string) {
  const [year, month, day] = iso.slice(0, 10).split("-");
  if (!year || !month || !day) return "";
  return `${day}/${month}/${year}`;
}

export function contractMinutaReplacements(fields: ContractMinutaFields) {
  const date = contractDate(fields.startsOn);
  const values: Record<(typeof tokens)[number], string> = {
    "[ENDEREÇO COMPLETO DO CLIENTE]": fields.address.trim(),
    "[NOME DO REPRESENTANTE LEGAL]": fields.representativeName.trim(),
    "[CPF DO REPRESENTANTE LEGAL]": fields.representativeDocument.trim(),
    "[RAZÃO SOCIAL CLIENTE]": fields.legalName.trim(),
    "[CARGO DO CLIENTE]": "representante legal",
    "[DATA COMEÇO VIGÊNCIA CLIENTE]": date,
    "[DATA DO VENCIMENTO]": date,
    "[DATA DE INÍCIO]": date,
    "[VALOR PROMOÇÃO]": contractMoney(fields.monthlyFeeCents),
    "[CNPJ CLIENTE]": fields.cnpj.trim(),
    "[NOME DA TESTEMUNHA]": fields.witnessName.trim(),
    "[ CPF DA TESTEMUNHA]": fields.witnessDocument.trim(),
    "[CPF DA TESTEMUNHA]": fields.witnessDocument.trim(),
  };
  return tokens.map((token) => [token, values[token]] as const);
}

function escapeXml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function unescapeXml(value: string) {
  return value.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}

function fillParagraph(paragraph: string, replacements: readonly (readonly [string, string])[]) {
  const parts = [...paragraph.matchAll(/<w:t(\s[^>]*)?>([^<]*)<\/w:t>/g)];
  if (!parts.length) return paragraph;
  let text = parts.map((part) => unescapeXml(part[2] ?? "")).join("");
  const original = text;
  for (const [token, value] of replacements) text = text.split(token).join(value);
  if (text === original) return paragraph;
  let index = 0;
  return paragraph.replace(/<w:t(\s[^>]*)?>([^<]*)<\/w:t>/g, (_full, attrs: string | undefined) => {
    const current = index;
    index += 1;
    if (current !== 0) return `<w:t${attrs ?? ""}></w:t>`;
    const attributes = (attrs ?? "").replace(/\sxml:space="preserve"/g, "");
    const space = /^\s|\s$/.test(text) ? ' xml:space="preserve"' : "";
    return `<w:t${attributes}${space}>${escapeXml(text)}</w:t>`;
  });
}

export function fillContractMinutaXml(xml: string, fields: ContractMinutaFields) {
  const replacements = contractMinutaReplacements(fields);
  return xml.replace(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g, (paragraph) => fillParagraph(paragraph, replacements));
}

export function contractPlaceholdersLeft(xml: string) {
  const text = [...xml.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g)].map((part) => unescapeXml(part[1] ?? "")).join("");
  return tokens.filter((token) => text.includes(token));
}

export function fillContractMinutaDocx(bytes: Uint8Array, fields: ContractMinutaFields) {
  const files = readZip(bytes);
  const document = files.find((file) => file.name === "word/document.xml");
  if (!document) throw new Error("A minuta não contém o texto do contrato.");
  const xml = new TextDecoder().decode(document.data);
  const filled = fillContractMinutaXml(xml, fields);
  const pending = contractPlaceholdersLeft(filled);
  if (pending.length) throw new Error("A minuta ainda tem lacunas sem preenchimento.");
  document.data = new TextEncoder().encode(filled);
  return writeZip(files);
}
