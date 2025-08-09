// Minimal SW: navigation fallback to index.html within current scope
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Network-first for clips.json and MP4 to avoid stale content
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  const isClipsAsset =
    url.pathname.endsWith("/clips.json") || url.pathname.endsWith(".mp4");

  if (isClipsAsset) {
    event.respondWith(
      fetch(req).catch(() => caches.match(req))
    );
    return;
  }

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(async () => {
        const scope = self.registration.scope;
        const indexUrl = new URL("index.html", scope);
        return caches.match(indexUrl.href) || fetch(indexUrl.href);
      })
    );
  }
});
