/**
 * Mantém a página aberta quando o proxy responde 502/503/504 durante o deploy.
 * Não guarda /health nem /ready.
 */
const CACHE_SHELL = "nex-deploy-shell-v1";

function isNavigationRequest(request) {
  if (request.mode === "navigate") return true;
  const accept = request.headers.get("accept") || "";
  return request.method === "GET" && accept.includes("text/html");
}

function isProbeRequest(request) {
  try {
    const pathname = new URL(request.url).pathname.replace(/\/+$/, "") || "/";
    return pathname === "/health" || pathname === "/ready";
  } catch {
    return false;
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key !== CACHE_SHELL).map((key) => caches.delete(key)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET" || isProbeRequest(request) || !isNavigationRequest(request)) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_SHELL);
      try {
        const response = await fetch(request);
        if (response.ok && (response.headers.get("content-type") || "").includes("text/html")) {
          cache.put(request, response.clone()).catch(() => {});
        }
        if (response.status >= 502 && response.status <= 504) {
          const cached = await cache.match(request);
          if (cached) return cached;
        }
        return response;
      } catch {
        const cached = await cache.match(request);
        if (cached) return cached;
        throw new Error("offline");
      }
    })(),
  );
});
