import type { NexMetaAnalysisV1 } from "@/lib/meta-export";
import type { AnalysisObjectives } from "@/lib/nex-intelligence/goals/types";

function ratio(n: number, d: number) {
  if (!d) return null;
  return Number((n / d).toFixed(6));
}

function ctrPct(clicks: number, impressions: number) {
  const r = ratio(clicks, impressions);
  return r == null ? null : Number((r * 100).toFixed(6));
}

function cpm(spend: number, impressions: number) {
  const r = ratio(spend, impressions);
  return r == null ? null : Number((r * 1000).toFixed(6));
}

type InsightInput = {
  spend: number;
  impressions: number;
  clicks: number;
  results: number;
  reach?: number;
  frequency?: number | null;
};

function insights(input: InsightInput) {
  const reach = input.reach ?? Math.floor(input.impressions * 0.75);
  return {
    spend: input.spend,
    impressions: input.impressions,
    reach,
    frequency: input.frequency ?? (reach ? Number((input.impressions / reach).toFixed(4)) : null),
    clicks: input.clicks,
    link_clicks: input.clicks,
    ctr: ctrPct(input.clicks, input.impressions),
    link_ctr: ctrPct(input.clicks, input.impressions),
    cpc: ratio(input.spend, input.clicks),
    link_cpc: ratio(input.spend, input.clicks),
    cpm: cpm(input.spend, input.impressions),
    results: input.results,
    cost_per_result: ratio(input.spend, input.results),
  };
}

function daily(
  date: string,
  spend: number,
  impressions: number,
  clicks: number,
  results: number,
) {
  return {
    date,
    spend,
    impressions,
    reach: Math.floor(impressions * 0.75),
    clicks,
    link_clicks: clicks,
    results,
  };
}

/**
 * Fixture multinível determinística para homologação orientada a objetivos.
 *
 * Campanhas:
 * - camp_eff: WhatsApp, CPR baixo, volume limitado (cenário E)
 * - camp_costly: WhatsApp, CPR alto vs camp_eff (cenário A)
 * - camp_leads: evento incompatível LEAD (cenário F)
 *
 * Conjuntos/anúncios cobrem CTR em queda (B), CPC+CPM altos (C),
 * CTR bom sem resultados (D), dados insuficientes (G/H/J).
 */
