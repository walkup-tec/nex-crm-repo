import assert from "node:assert/strict";
import { adsServiceDescription, clientDisplayName, overdueAccessCopy, overduePixCopy, promoChargeCopy } from "./client-access";
import { keepsAccessWithoutPayment } from "./finance-access";

assert.equal(clientDisplayName({ legalName: "MMS MARKETING E SISTEMAS DIGITAIS LTDA", commercialName: "MMS" }), "MMS");
assert.equal(clientDisplayName({ legalName: "MMS MARKETING E SISTEMAS DIGITAIS LTDA", commercialName: "  " }), "MMS MARKETING E SISTEMAS DIGITAIS LTDA");

const promo = promoChargeCopy("R$ 1.800,00", "R$ 499,00", "R$ 1.800,00");
assert.equal(
  promo.about,
  "Está ativa no seu cadastro a promoção que reduz a sua mensalidade nominal de R$ 1.800,00 para mensalidade promocional de R$ 499,00.",
);
assert.equal(
  promo.keep,
  "Mantenham suas mensalidades em dia para não perder a promoção. Após o vencimento, o valor da cobrança será de R$ 1.800,00.",
);

assert.equal(
  adsServiceDescription({ adsMeta: false, adsGoogle: true }),
  "Mensalidade referente ao serviço de anúncios na plataforma Google Ads.",
);
assert.equal(
  adsServiceDescription({ adsMeta: true, adsGoogle: false }),
  "Mensalidade referente ao serviço de anúncios na plataforma Meta Ads.",
);
assert.equal(
  adsServiceDescription({ adsMeta: true, adsGoogle: true }),
  "Mensalidade referente ao serviço de anúncios na plataforma Google e Meta Ads.",
);

assert.equal(
  overdueAccessCopy({ adsMeta: true, adsGoogle: false }),
  "Continue impulsionando o crescimento do seu negócio com anúncios na Meta. Regularize sua pendência para restabelecer o acesso aos nossos serviços.",
);
assert.equal(
  overdueAccessCopy({ adsMeta: false, adsGoogle: true }),
  "Continue impulsionando o crescimento do seu negócio com anúncios no Google. Regularize sua pendência para restabelecer o acesso aos nossos serviços.",
);
assert.equal(
  overdueAccessCopy({ adsMeta: true, adsGoogle: true }),
  "Continue impulsionando o crescimento do seu negócio com anúncios na Meta e no Google. Regularize sua pendência para restabelecer o acesso aos nossos serviços.",
);

assert.equal(
  overduePixCopy({ provider: "cora", nominal: true }),
  "Pix do valor nominal desta parcela. A cobrança vencida sai da Cora quando este pagamento for identificado.",
);
assert.equal(
  overduePixCopy({ provider: "asaas", nominal: false }),
  "Pix desta parcela com multa e juros calculados. A cobrança vencida sai do Asaas quando este pagamento for identificado.",
);
assert.equal(
  overduePixCopy({ provider: "cora", nominal: null }),
  "A cobrança vencida sai da Cora quando este pagamento for identificado.",
);

assert.equal(keepsAccessWithoutPayment("MMS MARKETING E SISTEMAS DIGITAIS LTDA"), true);
assert.equal(keepsAccessWithoutPayment(" mms marketing e sistemas digitais ltda "), true);
assert.equal(keepsAccessWithoutPayment("WALKUP SISTEMAS E INTELIGENCIA LTDA"), false);
