import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sanitizeAccountProbe } from "@/lib/meta-balance-probe";
import { probeAdAccountFields } from "@/server/meta.server";

const accountDigits = "886574174420761";
const accountFields = [
  "name,account_id,currency,balance,is_prepay_account,funding_source_details",
  "name,account_id,currency,balance,is_prepay_account",
  "name,account_id,currency,balance",
];
const spendFields = "spend_cap,amount_spent";

export async function runMetaBalanceProbe() {
  try {
    const report = await readProbe();
    console.info(`meta_balance_probe ${JSON.stringify(report)}`);
  } catch {
    console.info(`meta_balance_probe ${JSON.stringify({ account: accountDigits, failed: "read" })}`);
  }
}

async function readProbe() {
  const found = await supabaseAdmin.from("meta_accounts").select("organization_id, external_account_id");
  if (found.error) return { account: accountDigits, found: false, reason: "consulta" };
  const match = (found.data ?? []).find(
    (row) => String(row.external_account_id ?? "").replace(/^act_/i, "") === accountDigits,
  );
  if (!match?.organization_id) return { account: accountDigits, found: false };
  const attempts = [];
  let accountRead: ReturnType<typeof sanitizeAccountProbe> | null = null;
  for (const fields of accountFields) {
    const result = await probeAdAccountFields(match.organization_id, accountDigits, fields);
    if (!result.ok) {
      attempts.push({
        fields,
        ok: false,
        status: result.status,
        code: result.code,
        subcode: result.subcode,
        type: result.type,
        message: result.message,
      });
      continue;
    }
    accountRead = result.read;
    attempts.push({ fields, ok: true, keys: result.read.keys });
    break;
  }
  const spend = await probeAdAccountFields(match.organization_id, accountDigits, spendFields);
  const spendRead = spend.ok
    ? spend.read
    : {
        ok: false,
        status: spend.status,
        code: spend.code,
        subcode: spend.subcode,
        type: spend.type,
        message: spend.message,
      };
  return { account: accountDigits, found: true, attempts, accountRead, spendRead };
}
