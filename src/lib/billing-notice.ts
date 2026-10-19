import type { BillingNoticeKind } from "@/lib/billing-plan";
import { dateBr, moneyFromCents } from "@/lib/client-access";
import { keepsAccessWithoutPayment, pixQrPayload, todayKey } from "@/lib/finance-access";

export const chargeImageLabel = "Imagem enviada nesta mensagem.";

const templates: Record<BillingNoticeKind, string> = {
  before_7: `Olá, {{nome}}! Tudo bem?

Passando para lembrar que sua mensalidade
da Agência NEX vencerá em {{vencimento}}.

Valor: {{valor}}

Fatura para pagamento:
{{fatura cora}}

Ou se preferir, use o link:
{{link pix para pagamento do cora}}

Agradecemos pela parceria!

Equipe Financeira
Agência NEX`,
  before_3: `Olá, {{nome}}!

Sua mensalidade da Agência NEX vence
daqui a três dias.

Vencimento: {{vencimento}}
Valor: {{valor}}

Fatura para pagamento:
{{fatura cora}}

Ou se preferir, use o link:
{{link pix para pagamento do cora}}

Manter seus pagamentos em dia garante
a continuidade dos serviços contratados
e a manutenção das condições comerciais.

Equipe Financeira
Agência NEX`,
  due: `Olá, {{nome}}!

Informamos que sua mensalidade da
Agência NEX vence hoje.

Valor: {{valor}}
Vencimento: {{vencimento}}

Fatura para pagamento:
{{fatura cora}}

Ou se preferir, use o link:
{{link pix para pagamento do cora}}

Pedimos que realize o pagamento dentro
do prazo para manter suas condições
comerciais e evitar pendências financeiras.

Caso já tenha efetuado o pagamento,
desconsidere esta mensagem.

Equipe Financeira
Agência NEX`,
  after_1: `Olá, {{nome}}!

Identificamos que sua mensalidade da
Agência NEX, com vencimento em
{{vencimento}}, ainda consta em aberto.

Conforme as condições comerciais
estabelecidas em contrato, a
inadimplência poderá resultar na
perda do desconto promocional.

Solicitamos a regularização para
preservar suas condições comerciais
e evitar impactos nos serviços.

Fatura para pagamento:
{{fatura cora}}

Ou se preferir, use o link:
{{link pix para pagamento do cora}}

Se o pagamento já foi realizado,
desconsidere esta mensagem.

Equipe Financeira
Agência NEX`,
  after_3: `Olá, {{nome}}!

Sua mensalidade da Agência NEX
continua constando como pendente.

Vencimento: {{vencimento}}
Valor atualizado: {{valor_atualizado}}

A manutenção dos serviços de gestão
de tráfego envolve atividades técnicas,
monitoramento e acompanhamento das
campanhas publicitárias.

A inadimplência poderá comprometer
a continuidade desses serviços,
conforme as condições contratuais.

Além disso, o desconto promocional
está condicionado à pontualidade
dos pagamentos.

Solicitamos que regularize sua
pendência o quanto antes.

Fatura para pagamento:
{{fatura cora}}

Ou se preferir, use o link:
{{link pix para pagamento do cora}}

Caso precise de esclarecimentos,
entre em contato com nosso suporte.

Equipe Financeira
Agência NEX`,
  after_5: `Olá, {{nome}}!

Esta é uma notificação importante
sobre sua pendência financeira
com a Agência NEX.

Até o momento, não identificamos
a confirmação do pagamento referente
à mensalidade vencida em {{vencimento}}.

Valor atualizado: {{valor_atualizado}}

Informamos que a permanência da
inadimplência poderá resultar na
aplicação das medidas previstas
contratualmente, incluindo, quando
legalmente cabíveis, procedimentos
de cobrança, protesto e cobrança judicial.

Nosso objetivo é evitar essas medidas
e buscar uma solução amigável.

Solicitamos que entre em contato
com nosso suporte financeiro com
urgência para regularizar a situação.

Fatura para pagamento:
{{fatura cora}}

Ou se preferir, use o link:
{{link pix para pagamento do cora}}

Caso o pagamento já tenha sido realizado,
desconsidere esta notificação.

Equipe Financeira
Agência NEX`,
};

export function noticeUpdatedCents(kind: BillingNoticeKind, faceCents: number, delinquencyCents: number | null) {
  if (kind !== "after_3" && kind !== "after_5") return faceCents;
  if (delinquencyCents == null || !Number.isInteger(delinquencyCents) || delinquencyCents <= 0) return faceCents;
  return delinquencyCents;
}

export function regularizedInstallmentCents(issuedCents: number) {
  return issuedCents;
}

