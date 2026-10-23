export type DashboardStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

const cacheLimit = 350_000;

export function dashboardRequestDropped(error: unknown) {
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  return /failed to fetch|networkerror|network request failed|load failed|aborterror|the operation was aborted|timeout/i.test(message);
}

export async function retryDroppedDashboard<T>(work: () => Promise<T>, attempts = 2) {
  let last: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await work();
    } catch (error) {
      last = error;
      if (!dashboardRequestDropped(error) || attempt === attempts) throw error;
      await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
    }
  }
  throw last;
}

export function readDashboardSnapshot<T>(storage: DashboardStorage | null, key: string, accept: (value: unknown) => value is T) {
  if (!storage) return null;
  try {
    const parsed = JSON.parse(storage.getItem(key) ?? "");
    return accept(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function writeDashboardSnapshot(storage: DashboardStorage | null, key: string, value: unknown) {
  if (!storage) return;
  try {
    const body = JSON.stringify(value);
    if (body.length > cacheLimit) return;
    storage.setItem(key, body);
  } catch {
    return;
  }
}
