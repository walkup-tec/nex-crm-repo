const hosts = ["facebook.com", "fb.com", "meta.com"];

export function normalizeBalanceLink(value: string) {
  const text = value.trim();
  if (!text || text.length > 2000) return null;
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.username || url.password) return null;
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  const allowed = hosts.some((item) => host === item || host.endsWith(`.${item}`));
  if (!allowed) return null;
  return url.toString();
}