export function noticeWindowOpen(now = new Date()) {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Sao_Paulo",
      hour: "2-digit",
      hourCycle: "h23",
    }).format(now),
  );
  return hour >= 8 && hour < 18;
}

export function billingToday(now = new Date()) {
  return todayKey(now);
}

export function readProviderMessageId(payload: unknown) {
  const record = asRecord(payload);
  if (!record) return "";
  const nested = asRecord(record["data"]);
  const key = asRecord(record["key"]) ?? (nested ? asRecord(nested["key"]) : null);
  const id = key?.["id"];
  return typeof id === "string" ? id : "";
}

export type NoticeVerdict =
  | { type: "send"; faceCents: number; updatedCents: number }
  | { type: "skip"; reason: string; stopSeries: boolean }
  | { type: "wait"; reason: string };

export function judgeNotice(input: {
  kind: BillingNoticeKind;
  sendOn: string;
  today: string;
  status: string;
  coraStatus: string;
  legalName: string;
  financePhone: string;
  pixCode: string;
  faceCents: number;
  delinquencyCents: number | null;
  localStatus: string;
}): NoticeVerdict {
  if (input.status === "sent" || input.status === "failed" || input.status === "skipped" || input.status === "sending") {
    return { type: "wait", reason: "Esta etapa já foi processada." };
  }
  if (input.sendOn > input.today) return { type: "wait", reason: "A etapa ainda não chegou." };
  if (input.sendOn < input.today) {
    return { type: "skip", reason: "A etapa passou sem envio.", stopSeries: false };
  }
  if (keepsAccessWithoutPayment(input.legalName)) {
    return { type: "skip", reason: "Conta de demonstração.", stopSeries: true };
  }
  const remote = input.coraStatus.trim().toUpperCase();
  if (input.localStatus === "paid" || remote === "PAID") {
    return { type: "skip", reason: "Pagamento confirmado na Cora.", stopSeries: true };
  }
  if (input.localStatus === "cancelled" || remote === "CANCELLED") {
    return { type: "skip", reason: "Cobrança cancelada ou substituída.", stopSeries: true };
  }
  if (remote !== "OPEN" && remote !== "LATE") {
    return { type: "wait", reason: "A Cora ainda não confirmou a cobrança em aberto." };
  }
  if (!input.financePhone.trim() || input.financePhone.trim().toLocaleLowerCase("pt-BR") === "não informado") {
    return { type: "wait", reason: "Cliente sem telefone financeiro." };
  }
  if (!pixQrPayload(input.pixCode)) {
    return { type: "wait", reason: "Cobrança sem código Pix válido." };
  }
  if (!Number.isInteger(input.faceCents) || input.faceCents <= 0) {
    return { type: "skip", reason: "Cobrança sem valor.", stopSeries: false };
  }
  return {
    type: "send",
    faceCents: input.faceCents,
    updatedCents: noticeUpdatedCents(input.kind, input.faceCents, input.delinquencyCents),
  };
}

export function billingNoticeText(
  kind: BillingNoticeKind,
  input: { name: string; due: string; faceCents: number; updatedCents: number; pixCode: string },
) {
  return templates[kind]
    .replaceAll("{{nome}}", input.name.trim())
    .replaceAll("{{vencimento}}", dateBr(input.due))
    .replaceAll("{{valor_atualizado}}", moneyFromCents(input.updatedCents))
    .replaceAll("{{valor}}", moneyFromCents(input.faceCents))
    .replaceAll("{{fatura cora}}", chargeImageLabel)
    .replaceAll("{{link pix para pagamento do cora}}", input.pixCode.trim());
}

const subjects: Record<BillingNoticeKind, string> = {
  before_7: "Sua mensalidade da Agência NEX vence em breve",
  before_3: "Sua mensalidade da Agência NEX vence em três dias",
  due: "Sua mensalidade da Agência NEX vence hoje",
  after_1: "Sua mensalidade da Agência NEX está em aberto",
  after_3: "Sua mensalidade da Agência NEX continua pendente",
  after_5: "Pendência da mensalidade da Agência NEX",
};

export function billingNoticeSubject(kind: BillingNoticeKind) {
  return subjects[kind];
}

export function billingNoticeEmailHtml(text: string) {
  const blocks = text
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replaceAll("\n", "<br>")}</p>`);
  blocks.push(
    `<p><img src="cid:cobranca@nex" alt="Fatura para pagamento" style="max-width:100%;height:auto"></p>`,
  );
  return `<div style="font-family:Arial,sans-serif;color:#111827;line-height:1.6;font-size:16px">${blocks.join("")}</div>`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function asRecord(value: unknown) {
  return value !== null && typeof value === "object" ? (value as Record<string, unknown>) : null;
}
