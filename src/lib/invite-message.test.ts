import assert from "node:assert/strict";
import {
  inviteAccessLink,
  inviteParagraphs,
  invitePasswordButton,
  invitePlainText,
  inviteSubject,
  inviteWhatsappDescription,
} from "./invite-message";

const email = "teste@teste.com.br";
const link = inviteAccessLink("https://app.nexmeta.com.br", email);

assert.equal(inviteSubject, "Seja bem-vindo a Agência NEX");
assert.equal(invitePasswordButton, "CRIAR MINHA SENHA");
assert.equal(link, "https://app.nexmeta.com.br/primeiro-acesso?email=teste%40teste.com.br");

const text = invitePlainText("CLIENTE TESTE MENSAGERIA", email, link);
assert.ok(text.startsWith("Olá, CLIENTE TESTE MENSAGERIA!"));
assert.ok(text.includes("clique no botão abaixo e crie sua senha de acesso."));
assert.ok(text.includes(invitePasswordButton));
assert.ok(text.includes(link));
assert.ok(text.includes(`Seu acesso: ${email}`));
assert.ok(text.endsWith("Dados claros. Decisões melhores."));

const description = inviteWhatsappDescription("CLIENTE TESTE MENSAGERIA", email);
assert.ok(description.includes("clique no botão abaixo e crie sua senha de acesso."));
assert.equal(description.includes(link), false);
assert.equal(inviteParagraphs("", email)[0], "Olá!");
