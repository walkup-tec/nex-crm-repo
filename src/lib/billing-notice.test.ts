import assert from "node:assert/strict";
import type { BillingNoticeKind } from "./billing-plan";
import {
  billingNoticeText,
  billingToday,
  chargeImageLabel,
  judgeNotice,
  noticeUpdatedCents,
  noticeWindowOpen,
  readProviderMessageId,
  regularizedInstallmentCents,
} from "./billing-notice";
import { buildChargeCardSvg } from "./charge-card";
import { renderChargeCardPng } from "../server/charge-card.server";

const pix = "00020126580014br.gov.bcb.pix0136teste520400005303986540549.005802BR5913DIGITAL CORBAN6009SAO PAULO62070503***6304ABCD";
const open = {
  sendOn: "2026-10-18",
  today: "2026-10-18",
  status: "pending",
  coraStatus: "OPEN",
  legalName: "WALKUP TECNOLOGIA E SISTEMAS LTDA",
  financePhone: "51999999999",
  pixCode: pix,
  faceCents: 49900,
  delinquencyCents: 180000,
  localStatus: "pending",
};

function onDay(kind: BillingNoticeKind, due: string) {
  const verdict = judgeNotice({ ...open, kind, sendOn: due, today: due });
  assert.equal(verdict.type, "send");
  if (verdict.type !== "send") return;
  const text = billingNoticeText(kind, {
    name: open.legalName,
    due: "2026-10-25",
    faceCents: verdict.faceCents,
    updatedCents: verdict.updatedCents,
    pixCode: pix,
  });
  assert.match(text, /WALKUP TECNOLOGIA E SISTEMAS LTDA/);
  assert.match(text, /25\/10\/2026/);
  assert.ok(text.includes(chargeImageLabel));
  assert.ok(text.includes(pix));
  assert.match(text, /Equipe Financeira\nDigital Corban/);
  return text;
}

const before7 = onDay("before_7", "2026-10-18");
assert.match(before7 ?? "", /vencerá em 25\/10\/2026/);
assert.match(before7 ?? "", /Valor: R\$\s*499,00/);

const before3 = onDay("before_3", "2026-10-18");
assert.match(before3 ?? "", /daqui a três dias/);

const due = onDay("due", "2026-10-18");
assert.match(due ?? "", /vence hoje/);

const after1 = onDay("after_1", "2026-10-18");
assert.match(after1 ?? "", /ainda consta em aberto/);
assert.equal((after1 ?? "").includes("Valor atualizado"), false);

const after3 = onDay("after_3", "2026-10-18");
assert.match(after3 ?? "", /Valor atualizado: R\$\s*1\.800,00/);
assert.equal(noticeUpdatedCents("after_3", 49900, 180000), 180000);
assert.equal(noticeUpdatedCents("after_5", 49900, 180000), 180000);
assert.equal(noticeUpdatedCents("after_5", 49900, null), 49900);

const after5 = onDay("after_5", "2026-10-18");
assert.match(after5 ?? "", /protesto e cobrança judicial/);
assert.match(after5 ?? "", /quando\nlegalmente cabíveis/);

const paid = judgeNotice({ ...open, kind: "before_7", coraStatus: "PAID" });
assert.equal(paid.type, "skip");
if (paid.type === "skip") assert.equal(paid.stopSeries, true);

const cancelled = judgeNotice({ ...open, kind: "after_1", coraStatus: "CANCELLED" });
assert.equal(cancelled.type, "skip");
if (cancelled.type === "skip") assert.equal(cancelled.reason, "Cobrança cancelada ou substituída.");

const duplicate = judgeNotice({ ...open, kind: "due", status: "sent" });
assert.equal(duplicate.type, "wait");
const failed = judgeNotice({ ...open, kind: "due", status: "failed" });
assert.equal(failed.type, "wait");

const demo = judgeNotice({ ...open, kind: "before_3", legalName: "MMS MARKETING E SISTEMAS DIGITAIS LTDA" });
assert.equal(demo.type, "skip");

assert.equal(regularizedInstallmentCents(49900), 49900);
assert.equal(noticeWindowOpen(new Date("2026-10-18T11:00:00Z")), true);
assert.equal(noticeWindowOpen(new Date("2026-10-18T10:00:00Z")), false);
assert.equal(noticeWindowOpen(new Date("2026-10-18T21:00:00Z")), false);
assert.equal(billingToday(new Date("2026-10-18T02:30:00Z")), "2026-10-17");
assert.equal(readProviderMessageId({ key: { id: "ABC123" } }), "ABC123");

const late = judgeNotice({ ...open, kind: "after_5", sendOn: "2026-10-17", today: "2026-10-18" });
assert.equal(late.type, "skip");
if (late.type === "skip") assert.equal(late.stopSeries, false);

const svg = buildChargeCardSvg({
  clientName: open.legalName,
  totalCents: 49900,
  dueDate: "2026-10-17",
  pixPayload: pix,
  adsMeta: true,
  adsGoogle: false,
  delinquencyAmountCents: 180000,
  promotions: [],
  promoMonthlyCents: 49900,
  nominalMonthlyCents: 180000,
  logoBase64: "",
});
assert.match(svg, /WALKUP TECNOLOGIA E SISTEMAS LTDA/);
assert.match(svg, /R\$\s*499,00/);
assert.match(svg, /17\/10\/2026/);
assert.match(svg, /R\$\s*1\.800,00/);
assert.match(svg, /Meta Ads/);
assert.match(svg, /WALKUP SISTEMAS E INTELIGENCIA/);
assert.match(svg, /69\.511\.558\/0001-38/);

const png = await renderChargeCardPng({
  clientName: open.legalName,
  totalCents: 49900,
  dueDate: "2026-10-17",
  pixPayload: pix,
  adsMeta: true,
  adsGoogle: false,
  delinquencyAmountCents: 180000,
  promotions: [],
  promoMonthlyCents: 49900,
  nominalMonthlyCents: 180000,
});
assert.equal(png.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
assert.ok(png.byteLength > 20000);
