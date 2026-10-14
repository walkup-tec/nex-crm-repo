import assert from "node:assert/strict";
import {
  clientUserCanSee,
  firstAllowedClientPath,
  isClientPermissionPath,
  noClientPermissions,
  type ClientHome,
} from "./client-permissions";
import type { UserPermissions } from "./user-access";

const chatbotOnly: UserPermissions = { ...noClientPermissions, chatbot: true };
const ads: UserPermissions = { ...noClientPermissions, campaigns: true, balance: true };
const creditsOnly: UserPermissions = { ...noClientPermissions, credit: true };

assert.equal(clientUserCanSee("/dashboard", chatbotOnly), false);
assert.equal(clientUserCanSee("/campanhas", chatbotOnly), false);
assert.equal(clientUserCanSee("/criativos", chatbotOnly), false);
assert.equal(clientUserCanSee("/creditos-meta", chatbotOnly), false);
assert.equal(clientUserCanSee("/financeiro", chatbotOnly), false);
assert.equal(clientUserCanSee("/usuarios", chatbotOnly), false);
assert.equal(clientUserCanSee("/chatbot", chatbotOnly), true);
assert.equal(clientUserCanSee("/chatbot/fila", chatbotOnly), true);
assert.equal(clientUserCanSee("/chatbot/configuracoes", chatbotOnly), true);
assert.equal(clientUserCanSee("/minha-conta", chatbotOnly), true);

assert.equal(clientUserCanSee("/dashboard", ads), true);
assert.equal(clientUserCanSee("/campanhas", ads), true);
assert.equal(clientUserCanSee("/criativos", ads), true);
assert.equal(clientUserCanSee("/creditos-meta", ads), true);
assert.equal(clientUserCanSee("/creditos-meta", creditsOnly), true);
assert.equal(clientUserCanSee("/dashboard", creditsOnly), false);
assert.equal(clientUserCanSee("/usuarios", { ...noClientPermissions, manage: true }), true);
assert.equal(clientUserCanSee("/financeiro", ads), false);

assert.equal(isClientPermissionPath("/chatbot/kanban"), true);
assert.equal(isClientPermissionPath("/master"), false);

const homes: UserPermissions[] = [chatbotOnly, ads, creditsOnly, noClientPermissions, { ...noClientPermissions, manage: true }];
for (const permissions of homes) {
  const home: ClientHome = firstAllowedClientPath(permissions);
  assert.equal(clientUserCanSee(home, permissions), true);
}
assert.equal(firstAllowedClientPath(chatbotOnly), "/chatbot");
assert.equal(firstAllowedClientPath(noClientPermissions), "/minha-conta");
