import assert from "node:assert/strict";
import { contractDueDates } from "./billing-plan";
import { adsFromProductNames, chatbotClientTerms, chatbotDelinquencyCents, chatbotSchedulingMessage, monthlyDueDay } from "./chatbot-client";

assert.deepEqual(adsFromProductNames(["Meta Ads"]), { adsMeta: true, adsGoogle: false });
assert.deepEqual(adsFromProductNames(["Google Ads", "Site"]), { adsMeta: false, adsGoogle: true });
assert.deepEqual(adsFromProductNames(["Meta Ads", "Google Ads"]), { adsMeta: true, adsGoogle: true });
assert.deepEqual(adsFromProductNames(["Consultoria"]), { adsMeta: false, adsGoogle: false });

const october = chatbotClientTerms("2026-10-20");
assert.equal(october?.startsOn, "20/10/2026");
assert.equal(october?.dueDay, "21");
assert.equal(october?.endsOn, "20/01/2027");

const monthEnd = chatbotClientTerms("2026-01-31");
assert.equal(monthEnd?.dueDay, "2");
assert.equal(monthEnd?.endsOn, "30/04/2026");
assert.equal(contractDueDates("2026-01-31", "2026-04-30", 2, "2026-01-31")[0], "2026-02-02");

const day29 = chatbotClientTerms("2026-01-29");
assert.equal(day29?.dueDay, "2");
assert.equal(contractDueDates("2026-01-29", "2026-04-29", 2, "2026-01-29")[0], "2026-02-02");

const day30 = chatbotClientTerms("2026-01-30");
assert.equal(day30?.dueDay, "2");
assert.equal(contractDueDates("2026-01-30", "2026-04-30", 2, "2026-01-30")[0], "2026-02-02");

const businessFirst = chatbotClientTerms("2026-03-31");
assert.equal(businessFirst?.dueDay, "1");
assert.equal(contractDueDates("2026-03-31", "2026-06-30", 1, "2026-03-31")[0], "2026-04-01");

const laborDay = chatbotClientTerms("2026-04-30");
assert.equal(laborDay?.dueDay, "4");
assert.equal(contractDueDates("2026-04-30", "2026-07-30", 4, "2026-04-30")[0], "2026-05-04");

const allSouls = chatbotClientTerms("2026-10-31");
assert.equal(allSouls?.dueDay, "3");
assert.equal(contractDueDates("2026-10-31", "2027-01-31", 3, "2026-10-31")[0], "2026-11-03");

const friday = chatbotClientTerms("2026-10-16");
assert.equal(friday?.dueDay, "19");
assert.equal(contractDueDates("2026-10-16", "2027-01-16", 19, "2026-10-16")[0], "2026-10-19");

const holiday = chatbotClientTerms("2026-04-20");
assert.equal(holiday?.dueDay, "22");
assert.equal(monthlyDueDay("2026-04-20"), "22");

const lateMonth = chatbotClientTerms("2026-10-28");
assert.equal(lateMonth?.dueDay, "3");
assert.equal(contractDueDates("2026-10-28", "2027-01-28", 3, "2026-10-28")[0], "2026-11-03");
assert.equal(chatbotDelinquencyCents, 180000);
assert.match(chatbotSchedulingMessage, /agendar o acesso remoto/);
assert.match(chatbotSchedulingMessage, /\*AGENDAMENTO\*/);

console.log("chatbot client tests ok");
