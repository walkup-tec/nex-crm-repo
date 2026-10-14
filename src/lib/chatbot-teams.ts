export function teamChannelsAfterRemoval(channelIds: readonly string[], removedChannelId: string) {
  return [...new Set(channelIds.filter((id) => id && id !== removedChannelId))];
}

export function teamNeedsChannel(channelIds: readonly string[]) {
  return channelIds.filter(Boolean).length === 0;
}
