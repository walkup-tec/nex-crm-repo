const testAccountId = "886574174420761";
const testCents = 2000;

export function lowBalanceTestCents(accountId: string | null | undefined) {
  const digits = (accountId ?? "").trim().replace(/^act_/i, "");
  return digits === testAccountId ? testCents : null;
}
