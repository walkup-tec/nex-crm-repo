export function teamChannelsAfterRemoval(channelIds: readonly string[], removedChannelId: string) {
  return [...new Set(channelIds.filter((id) => id && id !== removedChannelId))];
}

export function teamNeedsChannel(channelIds: readonly string[]) {
  return channelIds.filter(Boolean).length === 0;
}

/**
 * Admin (master/client_admin) sempre vê todos os canais.
 * Atendente comum fica restrito aos canais das equipes em que está.
 */
export function attendantChannelScope(input: { admin: boolean; teamConnectionIds: readonly string[] }): "all" | "restricted" {
  if (input.admin) return "all";
  return "restricted";
}
