// Very small cache-first shell. Adjust version to bust cache.
const VERSION = "v1";
const STATIC = `roo-static-${VERSION}`;

const SHELL = [
  "/yuyu-lounge/",
  "/yuyu-lounge/index.html",
  "/yuyu-lounge/src/styles.css",
  "/yuyu-lounge/src/main.ts",
  "/yuyu-lounge/src/router.ts",
  "/yuyu-lounge/public/env.js",
  "/yuyu-lounge/icons/icon.svg",
  "/yuyu-lounge/icons/maskable.svg",
  "/yuyu-lounge/manifest.webmanifest"
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
      fetch(req).catch(() => caches.match("/yuyu-lounge/index.html"))
    );
    return;
  }

  // Static: cache-first
  event.respondWith(
    caches.match(req).then(res => res || fetch(req))
  );
});
