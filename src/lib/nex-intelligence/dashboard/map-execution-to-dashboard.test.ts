import { describe, expect, it } from "vitest";
import type { MetaAiExecutionDetail } from "@/lib/meta-ai-calibration";
import { mapExecutionToDashboard } from "@/lib/nex-intelligence/dashboard/map-execution-to-dashboard";

function baseDetail(overrides?: Partial<MetaAiExecutionDetail>): MetaAiExecutionDetail {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    createdAt: "2026-11-05T12:00:00.000Z",
    status: "ok",
    organizationId: "22222222-2222-4222-8222-222222222222",
    clientName: "Cliente Demo",
    accountId: "act_1",
    accountName: "Conta Demo",
    periodSince: "2026-11-01",
    periodUntil: "2026-11-03",
    protocolVersion: "1.3.0",
    dataContractVersion: "1.0.0",
    model: "gpt-test",
    promptHash: "abc",
    warningCount: 0,
    periodTimezone: "America/Sao_Paulo",
    analysisMarkdown: "ok",
    warnings: [],
    errorMessage: "",
    inputJson: {
      schema_version: "1.0.0",
      metadata: {
        source: "NEX",
        exported_at: "2026-11-05T12:00:00.000Z",
        currency: "BRL",
        data_status: "live",
        organization_id: "22222222-2222-4222-8222-222222222222",
        client_name: "Cliente Demo",
      },
      account: { id: "act_1", name: "Conta Demo" },
      period: { since: "2026-11-01", until: "2026-11-03", timezone: "America/Sao_Paulo" },
      attribution: { setting: null, note: "" },
      campaigns: [
        {
          id: "camp_1",
          name: "Campanha A",
          objective: "OUTCOME_ENGAGEMENT",
          status: "ACTIVE",
          effective_status: "ACTIVE",
          buying_type: "AUCTION",
          daily_budget: null,
          lifetime_budget: null,
          optimization_goal: null,
          result_metric: "messaging_conversation_started_7d",
          insights: {
            spend: 100,
            impressions: 1000,
            reach: 800,
            frequency: 1.25,
            clicks: 50,
            link_clicks: 40,
            ctr: 5,
            link_ctr: 4,
            cpc: 2,
            link_cpc: 2.5,
            cpm: 100,
            results: 10,
            cost_per_result: 10,
          },
          daily_insights: [
            {
              date: "2026-11-01",
              spend: 40,
              impressions: 400,
              reach: 300,
              clicks: 16,
              link_clicks: 12,
              results: 3,
            },
            {
              date: "2026-11-02",
              spend: 60,
              impressions: 600,
              reach: 450,
              clicks: 34,
              link_clicks: 28,
              results: 7,
            },
          ],
          attribution_setting: null,
        },
      ],
      adsets: [],
      ads: [],
      business_outcomes: {
        leads_received: null,
        qualified_leads: null,
        appointments: null,
        sales: null,
        revenue: null,
      },
      warnings: [],
    },
    outputJson: {
      analytical_status: "COMPLETED",
      publication_status: "published",
      protocol_version: "1.3.0",
      claim_ir: {
        approved: [
          {
            claim_id: "c1",
            operation: "STRATEGIC_TEST",
            entity_level: "campaign",
            entity_id: "camp_1",
            evidence_level: "E3",
            args: {
              action_kind: "test",
              action: "Atualizar criativo",
              hypothesis: "CTR pode subir com novo criativo",
              validation_criterion: "CTR em 7 dias",
            },
          },
          {
            claim_id: "c2",
            operation: "METRIC_VALUE",
            entity_level: "campaign",
            entity_id: "camp_1",
            evidence_level: "E1",
            args: { metric: "spend" },
          },
        ],
      },
    },
    calibrationFeedback: {},
    ...overrides,
  };
}

describe("mapExecutionToDashboard", () => {
  it("mapeia métricas reais e não inventa zero quando ausente", () => {
    const view = mapExecutionToDashboard(baseDetail());
    const spend = view.metrics.find((row) => row.key === "spend");
    expect(spend?.value).toBe(100);
    expect(view.resultEventLabel).toBe("messaging_conversation_started_7d");
    expect(view.series).toHaveLength(2);
    expect(view.tasks).toHaveLength(1);
    expect(view.tasks[0]?.title).toBe("Atualizar criativo");
  });

  it("agrega múltiplas campanhas selecionadas sem inventar valor", () => {
    const detail = baseDetail();
    const input = detail.inputJson as {
      campaigns: Array<Record<string, unknown>>;
    };
    input.campaigns.push({
      ...input.campaigns[0],
      id: "camp_2",
      name: "Campanha B",
      insights: {
        ...(input.campaigns[0]!.insights as object),
        spend: 50,
        results: 5,
      },
      daily_insights: [],
    });
    const view = mapExecutionToDashboard(detail, { campaignIds: ["camp_1", "camp_2"] });
    expect(view.campaignName).toBe("2 campanhas");
    expect(view.metrics.find((row) => row.key === "spend")?.value).toBe(150);
  });

  it("não transforma METRIC_VALUE E1 em tarefa de otimização", () => {
    const view = mapExecutionToDashboard(baseDetail());
    expect(view.tasks.every((task) => task.claimId !== "c2")).toBe(true);
  });

  it("retorna view vazia sem inventar execução", () => {
    const view = mapExecutionToDashboard(null);
    expect(view.executionId).toBeNull();
    expect(view.metrics.every((metric) => metric.value === null)).toBe(true);
  });
});
