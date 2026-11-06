import type { NexMetaAnalysisV1 } from "@/lib/meta-export";

/** Filtra campanhas/conjuntos/anúncios preservando relações pai→filho. */
export function filterMetaExportByCampaignIds(
  payload: NexMetaAnalysisV1,
  campaignIds: string[],
): NexMetaAnalysisV1 {
  if (!campaignIds.length) return payload;
  const selected = new Set(campaignIds);
  return {
    ...payload,
    campaigns: payload.campaigns.filter((row) => selected.has(row.id)),
    adsets: payload.adsets.filter((row) => selected.has(row.campaign_id)),
    ads: payload.ads.filter((row) => selected.has(row.campaign_id)),
  };
}
