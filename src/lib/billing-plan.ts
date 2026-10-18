export type BillingProvider = "asaas" | "cora";
export type DelinquencyMode = "rate" | "amount";
export type BillingNoticeKind = "before_7" | "before_3" | "due" | "after_1" | "after_3" | "after_5";

export const billingNoticeRules: { kind: BillingNoticeKind; days: number }[] = [
  { kind: "before_7", days: -7 },
  { kind: "before_3", days: -3 },
  { kind: "due", days: 0 },
  { kind: "after_1", days: 1 },
  { kind: "after_3", days: 3 },
  { kind: "after_5", days: 5 },
];

const minimumChargeCents = 500;

function isoParts(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return { year, month, day };
}

export function addIsoDays(value: string, days: number) {
  const parts = isoParts(value);
  if (!parts) return "";
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${date.getUTCFullYear()}-${month}-${day}`;
}

export function contractDueDates(startsOn: string, endsOn: string, dueDay: number, today: string) {
  if (!isoParts(startsOn) || !isoParts(endsOn) || !isoParts(today) || dueDay < 1 || dueDay > 28 || endsOn < startsOn) return [];
  const dates: string[] = [];
  let year = Number(startsOn.slice(0, 4));
  let month = Number(startsOn.slice(5, 7));
  for (let guard = 0; guard < 240; guard += 1) {
    const due = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(dueDay).padStart(2, "0")}`;
    if (due > endsOn) break;
    if (due >= startsOn && due >= today) dates.push(due);
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return dates;
}

export type PromoWindow = { startsOn: string; endsOn: string; amountCents: number };

export function promotionAmount(due: string, nominalCents: number, promos: PromoWindow[]) {
  const match = promos.find((promo) => due >= promo.startsOn && due <= promo.endsOn);
  return match ? match.amountCents : nominalCents;
}

export function promotionsOverlap(promos: { startsOn: string; endsOn: string }[]) {
  const ordered = [...promos].sort((left, right) => left.startsOn.localeCompare(right.startsOn));
  for (let index = 1; index < ordered.length; index += 1) {
    const previous = ordered[index - 1];
    const current = ordered[index];
    if (previous && current && current.startsOn <= previous.endsOn) return true;
  }
  return false;
}

export function chargeCents(
  due: string,
  monthlyCents: number,
  promo: { startsOn: string; endsOn: string; afterCents: number } | null,
) {
  if (!promo || due < promo.startsOn || due > promo.endsOn) return promo ? promo.afterCents : monthlyCents;
  return monthlyCents;
}

export function noticeSchedule(due: string) {
  return billingNoticeRules.map((rule) => ({ kind: rule.kind, sendOn: addIsoDays(due, rule.days) }));
}

export function coraDelinquencyFine(chargeAmount: number, delinquencyAmount: number) {
  if (!Number.isInteger(chargeAmount) || !Number.isInteger(delinquencyAmount)) return -1;
  return delinquencyAmount - chargeAmount;
}

export function coraPaymentTerms(
  due: string,
  mode: DelinquencyMode,
  finePercent: number,
  interestPercent: number,
  amountCents: number,
) {
  const terms: {
    due_date: string;
    fine?: { amount: number } | { rate: number };
    interest?: { rate: number };
  } = { due_date: due };
  if (mode === "amount") {
    if (amountCents > 0) terms.fine = { amount: amountCents };
    return terms;
  }
  if (finePercent > 0) terms.fine = { rate: Math.round(finePercent * 100) / 100 };
  if (interestPercent > 0) terms.interest = { rate: Math.round(interestPercent * 100) / 100 };
  return terms;
}

export function assertCoraAmounts(amounts: number[]) {
  if (amounts.some((amount) => !Number.isInteger(amount) || amount < minimumChargeCents)) {
    return "Cada cobrança da Cora precisa ser de pelo menos R$ 5,00.";
  }
  return "";
}
