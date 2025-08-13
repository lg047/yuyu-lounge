// sw.js — Yuyu Lounge PWA service worker
// Cache shell for offline, network-first for clips.json and .mp4
// IMPORTANT: do NOT intercept HLS (.m3u8/.ts) or video streams

const CACHE_VERSION = "v6";
const CACHE_NAME = `yuyu-${CACHE_VERSION}`;

// Core shell kept small so it works across dev and Pages/custom domain
async function coreUrls() {
  const scope = self.registration.scope; // now ends with "/" at yuyulounge.com
  const u = (p) => new URL(p, scope).toString();
  return [
    u("index.html"),
    u("manifest.webmanifest"),
    u("icons/icon.svg"),
    u("icons/maskable.svg"),
    u("assets/sparkle.gif"),
    u("assets/heart.gif"),
  ];
}

self.addEventListener("install", (evt) => {
  evt.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    const urls = await coreUrls();
    await cache.addAll(urls);
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (evt) => {
  evt.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => (k === CACHE_NAME ? undefined : caches.delete(k))));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (evt) => {
  const req = evt.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;

  // Always pass through HLS playlists/segments and any video requests
  const isHls = url.pathname.endsWith(".m3u8") || url.pathname.endsWith(".ts");
  const isVideo = req.destination === "video";
  if (isHls || isVideo) return; // no respondWith → browser handles it

  // Network-first for dynamic media list and mp4 previews (same-origin only)
  const isClipsAsset =
    sameOrigin &&
    (url.pathname.endsWith("/clips.json") || url.pathname.endsWith(".mp4"));

  if (isClipsAsset) {
    evt.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(CACHE_NAME);
        cache.put(req, fresh.clone());
        return fresh;
      } catch {
        const cached = await caches.match(req);
        if (cached) return cached;
        throw new Error("offline and not cached");
      }
    })());
    return;
  }

  // Navigations: try network, fall back to cached index.html
  if (req.mode === "navigate") {
    evt.respondWith((async () => {
      try {
        return await fetch(req);
      } catch {
        const indexUrl = new URL("index.html", self.registration.scope).toString();
        return (await caches.match(indexUrl)) || fetch(indexUrl);
      }
    })());
    return;
  }

  // Same-origin GET: cache-first
  if (sameOrigin) {
    evt.respondWith((async () => {
      const cached = await caches.match(req);
      if (cached) return cached;
      try {
        const resp = await fetch(req);
        const cache = await caches.open(CACHE_NAME);
        if (resp && resp.status === 200 && resp.type === "basic") {
          cache.put(req, resp.clone());
        }
        return resp;
      } catch {
        if (req.headers.get("accept")?.includes("text/html")) {
          const indexUrl = new URL("index.html", self.registration.scope).toString();
          const fallback = await caches.match(indexUrl);
          if (fallback) return fallback;
        }
        throw new Error("request failed and no cache");
      }
    })());
  }
});

// Optional: allow page to trigger skipWaiting
self.addEventListener("message", (evt) => {
  if (evt.data === "skip-waiting") self.skipWaiting();
});