export function buildGoalsMultilevelFixture(): NexMetaAnalysisV1 {
  return {
    schema_version: "1.0.0",
    metadata: {
      source: "NEX",
      exported_at: "2026-11-06T12:00:00.000Z",
      currency: "BRL",
      data_status: "live",
      organization_id: "org-goals-e2e",
      client_name: "Homologação Objetivos",
    },
    account: { id: "act_goals_e2e", name: "Conta Homologação Objetivos" },
    period: { since: "2026-10-30", until: "2026-11-05", timezone: "America/Sao_Paulo" },
    attribution: {
      setting: "7d_click",
      note: "Atribuição unificada da fixture",
    },
    campaigns: [
      {
        id: "camp_eff",
        name: "WhatsApp Eficiente",
        objective: "OUTCOME_ENGAGEMENT",
        status: "ACTIVE",
        effective_status: "ACTIVE",
        buying_type: "AUCTION",
        daily_budget: 80,
        lifetime_budget: null,
        optimization_goal: "CONVERSATIONS",
        result_metric: "onsite_conversion.messaging_conversation_started_7d",
        insights: insights({ spend: 120, impressions: 20000, clicks: 400, results: 40 }),
        // CPR = 3.0 — melhor eficiência
        daily_insights: [
          daily("2026-10-30", 20, 3000, 60, 7),
          daily("2026-11-01", 20, 3000, 60, 7),
          daily("2026-11-03", 40, 7000, 140, 13),
          daily("2026-11-05", 40, 7000, 140, 13),
        ],
        attribution_setting: "7d_click",
      },
      {
        id: "camp_costly",
        name: "WhatsApp Caro",
        objective: "OUTCOME_ENGAGEMENT",
        status: "ACTIVE",
        effective_status: "ACTIVE",
        buying_type: "AUCTION",
        daily_budget: 150,
        lifetime_budget: null,
        optimization_goal: "CONVERSATIONS",
        result_metric: "onsite_conversion.messaging_conversation_started_7d",
        insights: insights({ spend: 300, impressions: 25000, clicks: 250, results: 20 }),
        // CPR = 15.0 — pior que camp_eff (A)
        daily_insights: [
          daily("2026-10-30", 50, 4000, 50, 4),
          daily("2026-11-01", 50, 4000, 50, 4),
          daily("2026-11-03", 100, 8500, 75, 6),
          daily("2026-11-05", 100, 8500, 75, 6),
        ],
        attribution_setting: "7d_click",
      },
      {
        id: "camp_leads",
        name: "Leads Site (evento incompatível)",
        objective: "OUTCOME_LEADS",
        status: "ACTIVE",
        effective_status: "ACTIVE",
        buying_type: "AUCTION",
        daily_budget: 100,
        lifetime_budget: null,
        optimization_goal: "LEAD_GENERATION",
        result_metric: "lead",
        insights: insights({ spend: 200, impressions: 18000, clicks: 180, results: 18 }),
        daily_insights: [
          daily("2026-10-30", 50, 4500, 45, 4),
          daily("2026-11-05", 150, 13500, 135, 14),
        ],
        attribution_setting: "7d_click",
      },
    ],
    adsets: [
      {
        id: "adset_eff_a",
        campaign_id: "camp_eff",
        name: "Conjunto Eficiente A",
        status: "ACTIVE",
        effective_status: "ACTIVE",
        optimization_goal: "CONVERSATIONS",
        billing_event: "IMPRESSIONS",
        daily_budget: 40,
        lifetime_budget: null,
        targeting_summary: "lookalike 1%",
        placements: ["facebook", "instagram"],
        attribution_setting: "7d_click",
        insights: insights({ spend: 70, impressions: 12000, clicks: 260, results: 28 }),
        daily_insights: [],
      },
      {
        id: "adset_eff_b",
        campaign_id: "camp_eff",
        name: "Conjunto Eficiente B",
        status: "ACTIVE",
        effective_status: "ACTIVE",
        optimization_goal: "CONVERSATIONS",
        billing_event: "IMPRESSIONS",
        daily_budget: 40,
        lifetime_budget: null,
        targeting_summary: "interesses genéricos",
        placements: ["facebook"],
        attribution_setting: "7d_click",
        insights: insights({ spend: 50, impressions: 8000, clicks: 140, results: 12 }),
        daily_insights: [],
      },
      {
        id: "adset_costly_hot",
        campaign_id: "camp_costly",
        name: "Conjunto CPC/CPM altos",
        status: "ACTIVE",
        effective_status: "ACTIVE",
        optimization_goal: "CONVERSATIONS",
        billing_event: "IMPRESSIONS",
        daily_budget: 90,
        lifetime_budget: null,
        targeting_summary: "amplo",
        placements: ["facebook", "instagram", "audience_network"],
        attribution_setting: "7d_click",
        // CPC alto + CPM alto (C) — reconciliado com ad_costly_high_cpc
        insights: insights({
          spend: 200,
          impressions: 8000,
          clicks: 40,
          results: 12,
          frequency: 3.8,
        }),
        daily_insights: [],
      },
      {
        id: "adset_costly_ok",
        campaign_id: "camp_costly",
        name: "Conjunto relativo melhor",
        status: "ACTIVE",
        effective_status: "ACTIVE",
        optimization_goal: "CONVERSATIONS",
        billing_event: "IMPRESSIONS",
        daily_budget: 60,
        lifetime_budget: null,
        targeting_summary: "retargeting",
        placements: ["instagram"],
        attribution_setting: "7d_click",
        // Reconciliado com ad_costly_ctr_no_results (results 8; CTR alto)
        insights: insights({ spend: 100, impressions: 17000, clicks: 850, results: 8 }),
        daily_insights: [],
      },
      {
        id: "adset_leads_a",
        campaign_id: "camp_leads",
        name: "Conjunto Leads A",
        status: "ACTIVE",
        effective_status: "ACTIVE",
        optimization_goal: "LEAD_GENERATION",
        billing_event: "IMPRESSIONS",
        daily_budget: 50,
        lifetime_budget: null,
        targeting_summary: "formulário",
        placements: ["facebook"],
        attribution_setting: "7d_click",
        insights: insights({ spend: 100, impressions: 9000, clicks: 90, results: 10 }),
        daily_insights: [],
      },
      {
        id: "adset_leads_b",
        campaign_id: "camp_leads",
        name: "Conjunto Leads B (dados fracos)",
        status: "ACTIVE",
        effective_status: "ACTIVE",
        optimization_goal: "LEAD_GENERATION",
        billing_event: "IMPRESSIONS",
        daily_budget: 50,
        lifetime_budget: null,
        targeting_summary: "teste",
        placements: ["instagram"],
        attribution_setting: "7d_click",
        // Volume baixo / insuficiente para intervenção (G/J)
        insights: insights({ spend: 100, impressions: 9000, clicks: 90, results: 8 }),
        daily_insights: [],
      },
    ],
    ads: [
      {
        id: "ad_eff_stable",
        campaign_id: "camp_eff",
        adset_id: "adset_eff_a",
        name: "Criativo estável",
        status: "ACTIVE",
        effective_status: "ACTIVE",
        creative: {
          id: "cr_eff_1",
          format: "IMAGE",
          headline: "Fale conosco",
          body: "WhatsApp",
          destination_type: "WHATSAPP",
        },
        insights: insights({ spend: 40, impressions: 7000, clicks: 180, results: 18 }),
        daily_insights: [
          daily("2026-10-30", 10, 1750, 45, 4),
          daily("2026-11-05", 30, 5250, 135, 14),
        ],
      },
      {
        id: "ad_eff_ctr_drop",
        campaign_id: "camp_eff",
        adset_id: "adset_eff_a",
        name: "Criativo com CTR em queda",
        status: "ACTIVE",
        effective_status: "ACTIVE",
        creative: {
          id: "cr_eff_2",
          format: "VIDEO",
          headline: "Oferta",
          body: "Vídeo",
          destination_type: "WHATSAPP",
        },
        // CTR deterioração temporal verificável (B): início alto → fim baixo
        insights: insights({ spend: 30, impressions: 5000, clicks: 80, results: 10 }),
        daily_insights: [
          daily("2026-10-30", 10, 1000, 40, 4), // CTR 4%
          daily("2026-11-01", 10, 1500, 30, 3), // CTR 2%
          daily("2026-11-05", 10, 2500, 10, 3), // CTR 0.4%
        ],
      },
      {
        // Completa adset_eff_b / camp_eff (results 12 + spend 50) para reconciliar ads×campanha.
        id: "ad_eff_b",
        campaign_id: "camp_eff",
        adset_id: "adset_eff_b",
        name: "Criativo conjunto B",
        status: "ACTIVE",
        effective_status: "ACTIVE",
        creative: {
          id: "cr_eff_3",
          format: "IMAGE",
          headline: "WhatsApp B",
          body: "Conjunto B",
          destination_type: "WHATSAPP",
        },
        insights: insights({ spend: 50, impressions: 8000, clicks: 140, results: 12 }),
        daily_insights: [],
      },
      {
        id: "ad_costly_high_cpc",
        campaign_id: "camp_costly",
        adset_id: "adset_costly_hot",
        name: "Anúncio CPC alto",
        status: "ACTIVE",
        effective_status: "ACTIVE",
        creative: {
          id: "cr_cost_1",
          format: "IMAGE",
          headline: "Clique",
          body: "Genérico",
          destination_type: "WHATSAPP",
        },
        insights: insights({
          spend: 200,
          impressions: 8000,
          clicks: 40,
          results: 12,
          frequency: 4.2,
        }),
        daily_insights: [],
      },
      {
        id: "ad_costly_ctr_no_results",
        campaign_id: "camp_costly",
        adset_id: "adset_costly_ok",
        name: "CTR bom, poucos resultados",
        status: "ACTIVE",
        effective_status: "ACTIVE",
        creative: {
          id: "cr_cost_2",
          format: "IMAGE",
          headline: "Engaja",
          body: "Clickbait",
          destination_type: "WHATSAPP",
        },
        // CTR alto (~5%), resultados baixos relativos ao spend (D) — total ads = 20 (= campanha)
        insights: insights({ spend: 100, impressions: 17000, clicks: 850, results: 8 }),
        daily_insights: [],
      },
      {
        id: "ad_leads_ok",
        campaign_id: "camp_leads",
        adset_id: "adset_leads_a",
        name: "Lead criativo A",
        status: "ACTIVE",
        effective_status: "ACTIVE",
        creative: {
          id: "cr_lead_1",
          format: "IMAGE",
          headline: "Cadastre-se",
          body: "Form",
          destination_type: "WEBSITE",
        },
        insights: insights({ spend: 100, impressions: 9000, clicks: 90, results: 10 }),
        daily_insights: [],
      },
      {
        id: "ad_leads_missing",
        campaign_id: "camp_leads",
        adset_id: "adset_leads_b",
        name: "Lead com métricas ausentes",
        status: "ACTIVE",
        effective_status: "ACTIVE",
        creative: {
          id: "cr_lead_2",
          format: "IMAGE",
          headline: "Incompleto",
          body: null,
          destination_type: "WEBSITE",
        },
        // insights null → NOT_VERIFIABLE / insuficiência (H)
        insights: null,
        daily_insights: [],
      },
    ],
    business_outcomes: {
      leads_received: null,
      qualified_leads: null,
      appointments: null,
      sales: null,
      revenue: null,
    },
    warnings: [
      "Fixture: camp_leads usa result_metric=lead; não agregar com messaging_conversation_started_7d.",
    ],
  };
}

export function withObjectives(
  payload: NexMetaAnalysisV1,
  objectives: AnalysisObjectives,
): NexMetaAnalysisV1 {
  return {
    ...payload,
    metadata: {
      ...payload.metadata,
      analysis_objectives: objectives,
    },
  };
}

/** Expectativas matemáticas da fixture (para asserts). */
export const FIXTURE_MATH = {
  campEffCpr: 120 / 40, // 3
  campCostlyCpr: 300 / 20, // 15
  adCtrDropDays: [
    { date: "2026-10-30", ctr: 4 },
    { date: "2026-11-01", ctr: 2 },
    { date: "2026-11-05", ctr: 0.4 },
  ],
  adHighCtrLowResults: {
    id: "ad_costly_ctr_no_results",
    ctr: (500 / 10000) * 100,
    results: 2,
  },
  incompatibleEvents: {
    whatsapp: "onsite_conversion.messaging_conversation_started_7d",
    leads: "lead",
  },
} as const;
