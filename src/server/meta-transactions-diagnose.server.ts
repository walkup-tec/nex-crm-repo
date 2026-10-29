import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { diagnoseAccountTransactions } from "@/server/meta.server";

const accountDigits = "886574174420761";

export async function runTransactionsDiagnose() {
  try {
    const found = await supabaseAdmin.from("meta_accounts").select("organization_id, external_account_id");
    if (found.error) {
      console.info(`meta_transactions_diagnose ${JSON.stringify({ account: accountDigits, found: false, reason: "consulta" })}`);
      return;
    }
    const match = (found.data ?? []).find(
      (row) => String(row.external_account_id ?? "").replace(/^act_/i, "") === accountDigits,
    );
    if (!match?.organization_id) {
      console.info(`meta_transactions_diagnose ${JSON.stringify({ account: accountDigits, found: false })}`);
      return;
    }
    const report = await diagnoseAccountTransactions(match.organization_id, accountDigits);
    console.info(`meta_transactions_diagnose ${JSON.stringify(report)}`);
  } catch {
    console.info(`meta_transactions_diagnose ${JSON.stringify({ account: accountDigits, failed: "read" })}`);
  }
}
