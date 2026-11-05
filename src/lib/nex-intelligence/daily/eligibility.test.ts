import { describe, expect, it } from "vitest";
import {
  evaluateDailyEligibility,
  intelligenceReferenceDate,
  shouldRunDailyJobAt,
} from "@/lib/nex-intelligence/daily/eligibility";

describe("intelligence daily eligibility", () => {
  it("exige assinante ativo com Meta operacional", () => {
    const org = { id: "o1", status: "active", adsMeta: true, legalName: "Demo" };
    const connections = [{ organizationId: "o1", status: "connected", hasToken: true }];
    expect(evaluateDailyEligibility(org, connections)).toEqual({ ok: true });
  });

  it("bloqueia inadimplente e sem token", () => {
    expect(
      evaluateDailyEligibility(
        { id: "o1", status: "overdue", adsMeta: true, legalName: "Demo" },
        [{ organizationId: "o1", status: "connected", hasToken: true }],
      ),
    ).toEqual({ ok: false, reason: "org_overdue" });

    expect(
      evaluateDailyEligibility(
        { id: "o1", status: "active", adsMeta: true, legalName: "Demo" },
        [{ organizationId: "o1", status: "connected", hasToken: false }],
      ),
    ).toEqual({ ok: false, reason: "meta_token_missing" });
  });

  it("calcula referência de ontem em en-CA", () => {
    // 2026-11-05 15:00 UTC ≈ 12:00 America/Sao_Paulo → ontem 2026-11-04
    const date = intelligenceReferenceDate(new Date("2026-11-05T15:00:00.000Z"));
    expect(date).toBe("2026-11-04");
  });

  it("só dispara uma vez por slot horário", () => {
    const atSeven = new Date("2026-11-05T10:05:00.000Z"); // 07:05 em São Paulo (UTC-3)
    const first = shouldRunDailyJobAt(atSeven, { hour: 7, lastRunKey: null });
    expect(first.run).toBe(true);
    const second = shouldRunDailyJobAt(atSeven, { hour: 7, lastRunKey: first.slotKey });
    expect(second.run).toBe(false);
  });
});
