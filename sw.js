// Minimal SW: navigation fallback to index.html within current scope
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// For SPA routes, return index.html from same scope
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(async () => {
        // Resolve index.html relative to the SW scope
        const scope = self.registration.scope; // e.g. https://user.github.io/yuyu-lounge/
        const indexUrl = new URL("index.html", scope);
        return caches.match(indexUrl.href) ||
               fetch(indexUrl.href);
      })
    );
  }
});
