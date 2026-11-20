/**
 * Vincula as 3 vagas do lote 2026-11-18 às empresas (idempotente).
 * Uso:
 *   $env:CHATGPT_INTEGRATION_SECRET="..."; node scripts/backfill-career-job-links.mjs
 */
const secret = (process.env.CHATGPT_INTEGRATION_SECRET || "").trim();
const base = (process.env.APP_URL || "https://app.nexmeta.com.br").replace(/\/$/, "");
if (!secret) {
  console.error("missing_CHATGPT_INTEGRATION_SECRET");
  process.exit(1);
}

const links = [
  { jobId: "d993082f-1093-4f51-be49-7b544a1f0925", companyId: "4ce0c890-1e96-42a9-a67c-85169aeef8fe" },
  { jobId: "5ff1e98d-5c64-43df-92f1-25f7c5c617e7", companyId: "1142bc5e-745d-45c3-9297-0236db759003" },
  { jobId: "9fa5828c-d58d-4258-95b7-a8f84d9345eb", companyId: "9d367af6-d7e4-4726-ba37-987e23167881" },
];

const res = await fetch(`${base}/api/integrations/chatgpt/career/jobs/link`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${secret}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  },
  body: JSON.stringify({ links }),
});
const text = await res.text();
let json;
try {
  json = JSON.parse(text);
} catch {
  json = { raw: text.slice(0, 500) };
}
console.log("status", res.status, JSON.stringify(json));
if (!res.ok) process.exit(1);

const jobs = await fetch(`${base}/api/integrations/chatgpt/career/jobs?limit=50`, {
  headers: { Authorization: `Bearer ${secret}`, Accept: "application/json" },
});
const jobsJson = await jobs.json();
const wanted = new Set(links.map((l) => l.jobId));
const linked = (jobsJson.items || []).filter((row) => wanted.has(row.id));
for (const row of linked) {
  console.log("job", row.id, "company_id", row.company_id, "company_name", row.company_name);
}
