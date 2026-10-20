import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fillContractMinutaDocx, fillContractMinutaXml, contractMoney, contractPlaceholdersLeft } from "./contract-minuta";
import { readZip } from "./docx-zip";

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
assert.match(text, /20\/10\/2026/);
assert.match(text, /representante legal/);
assert.match(text, /João Lima/);
assert.match(text, /529\.982\.247-25/);

console.log("contract minuta tests ok");
