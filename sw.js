// Very small cache-first shell. Adjust version to bust cache.
const VERSION = "v1";
const STATIC = `roo-static-${VERSION}`;

const SHELL = [
  "/roo-lounge/",
  "/roo-lounge/index.html",
  "/roo-lounge/src/styles.css",
  "/roo-lounge/src/main.ts",
  "/roo-lounge/src/router.ts",
  "/roo-lounge/public/env.js",
  "/roo-lounge/icons/icon.svg",
  "/roo-lounge/icons/maskable.svg",
  "/roo-lounge/manifest.webmanifest"
];

// Install
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

// Activate
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k.startsWith("roo-static-") && k !== STATIC).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch
self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Navigation requests: try network, fallback to cache
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(() => caches.match("/roo-lounge/index.html"))
    );
    return;
  }

  // Static: cache-first
  event.respondWith(
    caches.match(req).then(res => res || fetch(req))
  );
});
