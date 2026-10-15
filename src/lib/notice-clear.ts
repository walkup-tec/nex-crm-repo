export type ClearedNotices = { queue: string[]; offline: boolean; balance: boolean };

export function applyClearedNotices<T extends { conversationId: string }>(
  leads: T[],
  offline: boolean,
  low: boolean,
  cleared: ClearedNotices,
) {
  const present = new Set(leads.map((lead) => lead.conversationId));
  const queue = cleared.queue.filter((id) => present.has(id));
  const hidden = new Set(queue);
  return {
    leads: leads.filter((lead) => !hidden.has(lead.conversationId)),
    offline: offline && !cleared.offline,
    low: low && !cleared.balance,
    cleared: {
      queue,
      offline: offline && cleared.offline,
      balance: low && cleared.balance,
    },
  };
}

export function clearVisibleNotices(
  conversationIds: string[],
  offline: boolean,
  low: boolean,
  cleared: ClearedNotices,
): ClearedNotices {
  return {
    queue: [...new Set([...cleared.queue, ...conversationIds])],
    offline: cleared.offline || offline,
    balance: cleared.balance || low,
  };
}
