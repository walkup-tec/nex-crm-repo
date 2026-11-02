import { META_AI_ENGINE_VERSION, META_AI_PROTOCOL_VERSION } from "@/intelligence/meta-leads/protocol";
import type { NexMetaAnalysisV1 } from "@/lib/meta-export";
import {
  MONEY_ROUNDING_TOLERANCE_CENTS,
  computeAccountMetricsFromCampaignSpend,
  fromMoneyCents,
  moneyDiffCents,
  sumMoneyCents,
  sumNullableNumbers,
  type AccountComputedMetrics,
} from "@/lib/meta-metrics";

export { META_AI_ENGINE_VERSION };

export type DataQualityStatus = "PASS" | "WARNING" | "FAIL" | "NOT_VERIFIABLE";

export type DataQualityCheck = {
  code: string;
  level: "account" | "campaign" | "adset" | "ad";
  entity_id: string | null;
  metric: string;
  consolidated_value: number | string | null;
  compared_value: number | string | null;
  absolute_diff: number | null;
  relative_diff: number | null;
  severity: DataQualityStatus;
  description: string;
  possible_causes: string[];
  state: DataQualityStatus;
};

export type MetaDataQualityReport = {
  status: DataQualityStatus;
  engine_version: string;
  protocol_version: string;
  validated_at: string;
  checks: DataQualityCheck[];
  affected_metrics: string[];
  compromised_metrics: string[];
  verified_metrics: string[];
  computed_metrics: AccountComputedMetrics;
};

const STATUS_RANK: Record<DataQualityStatus, number> = {
  PASS: 0,
  WARNING: 1,
  NOT_VERIFIABLE: 2,
  FAIL: 3,
};

function worstStatus(states: DataQualityStatus[]): DataQualityStatus {
  return states.reduce((worst, state) => (STATUS_RANK[state] > STATUS_RANK[worst] ? state : worst), "PASS");
}

function relDiff(a: number | null, b: number | null): number | null {
  if (a == null || b == null) return null;
  const base = Math.max(Math.abs(a), Math.abs(b));
  if (base === 0) return 0;
  return Number((Math.abs(a - b) / base).toFixed(6));
}

function check(input: Omit<DataQualityCheck, "state"> & { state?: DataQualityStatus }): DataQualityCheck {
  const state = input.state ?? input.severity;
  return { ...input, state, severity: state };
}

function uniqueIds(ids: string[]) {
  const seen = new Set<string>();
  const dupes: string[] = [];
  for (const id of ids) {
    if (seen.has(id)) dupes.push(id);
    else seen.add(id);
  }
  return { seen, dupes };
}

/**
 * Validação determinística pré-IA do contrato NEX Meta Analysis V1.
 * Não usa dados comerciais externos (business_outcomes é ignorado).
 */
