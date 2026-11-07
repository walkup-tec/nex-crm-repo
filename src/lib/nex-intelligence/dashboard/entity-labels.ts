import type { NexMetaAnalysisV1 } from "@/lib/meta-export";

export type EntityDisplayLevel = "account" | "campaign" | "adset" | "ad";

const LEVEL_LABEL: Record<EntityDisplayLevel, string> = {
  account: "Conta",
  campaign: "Campanha",
  adset: "Conjunto",
  ad: "Anúncio",
};

export function entityLevelLabel(level: string | null | undefined): string {
  if (!level) return "Entidade";
  return LEVEL_LABEL[level as EntityDisplayLevel] ?? level;
}

/** Resolve nome amigável; se ausente, devolve o próprio id. */
export function resolveEntityDisplayName(
  payload: NexMetaAnalysisV1 | null | undefined,
  level: string | null | undefined,
  entityId: string | null | undefined,
): string | null {
  if (!entityId) return null;
  if (!payload || !level) return entityId;

  if (level === "account") {
    return payload.account?.name?.trim() || entityId;
  }
  if (level === "campaign") {
    return payload.campaigns.find((row) => row.id === entityId)?.name?.trim() || entityId;
  }
  if (level === "adset") {
    return payload.adsets.find((row) => row.id === entityId)?.name?.trim() || entityId;
  }
  if (level === "ad") {
    return payload.ads.find((row) => row.id === entityId)?.name?.trim() || entityId;
  }
  return entityId;
}

/** Hierarquia Campanha → Conjunto → entidade alvo para exibição na tarefa. */
export function resolveEntityHierarchy(
  payload: NexMetaAnalysisV1 | null | undefined,
  level: string | null | undefined,
  entityId: string | null | undefined,
): {
  campaignName: string | null;
  adsetName: string | null;
  entityName: string | null;
} {
  const entityName = resolveEntityDisplayName(payload, level, entityId);
  if (!payload || !level || !entityId) {
    return { campaignName: null, adsetName: null, entityName };
  }

  if (level === "campaign") {
    return { campaignName: entityName, adsetName: null, entityName };
  }

  if (level === "adset") {
    const adset = payload.adsets.find((row) => row.id === entityId);
    const campaignName = adset?.campaign_id
      ? resolveEntityDisplayName(payload, "campaign", adset.campaign_id)
      : null;
    return { campaignName, adsetName: entityName, entityName };
  }

  if (level === "ad") {
    const ad = payload.ads.find((row) => row.id === entityId);
    const adsetName = ad?.adset_id
      ? resolveEntityDisplayName(payload, "adset", ad.adset_id)
      : null;
    const campaignName = ad?.campaign_id
      ? resolveEntityDisplayName(payload, "campaign", ad.campaign_id)
      : null;
    return { campaignName, adsetName, entityName };
  }

  return { campaignName: null, adsetName: null, entityName };
}

/**
 * Troca IDs entre crases por nomes no texto da ação.
 * Mantém entity_id técnico intacto no claim; só a apresentação muda.
 */
export function humanizeEntityMentionsInText(
  text: string,
  payload: NexMetaAnalysisV1 | null | undefined,
): string {
  if (!text || !payload) return text;

  const namesById = new Map<string, string>();
  for (const row of payload.campaigns) {
    if (row.id && row.name?.trim()) namesById.set(row.id, row.name.trim());
  }
  for (const row of payload.adsets) {
    if (row.id && row.name?.trim()) namesById.set(row.id, row.name.trim());
  }
  for (const row of payload.ads) {
    if (row.id && row.name?.trim()) namesById.set(row.id, row.name.trim());
  }
  if (payload.account?.id && payload.account.name?.trim()) {
    namesById.set(payload.account.id, payload.account.name.trim());
  }

  let out = text.replace(/`([^`]+)`/g, (_full, id: string) => {
    const name = namesById.get(id);
    return name ? `“${name}”` : `\`${id}\``;
  });

  // IDs Meta longos sem crase (tarefas já persistidas / candidatos antigos).
  const ids = [...namesById.keys()].sort((a, b) => b.length - a.length);
  for (const id of ids) {
    if (id.length < 10 || !out.includes(id)) continue;
    const name = namesById.get(id)!;
    out = out.split(id).join(`“${name}”`);
  }
  return out;
}
