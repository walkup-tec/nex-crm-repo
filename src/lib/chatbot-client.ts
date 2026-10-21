import { addIsoDays } from "./billing-plan";

export const chatbotDelinquencyCents = 180_000;

export const chatbotSchedulingMessage = [
  "🚨*Atenção: Próximo passo:*",
  "Agora temos que *agendar o acesso remoto ao seu facebook*, para isso, você deve entrar na plataforma NEX, com os dados de login que recebeu e clicar no menu lateral *AGENDAMENTO*, nele você agendará o dia e horário do acesso remoto que fica melhor para você.",
].join("\n");

export function brazilToday(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function adsFromProductNames(names: string[]) {
  return {
    adsMeta: names.some((name) => /meta/i.test(name)),
    adsGoogle: names.some((name) => /google/i.test(name)),
  };
}

function isoDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return { year, month, day };
}

export function addIsoMonths(value: string, months: number) {
  const parts = isoDate(value);
  if (!parts) return "";
  const shifted = new Date(Date.UTC(parts.year, parts.month - 1 + months, 1));
  const lastDay = new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, 0)).getUTCDate();
  const day = Math.min(parts.day, lastDay);
  const month = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  return `${shifted.getUTCFullYear()}-${month}-${String(day).padStart(2, "0")}`;
}

function brazilianDate(iso: string) {
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

function easterSunday(year: number) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function nationalHolidays(year: number) {
  return new Set([
    `${year}-01-01`,
    `${year}-04-21`,
    `${year}-05-01`,
    `${year}-09-07`,
    `${year}-10-12`,
    `${year}-11-02`,
    `${year}-11-15`,
    `${year}-12-25`,
    addIsoDays(easterSunday(year), -2),
  ]);
}

function isBusinessDay(iso: string) {
  const parts = isoDate(iso);
  if (!parts) return false;
  const week = new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay();
  if (week === 0 || week === 6) return false;
  return !nationalHolidays(parts.year).has(iso);
}

export function monthlyDueDay(startsOn: string) {
  if (!isoDate(startsOn)) return "";
  let cursor = addIsoDays(startsOn, 1);
  for (let guard = 0; guard < 14 && cursor; guard += 1) {
    const day = Number(cursor.slice(8, 10));
    if (day >= 1 && day <= 28 && isBusinessDay(cursor)) return String(day);
    cursor = addIsoDays(cursor, 1);
  }
  return "1";
}

export function chatbotClientTerms(today: string) {
  if (!isoDate(today)) return null;
  const endsOn = addIsoMonths(today, 3);
  const dueDay = monthlyDueDay(today);
  if (!endsOn || !dueDay) return null;
  return {
    startsOn: brazilianDate(today),
    endsOn: brazilianDate(endsOn),
    dueDay,
  };
}