export function validateMetaAnalysisData(
  payload: NexMetaAnalysisV1,
  options: { protocolVersion?: string; engineVersion?: string; now?: string } = {},
): MetaDataQualityReport {
  const checks: DataQualityCheck[] = [];
  const campaignIds = payload.campaigns.map((item) => item.id);
  const adsetIds = payload.adsets.map((item) => item.id);
  const adIds = payload.ads.map((item) => item.id);
  const campaignSet = new Set(campaignIds);
  const adsetSet = new Set(adsetIds);

  const campaignDupes = uniqueIds(campaignIds).dupes;
  const adsetDupes = uniqueIds(adsetIds).dupes;
  const adDupes = uniqueIds(adIds).dupes;
  if (campaignDupes.length || adsetDupes.length || adDupes.length) {
    checks.push(
      check({
        code: "ID_UNIQUE",
        level: "account",
        entity_id: payload.account.id,
        metric: "entity_id",
        consolidated_value: null,
        compared_value: [...campaignDupes, ...adsetDupes, ...adDupes].join(","),
        absolute_diff: null,
        relative_diff: null,
        severity: "FAIL",
        description: "IDs duplicados na mesma coleção.",
        possible_causes: ["Duplicação na transformação", "Paginação repetida"],
      }),
    );
  } else {
    checks.push(
      check({
        code: "ID_UNIQUE",
        level: "account",
        entity_id: payload.account.id,
        metric: "entity_id",
        consolidated_value: campaignIds.length + adsetIds.length + adIds.length,
        compared_value: null,
        absolute_diff: null,
        relative_diff: null,
        severity: "PASS",
        description: "Identificadores únicos nas coleções.",
        possible_causes: [],
      }),
    );
  }

  for (const adset of payload.adsets) {
    if (!campaignSet.has(adset.campaign_id)) {
      checks.push(
        check({
          code: "HIERARCHY_ADSET_CAMPAIGN",
          level: "adset",
          entity_id: adset.id,
          metric: "campaign_id",
          consolidated_value: adset.campaign_id,
          compared_value: null,
          absolute_diff: null,
          relative_diff: null,
          severity: "WARNING",
          description: "Conjunto referencia campanha ausente na coleção.",
          possible_causes: ["Paginação incompleta de campanhas", "Filtro de status"],
        }),
      );
    }
  }

  for (const ad of payload.ads) {
    if (!campaignSet.has(ad.campaign_id)) {
      checks.push(
        check({
          code: "HIERARCHY_AD_CAMPAIGN",
          level: "ad",
          entity_id: ad.id,
          metric: "campaign_id",
          consolidated_value: ad.campaign_id,
          compared_value: null,
          absolute_diff: null,
          relative_diff: null,
          severity: "WARNING",
          description: "Anúncio referencia campanha ausente na coleção.",
          possible_causes: ["Paginação incompleta", "Filtro de status"],
        }),
      );
    }
    if (!adsetSet.has(ad.adset_id)) {
      checks.push(
        check({
          code: "HIERARCHY_AD_ADSET",
          level: "ad",
          entity_id: ad.id,
          metric: "adset_id",
          consolidated_value: ad.adset_id,
          compared_value: null,
          absolute_diff: null,
          relative_diff: null,
          severity: "WARNING",
          description: "Anúncio referencia conjunto ausente na coleção de adsets.",
          possible_causes: [
            "Paginação incompleta de conjuntos",
            "Conjunto arquivado/excluído não listado",
            "Filtros diferentes entre /ads e /adsets",
          ],
        }),
      );
    }
  }

  const computed = computeAccountMetricsFromCampaignSpend(
    payload.campaigns.map((item) => item.insights?.spend ?? null),
    {
      currency: payload.metadata.currency,
      impressions: payload.campaigns.map((item) => item.insights?.impressions ?? null),
      clicks: payload.campaigns.map((item) => item.insights?.clicks ?? null),
      results: payload.campaigns.map((item) => item.insights?.results ?? null),
    },
  );

  checks.push(
    check({
      code: "ACCOUNT_SPEND_TOTAL",
      level: "account",
      entity_id: payload.account.id,
      metric: "spend",
      consolidated_value: computed.spend_total,
      compared_value: computed.spend_total_cents,
      absolute_diff: null,
      relative_diff: null,
      severity: computed.spend_total == null ? "NOT_VERIFIABLE" : "PASS",
      description:
        computed.spend_total == null
          ? "Investimento total não calculável (sem spend de campanha)."
          : `Investimento total determinístico: ${computed.spend_total} ${computed.currency}.`,
      possible_causes: computed.spend_total == null ? ["Campanhas sem insights.spend"] : [],
    }),
  );

  for (const campaign of payload.campaigns) {
    const consolidated = campaign.insights?.results ?? null;
    const dailySum = sumNullableNumbers(campaign.daily_insights.map((day) => day.results));
    const adResults = sumNullableNumbers(
      payload.ads.filter((ad) => ad.campaign_id === campaign.id).map((ad) => ad.insights?.results ?? null),
    );
    const hasDaily = campaign.daily_insights.some((day) => day.results != null);
    const hasAds = payload.ads.some((ad) => ad.campaign_id === campaign.id && ad.insights?.results != null);

    if (consolidated == null && !hasDaily && !hasAds) {
      checks.push(
        check({
          code: "CAMPAIGN_RESULTS_EMPTY",
          level: "campaign",
          entity_id: campaign.id,
          metric: "results",
          consolidated_value: null,
          compared_value: null,
          absolute_diff: null,
          relative_diff: null,
          severity: "NOT_VERIFIABLE",
          description: "Campanha sem resultados consolidados, diários ou de anúncios.",
          possible_causes: ["Sem entrega", "Evento de resultado não mapeado"],
        }),
      );
      continue;
    }

    if (consolidated != null && hasDaily && dailySum != null && consolidated !== dailySum) {
      // Resultados diários de messaging frequentemente não são aditivos ao consolidado.
      const metric = campaign.result_metric ?? "";
      const messagingLike = /messaging|conversation|reply/i.test(metric);
      checks.push(
        check({
          code: "CAMPAIGN_RESULTS_DAILY_VS_CONSOLIDATED",
          level: "campaign",
          entity_id: campaign.id,
          metric: "results",
          consolidated_value: consolidated,
          compared_value: dailySum,
          absolute_diff: Math.abs(consolidated - dailySum),
          relative_diff: relDiff(consolidated, dailySum),
          severity: messagingLike ? "NOT_VERIFIABLE" : "WARNING",
          description: `Resultados consolidados (${consolidated}) ≠ soma diária (${dailySum}).`,
          possible_causes: [
            "Métrica não aditiva entre dias",
            "Seleção diferente de action_type por dia",
            "Campo results vs actions",
            "Atribuição/janela",
          ],
        }),
      );
    } else if (consolidated != null && hasDaily && dailySum != null) {
      checks.push(
        check({
          code: "CAMPAIGN_RESULTS_DAILY_VS_CONSOLIDATED",
          level: "campaign",
          entity_id: campaign.id,
          metric: "results",
          consolidated_value: consolidated,
          compared_value: dailySum,
          absolute_diff: 0,
          relative_diff: 0,
          severity: "PASS",
          description: "Resultados consolidados alinhados à soma diária.",
          possible_causes: [],
        }),
      );
    } else if (consolidated != null && !hasDaily) {
      checks.push(
        check({
          code: "CAMPAIGN_RESULTS_DAILY_VS_CONSOLIDATED",
          level: "campaign",
          entity_id: campaign.id,
          metric: "results",
          consolidated_value: consolidated,
          compared_value: null,
          absolute_diff: null,
          relative_diff: null,
          severity: "NOT_VERIFIABLE",
          description: "Sem série diária comparável para validar resultados.",
          possible_causes: ["Daily insights ausentes"],
        }),
      );
    }

    if (consolidated != null && hasAds && adResults != null && consolidated !== adResults) {
      checks.push(
        check({
          code: "CAMPAIGN_RESULTS_ADS_VS_CONSOLIDATED",
          level: "campaign",
          entity_id: campaign.id,
          metric: "results",
          consolidated_value: consolidated,
          compared_value: adResults,
          absolute_diff: Math.abs(consolidated - adResults),
          relative_diff: relDiff(consolidated, adResults),
          severity: "WARNING",
          description: `Resultados da campanha (${consolidated}) ≠ soma dos anúncios (${adResults}).`,
          possible_causes: [
            "Anúncios incompletos na coleta",
            "Resultados não aditivos entre anúncios",
            "action_type diferente por nível",
          ],
        }),
      );
    }
  }

  for (const adset of payload.adsets) {
    const adsetSpend = adset.insights?.spend ?? null;
    const adsOfSet = payload.ads.filter((ad) => ad.adset_id === adset.id);
    const adsSpendCents = sumMoneyCents(adsOfSet.map((ad) => ad.insights?.spend ?? null));
    const adsSpend = fromMoneyCents(adsSpendCents);
    const diffCents = moneyDiffCents(adsetSpend, adsSpend);

    if (adsetSpend == null && adsSpend == null) {
      checks.push(
        check({
          code: "ADSET_SPEND_VS_ADS",
          level: "adset",
          entity_id: adset.id,
          metric: "spend",
          consolidated_value: null,
          compared_value: null,
          absolute_diff: null,
          relative_diff: null,
          severity: "NOT_VERIFIABLE",
          description: "Sem investimento no conjunto nem nos anúncios.",
          possible_causes: ["Sem entrega no período"],
        }),
      );
      continue;
    }

    if (adsetSpend != null && adsOfSet.length === 0) {
      checks.push(
        check({
          code: "ADSET_SPEND_VS_ADS",
          level: "adset",
          entity_id: adset.id,
          metric: "spend",
          consolidated_value: adsetSpend,
          compared_value: null,
          absolute_diff: null,
          relative_diff: null,
          severity: "WARNING",
          description: "Conjunto com investimento sem anúncios recuperados.",
          possible_causes: ["Paginação incompleta de ads", "Filtro de status", "Anúncios excluídos"],
        }),
      );
      continue;
    }

    if (diffCents == null) {
      checks.push(
        check({
          code: "ADSET_SPEND_VS_ADS",
          level: "adset",
          entity_id: adset.id,
          metric: "spend",
          consolidated_value: adsetSpend,
          compared_value: adsSpend,
          absolute_diff: null,
          relative_diff: null,
          severity: "NOT_VERIFIABLE",
          description: "Não foi possível comparar investimento conjunto × anúncios.",
          possible_causes: ["Spend ausente em um dos lados"],
        }),
      );
      continue;
    }

    const abs = Math.abs(diffCents);
    if (abs <= MONEY_ROUNDING_TOLERANCE_CENTS) {
      checks.push(
        check({
          code: "ADSET_SPEND_VS_ADS",
          level: "adset",
          entity_id: adset.id,
          metric: "spend",
          consolidated_value: adsetSpend,
          compared_value: adsSpend,
          absolute_diff: fromMoneyCents(abs),
          relative_diff: relDiff(adsetSpend, adsSpend),
          severity: "PASS",
          description: "Investimento do conjunto reconciliável com a soma dos anúncios.",
          possible_causes: [],
        }),
      );
    } else {
      checks.push(
        check({
          code: "ADSET_SPEND_VS_ADS",
          level: "adset",
          entity_id: adset.id,
          metric: "spend",
          consolidated_value: adsetSpend,
          compared_value: adsSpend,
          absolute_diff: fromMoneyCents(abs),
          relative_diff: relDiff(adsetSpend, adsSpend),
          severity: "WARNING",
          description: `Diferença de investimento conjunto × anúncios: R$ ${fromMoneyCents(abs)}. Completude dos anúncios deve ser verificada antes de tratar como erro definitivo.`,
          possible_causes: [
            "Anúncios com entrega não recuperados",
            "Paginação truncada",
            "Anúncios pausados/arquivados/excluídos omitidos",
          ],
        }),
      );
    }
  }

  for (const campaign of payload.campaigns) {
    const empty =
      campaign.insights?.spend == null &&
      campaign.insights?.impressions == null &&
      campaign.insights?.results == null;
    if (empty) {
      checks.push(
        check({
          code: "CAMPAIGN_METRICS_ABSENT",
          level: "campaign",
          entity_id: campaign.id,
          metric: "insights",
          consolidated_value: null,
          compared_value: null,
          absolute_diff: null,
          relative_diff: null,
          severity: "NOT_VERIFIABLE",
          description: "Campanha sem spend, impressões e resultados — não inventar taxas/custos.",
          possible_causes: ["Sem entrega", "Insights não retornados"],
        }),
      );
    }
  }

  // business_outcomes externos não influenciam validação (escopo Meta-only).
  void payload.business_outcomes;

  const status = worstStatus(checks.map((item) => item.state));
  const compromised = [
    ...new Set(
      checks
        .filter((item) => item.state === "FAIL" || item.state === "WARNING")
        .map((item) => item.metric),
    ),
  ];
  const verified = [
    ...new Set(checks.filter((item) => item.state === "PASS").map((item) => item.metric)),
  ].filter((metric) => !compromised.includes(metric));

  return {
    status,
    engine_version: options.engineVersion ?? META_AI_ENGINE_VERSION,
    protocol_version: options.protocolVersion ?? META_AI_PROTOCOL_VERSION,
    validated_at: options.now ?? new Date().toISOString(),
    checks,
    affected_metrics: [...new Set(checks.filter((item) => item.state !== "PASS").map((item) => item.metric))],
    compromised_metrics: compromised,
    verified_metrics: verified,
    computed_metrics: computed,
  };
}

export function attachDataQuality(
  payload: NexMetaAnalysisV1,
  report: MetaDataQualityReport,
): NexMetaAnalysisV1 & {
  data_quality: MetaDataQualityReport;
  computed_metrics: AccountComputedMetrics;
} {
  return {
    ...payload,
    data_quality: report,
    computed_metrics: report.computed_metrics,
  };
}

export function recommendationBlockedForMetric(
  report: MetaDataQualityReport,
  metric: string,
): boolean {
  return report.compromised_metrics.includes(metric);
}
