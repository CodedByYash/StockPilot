// Minimal service worker: caches the app shell so the UI itself (not live
// data — that always goes to the API) loads instantly on repeat visits and
// the app satisfies Chrome/Android's installability requirement (a fetch
// handler is part of that check). Deliberately not a full offline-data
// strategy — this app is API-driven, so stale-while-revalidate on the shell
// is the honest amount of "offline support" to promise here.
const CACHE_NAME = "ledger-shell-v1";
const SHELL_URLS = ["/", "/dashboard", "/login"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_URLS)).catch(() => {
      // best-effort — don't block install if a shell URL isn't reachable yet
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Never cache API calls — inventory data must always be live.
  if (url.pathname.startsWith("/api") || event.request.method !== "GET") return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
