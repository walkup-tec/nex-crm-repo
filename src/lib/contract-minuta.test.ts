import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fillContractMinutaDocx, fillContractMinutaXml, contractMoney, contractMoneyWords, contractPlaceholdersLeft, contractPlatformPhrase } from "./contract-minuta";
import { readZip } from "./docx-zip";

assert.equal(contractPlatformPhrase({ adsMeta: true, adsGoogle: false }), "plataformas Meta Ads (Facebook e Instagram)");
assert.equal(contractPlatformPhrase({ adsMeta: false, adsGoogle: true }), "plataformas Google Ads");
assert.equal(contractPlatformPhrase({ adsMeta: true, adsGoogle: true }), "plataformas Google Ads e Meta Ads (Facebook e Instagram)");
assert.equal(contractPlatformPhrase({ adsMeta: false, adsGoogle: false }), "");
assert.equal(contractMoneyWords(50000), "(Quinhentos Reais)");
assert.equal(contractMoneyWords(49900), "(Quatrocentos e noventa e nove Reais)");
assert.equal(contractMoneyWords(100), "(Um Real)");
assert.equal(contractMoneyWords(200), "(Dois Reais)");
assert.equal(contractMoneyWords(1), "(Um Centavo)");
assert.equal(contractMoneyWords(101), "(Um Real e um Centavo)");
assert.equal(contractMoneyWords(150), "(Um Real e cinquenta Centavos)");
assert.equal(contractMoneyWords(180000), "(Mil e oitocentos Reais)");
assert.equal(contractMoneyWords(140000), "(Mil e quatrocentos Reais)");
assert.equal(contractMoney(49900), "R$ 499,00");
assert.equal(contractMoney(180000), "R$ 1.800,00");

const split = `<w:p><w:r><w:t>TESTEMUNHA 1: [NOME</w:t></w:r><w:r><w:t xml:space="preserve"> DA TESTEMUNHA], CPF [ </w:t></w:r><w:r><w:t>CPF DA TESTEMUNHA]</w:t></w:r></w:p>`;
const fields = {
  legalName: "Empresa & Teste LTDA",
  cnpj: "11.222.333/0001-81",
  address: "Rua A, 10 — Centro, Novo Hamburgo/RS — CEP 93510-000",
  representativeName: "Maria Souza",
  representativeDocument: "390.533.447-05",
  witnessName: "João Lima",
  witnessDocument: "529.982.247-25",
  monthlyFeeCents: 140000,
  startsOn: "2026-10-20",
  adsMeta: false,
  adsGoogle: true,
};
const filledSplit = fillContractMinutaXml(split, fields);
assert.match(filledSplit, /João Lima, CPF 529\.982\.247-25/);
assert.equal(contractPlaceholdersLeft(filledSplit).length, 0);

const docx = readFileSync(new URL("../../assets/minuta-nex.docx", import.meta.url));
const filled = fillContractMinutaDocx(docx, fields);
const xml = new TextDecoder().decode(readZip(filled).find((file) => file.name === "word/document.xml")?.data);
const text = [...xml.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g)].map((part) => part[1]).join("");
assert.equal(text.includes("[RAZÃO SOCIAL CLIENTE]"), false);
assert.equal(text.includes("[VALOR PROMOÇÃO]"), false);
assert.equal(text.includes("[DATA DE INÍCIO]"), false);
assert.equal(text.includes("[CARGO DO CLIENTE]"), false);
assert.equal(text.includes("NOME DA TESTEMUNHA"), false);
assert.equal(text.includes("CPF DA TESTEMUNHA"), false);
assert.match(text, /Empresa &amp; Teste LTDA/);
assert.match(text, /R\$ 1\.400,00/);
assert.match(text, /\(Mil e quatrocentos Reais\)/);
assert.equal(text.includes("DESCRIÇÃO DO VALOR"), false);
assert.match(text, /20\/10\/2026/);
assert.match(text, /dia 21 de cada mês/);
assert.match(text, /Primeira competência e vencimento: 21\/10\/2026/);
assert.match(text, /representante legal/);
assert.match(text, /João Lima/);
assert.match(text, /529\.982\.247-25/);
const signatureLines = (paragraph: string) =>
  paragraph.split(/<w:br\b[^>]*\/>/).map((part) => [...part.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g)].map((item) => item[1]).join(""));
const contratante = [...xml.matchAll(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g)].map((item) => item[0]).find((paragraph) => paragraph.includes("CONTRATANTE:") && paragraph.includes("Assinatura:"));
const contratanteLines = signatureLines(contratante ?? "");
assert.match(contratanteLines[0] ?? "", /CONTRATANTE: Empresa &amp; Teste LTDA, CNPJ 11\.222\.333\/0001-81/);
assert.equal((contratanteLines[0] ?? "").includes("Representante"), false);
assert.match(contratanteLines[1] ?? "", /Representante: Maria Souza, CPF 390\.533\.447-05/);
assert.equal((contratanteLines[1] ?? "").includes("Assinatura"), false);
assert.match(contratanteLines[2] ?? "", /Assinatura: __________________________________________/);
const witness = [...xml.matchAll(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g)].map((item) => item[0]).find((paragraph) => paragraph.includes("TESTEMUNHA 2:"));
const witnessLines = signatureLines(witness ?? "");
assert.match(witnessLines[0] ?? "", /TESTEMUNHA 2: João Lima, CPF 529\.982\.247-25/);
assert.equal((witnessLines[0] ?? "").includes("Assinatura"), false);
assert.match(witnessLines[1] ?? "", /Assinatura: ________________________/);
assert.match(text, /plataformas Google Ads/);
assert.equal(text.includes("Facebook e Instagram"), false);

console.log("contract minuta tests ok");
