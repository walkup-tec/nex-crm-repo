import { firstBusinessDueDate, monthlyDueDay } from "./chatbot-client";
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
  adsMeta: boolean;
  adsGoogle: boolean;
};

const contractPlatformSource = "plataformas Meta Ads (Facebook e Instagram)";

export function contractPlatformPhrase(ads: { adsMeta: boolean; adsGoogle: boolean }) {
  if (ads.adsGoogle && ads.adsMeta) return "plataformas Google Ads e Meta Ads (Facebook e Instagram)";
  if (ads.adsGoogle) return "plataformas Google Ads";
  if (ads.adsMeta) return contractPlatformSource;
  return "";
}

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
  "(DESCRIÇÃO DO VALOR)",
] as const;

const units = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove", "dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
const tens = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
const hundreds = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];

function underThousand(value: number) {
  if (value === 100) return "cem";
  const hundred = Math.floor(value / 100);
  const rest = value % 100;
  const below = rest < 20 ? units[rest] : rest % 10 ? `${tens[Math.floor(rest / 10)]} e ${units[rest % 10]}` : tens[Math.floor(rest / 10)];
  if (!hundred) return below;
  if (!rest) return hundreds[hundred];
  return `${hundreds[hundred]} e ${below}`;
}

function reaisWords(value: number) {
  if (value === 0) return "zero";
  const scales = [
    { size: 1_000_000, one: "milhão", many: "milhões" },
    { size: 1_000, one: "mil", many: "mil" },
  ];
  const chunks: { words: string; amount: number }[] = [];
  let rest = value;
  for (const scale of scales) {
    const count = Math.floor(rest / scale.size);
    if (!count) continue;
    rest -= count * scale.size;
    const words = scale.one === "mil" && count === 1 ? "mil" : `${underThousand(count)} ${count === 1 ? scale.one : scale.many}`;
    chunks.push({ words, amount: count * scale.size });
  }
  if (rest) chunks.push({ words: underThousand(rest), amount: rest });
  return chunks.reduce((text, chunk, index) => {
    if (index === 0) return chunk.words;
    const link = chunk.amount < 100 || chunk.amount % 100 === 0 ? " e " : " ";
    return `${text}${link}${chunk.words}`;
  }, "");
}

export function contractMoneyWords(cents: number) {
  const absolute = Math.abs(Math.trunc(cents));
  const reais = Math.floor(absolute / 100);
  const centavos = absolute % 100;
  const parts: string[] = [];
  if (reais === 1) parts.push("um Real");
  else if (reais > 1 || centavos === 0) parts.push(`${reaisWords(reais)} Reais`);
  if (centavos === 1) parts.push("um Centavo");
  else if (centavos > 1) parts.push(`${reaisWords(centavos)} Centavos`);
  const phrase = parts.join(" e ");
  return `(${phrase.charAt(0).toUpperCase()}${phrase.slice(1)})`;
}

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
    "[DATA DO VENCIMENTO]": monthlyDueDay(fields.startsOn),
    "[DATA DE INÍCIO]": date,
    "[VALOR PROMOÇÃO]": contractMoney(fields.monthlyFeeCents),
    "[CNPJ CLIENTE]": fields.cnpj.trim(),
    "[NOME DA TESTEMUNHA]": fields.witnessName.trim(),
    "[ CPF DA TESTEMUNHA]": fields.witnessDocument.trim(),
    "[CPF DA TESTEMUNHA]": fields.witnessDocument.trim(),
    "(DESCRIÇÃO DO VALOR)": contractMoneyWords(fields.monthlyFeeCents),
  };
  const replacements: (readonly [string, string])[] = [
    ["TESTEMUNHA 1: [NOME DA TESTEMUNHA]", "TESTEMUNHA 2: [NOME DA TESTEMUNHA]"],
    ["Primeira competência e vencimento: [DATA COMEÇO VIGÊNCIA CLIENTE]", `Primeira competência e vencimento: ${contractDate(firstBusinessDueDate(fields.startsOn))}`],
    ...tokens.map((token) => [token, values[token]] as const),
  ];
  const platforms = contractPlatformPhrase(fields);
  if (platforms && platforms !== contractPlatformSource) replacements.push([contractPlatformSource, platforms]);
  return replacements;
}

function escapeXml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function unescapeXml(value: string) {
  return value.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}

function fillTextRuns(fragment: string, replacements: readonly (readonly [string, string])[]) {
  const parts = [...fragment.matchAll(/<w:t(\s[^>]*)?>([^<]*)<\/w:t>/g)];
  if (!parts.length) return fragment;
  let text = parts.map((part) => unescapeXml(part[2] ?? "")).join("");
  const original = text;
  for (const [token, value] of replacements) text = text.split(token).join(value);
  if (text === original) return fragment;
  let index = 0;
  return fragment.replace(/<w:t(\s[^>]*)?>([^<]*)<\/w:t>/g, (_full, attrs: string | undefined) => {
    const current = index;
    index += 1;
    if (current !== 0) return `<w:t${attrs ?? ""}></w:t>`;
    const attributes = (attrs ?? "").replace(/\sxml:space="preserve"/g, "");
    const space = /^\s|\s$/.test(text) ? ' xml:space="preserve"' : "";
    return `<w:t${attributes}${space}>${escapeXml(text)}</w:t>`;
  });
}

function fillParagraph(paragraph: string, replacements: readonly (readonly [string, string])[]) {
  return paragraph
    .split(/(<w:br\b[^>]*\/>)/)
    .map((part) => (part.startsWith("<w:br") ? part : fillTextRuns(part, replacements)))
    .join("");
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
