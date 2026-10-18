import assert from "node:assert/strict";
import { adsServiceDescription, promoChargeCopy } from "./client-access";
import { keepsAccessWithoutPayment } from "./finance-access";

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

assert.equal(keepsAccessWithoutPayment("MMS MARKETING E SISTEMAS DIGITAIS LTDA"), true);
assert.equal(keepsAccessWithoutPayment(" mms marketing e sistemas digitais ltda "), true);
assert.equal(keepsAccessWithoutPayment("WALKUP SISTEMAS E INTELIGENCIA LTDA"), false);
