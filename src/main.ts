// src/main.ts
import "./styles.css";
import { initRouter } from "./router";
import TopNav from "./components/topnav";
import { makeBGM } from "./lib/bgm";
import { store } from "./game/core/storage";
import "./styles/reels.css";

// --- Loader helpers ---
export function messageForPath(path: string): string {
  if (path.includes("/tv")) return "Loading your living room...";
  if (path.includes("/arcade") || path.includes("/game")) return "Loading arcade...";
  if (path.includes("/chat")) return "Loading chat...";
  if (path.includes("/reels")) return "Loading reels...";
  return "Loading…";
}

// singleton state to prevent multiple competing intervals
let __loaderRunning = false;
let __loaderTimer: number | undefined;
let __progress = 0;

function resolveMessage(input: string | undefined): string {
  if (!input) return "Loading…";
  // Accept either a friendly string or a route-like path
  if (input.startsWith("/") || input.startsWith("#/") || input.includes("/")) {
    return messageForPath(input);
  }
  return input;
}

export function showLoader(message: string = "Loading…", opts?: { hideApp?: boolean }) {
  const loader = document.getElementById("loading-screen") as HTMLDivElement | null;
  const msgEl = loader?.querySelector<HTMLDivElement>(".loading-text") ?? null;
  const fill = loader?.querySelector<HTMLDivElement>(".loading-bar-fill") ?? null;
  const app = document.getElementById("app");

  if (!loader || !fill) return;

  // Set message (supports passing paths like "/tv" or text)
  if (msgEl) msgEl.textContent = resolveMessage(message);

  // Show overlay
  if (opts?.hideApp && app) app.style.visibility = "hidden";
  loader.style.opacity = "1";
  loader.style.pointerEvents = "auto";
  loader.style.display = "flex";

  // If already running, don't start another interval (prevents wobble)
  if (__loaderRunning) return;

  __loaderRunning = true;
  __progress = 0;
  fill.style.width = "0%";

  // Smooth, forward-only fake progress up to 92%
  __loaderTimer = window.setInterval(() => {
    const step = 3 + Math.random() * 5; // 3–8% per tick
    __progress = Math.min(__progress + step, 92);
    fill.style.width = __progress.toFixed(2) + "%";
  }, 200);
}

export function hideLoader() {
  const loader = document.getElementById("loading-screen") as HTMLDivElement | null;
  const fill = loader?.querySelector<HTMLDivElement>(".loading-bar-fill") ?? null;
  const app = document.getElementById("app");

  if (!loader || !fill) return;

  // Only act if we actually started it
  if (__loaderTimer !== undefined) {
    clearInterval(__loaderTimer);
    __loaderTimer = undefined;
  }
  __loaderRunning = false;

  // Finish cleanly
  fill.style.width = "100%";
  setTimeout(() => {
    loader.style.opacity = "0";
    loader.style.pointerEvents = "none";
    loader.style.display = "none";
    if (app) app.style.visibility = "visible";
  }, 400);
}

// --- Initial page load loader ---
document.addEventListener("DOMContentLoaded", () => {
  const path = (location.hash || location.pathname) || "/reels";
  showLoader(path, { hideApp: true }); // accepts a path or a message
});

// --- BGM setup ---
const bgm = makeBGM({
  src: (import.meta as any).env.BASE_URL + "assets/audio/bgm.mp3",
  store,
  key: "bgm.muted",
  volume: 0.18,
});
(window as any).__bgm = bgm;

// --- Standalone mode detection ---
function markStandalone(): void {
  const isStandalone =
    window.matchMedia?.("(display-mode: standalone)")?.matches ||
    // @ts-ignore
    (typeof navigator !== "undefined" && (navigator as any).standalone === true);
  document.documentElement.classList.toggle("standalone", Boolean(isStandalone));
}
markStandalone();
try {
  const mq = window.matchMedia?.("(display-mode: standalone)");
  mq?.addEventListener?.("change", markStandalone);
} catch {}

// --- PWA Install button ---
let deferredPrompt: unknown = null;
const installBtn = document.getElementById("installBtn") as HTMLButtonElement | null;
window.addEventListener("beforeinstallprompt", (e: Event) => {
  // @ts-ignore
  e.preventDefault?.();
  deferredPrompt = e;
  if (installBtn) installBtn.hidden = false;
});
installBtn?.addEventListener("click", async () => {
  if (!deferredPrompt) return;
  // @ts-ignore
  await deferredPrompt.prompt?.();
  deferredPrompt = null;
  if (installBtn) installBtn.hidden = true;
});

// --- Mount Top Nav ---
const topnavHost = document.getElementById("topnav") as HTMLElement | null;
if (topnavHost) topnavHost.replaceChildren(TopNav());

// --- Replace Settings with music toggle ---
(function attachMusicToggle() {
  const scope = topnavHost ?? document;
  const selectors = [
    '[data-nav="settings"]',
    "#settings-tab",
    ".nav-settings",
    'a[href="#/settings"]',
  ];
  let target: Element | null = null;
  for (const sel of selectors) {
    target = scope.querySelector(sel);
    if (target) break;
  }
  if (target) {
    bgm.attachToggleInto(target);
  } else if (topnavHost) {
    const placeholder = document.createElement("span");
    topnavHost.appendChild(placeholder);
    bgm.attachToggleInto(placeholder);
  }
  void bgm.playIfAllowed();
})();

// --- Pause/resume BGM with video ---
const playingVideos = new Set<HTMLVideoElement>();
function isVideo(t: EventTarget | null): t is HTMLVideoElement {
  return !!t && (t as any).tagName === "VIDEO";
}
document.addEventListener("play", (e) => {
  if (!isVideo(e.target)) return;
  playingVideos.add(e.target);
  bgm.pause();
}, true);
document.addEventListener("playing", (e) => {
  if (!isVideo(e.target)) return;
  playingVideos.add(e.target);
  bgm.pause();
}, true);
function onStop(e: Event) {
  if (!isVideo(e.target)) return;
  const had = playingVideos.delete(e.target);
  if (!had) return;
  const suppress = (window as any).__suppressBGMResume === true;
  if (playingVideos.size === 0 && !bgm.muted && !suppress) void bgm.playIfAllowed();
}
document.addEventListener("pause", onStop, true);
document.addEventListener("ended", onStop, true);
document.addEventListener("emptied", onStop, true);

// --- Route change active state ---
function currentPath(): string {
  const hash = location.hash || "#/reels";
  return hash.replace(/^#/, "");
}
function updateTopNavActive(path: string): void {
  const links = document.querySelectorAll<HTMLAnchorElement>(".topnav a[href^='#/']");
  links.forEach((a) => {
    const hrefPath = a.getAttribute("href")?.replace(/^#/, "") ?? "";
    a.classList.toggle("active", hrefPath === path);
  });
  document.title = `Yuyu Lounge • ${path.slice(1)}`;
  const suppress = (window as any).__suppressBGMResume === true;
  if (playingVideos.size === 0 && !bgm.muted && !suppress) void bgm.playIfAllowed();
}
function onRouteChange(): void {
  updateTopNavActive(currentPath());
}
onRouteChange();
window.addEventListener("hashchange", onRouteChange);

// --- Router bootstrap ---
initRouter();

// --- Service Worker ---
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(console.error);
  });
}
