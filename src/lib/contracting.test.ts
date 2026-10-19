import assert from "node:assert/strict";
import {
  cepMask,
  cnpjMask,
  contractingContentType,
  contractingFileProblem,
  contractingInviteText,
  contractingProblem,
  contractingSummary,
  cpfMask,
  isContractingContactId,
  isValidCnpj,
  isValidCpf,
  type ContractingInput,
} from "./contracting";

assert.equal(cepMask("01310100"), "01310-100");
assert.equal(cnpjMask("11222333000181"), "11.222.333/0001-81");
assert.equal(cpfMask("39053344705"), "390.533.447-05");
assert.equal(isValidCpf("390.533.447-05"), true);
assert.equal(isValidCpf("111.111.111-11"), false);
assert.equal(isValidCnpj("11.222.333/0001-81"), true);
assert.equal(isValidCnpj("11.111.111/1111-11"), false);
assert.equal(contractingFileProblem({ name: "contrato.pdf", size: 10 }), "");
assert.equal(contractingFileProblem({ name: "virus.exe", size: 10 }), "Esse formato de arquivo não é aceito.");
assert.match(contractingFileProblem({ name: "grande.pdf", size: 16 * 1024 * 1024 }), /15 MB/);

const valid: ContractingInput = {
  cnpj: "11.222.333/0001-81",
  legalName: "Cliente Teste LTDA",
  postalCode: "01310-100",
  street: "Avenida Paulista",
  addressNumber: "1000",
  complement: "",
  district: "Bela Vista",
  city: "São Paulo",
  state: "SP",
  representativeName: "Maria Souza",
  representativeEmail: "maria@empresa.com.br",
  witnessName: "João Lima",
  witnessDocument: "390.533.447-05",
  witnessEmail: "joao@empresa.com.br",
};

assert.equal(contractingProblem(valid), "");
assert.equal(contractingProblem({ ...valid, complement: "sala 2" }), "");
assert.equal(contractingProblem({ ...valid, addressNumber: "" }), "Informe o número do endereço.");
assert.equal(contractingProblem({ ...valid, witnessDocument: "123" }), "Informe um CPF válido da testemunha.");
assert.equal(isContractingContactId("123456"), false);
assert.equal(isContractingContactId("550e8400-e29b-41d4-a716-446655440000"), true);
assert.equal(contractingContentType("cartao.PDF"), "application/pdf");
assert.equal(contractingContentType("planilha.xls"), "application/vnd.ms-excel");
assert.match(contractingSummary({ ...valid, contactName: "João da Silva", protocol: "123456" }), /Cliente João da Silva \(ID: 123456\)/);
assert.match(contractingSummary({ ...valid, contactName: "João da Silva", protocol: "123456" }), /Anexos em Mídias salvas/);
assert.equal(
  contractingInviteText("550e8400-e29b-41d4-a716-446655440000", "https://app.nexmeta.com.br/"),
  "Para seguir com a contratação, preencha o formulário neste link:\nhttps://app.nexmeta.com.br/contratacao?contato=550e8400-e29b-41d4-a716-446655440000",
);

console.log("contracting tests ok");
