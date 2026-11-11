export function teamChannelsAfterRemoval(channelIds: readonly string[], removedChannelId: string) {
  return [...new Set(channelIds.filter((id) => id && id !== removedChannelId))];
}

export function teamNeedsChannel(channelIds: readonly string[]) {
  return channelIds.filter(Boolean).length === 0;
}

/**
 * Quem tem equipe/canal configurado fica restrito a esses canais (ver e responder).
 * Admin sem equipe continua com visão total. Atendente sem equipe não vê canais.
 */
export function attendantChannelScope(input: { admin: boolean; teamConnectionIds: readonly string[] }): "all" | "restricted" {
  if (input.teamConnectionIds.some(Boolean)) return "restricted";
  return input.admin ? "all" : "restricted";
}
