// src/main.ts
import "./styles.css";
import { initRouter } from "./router";
import TopNav from "./components/topnav";
import { makeBGM } from "./lib/bgm";
import { store } from "./game/core/storage";
import "./styles/reels.css";

// create once
const bgm = makeBGM({
  src: "assets/audio/bgm.mp3",
  store,
  key: "bgm.muted",
  volume: 0.18,
});
(window as any).__bgm = bgm;

// Mark <html> when running as an installed app
function markStandalone(): void {
  const isStandalone =
    window.matchMedia?.("(display-mode: standalone)")?.matches ||
    // @ts-ignore
    (typeof navigator !== "undefined" && (navigator as any).standalone === true);
  document.documentElement.classList.toggle(
    "standalone",
    Boolean(isStandalone)
  );
}
markStandalone();
try {
  const mq = window.matchMedia?.("(display-mode: standalone)");
  mq?.addEventListener?.("change", markStandalone);
} catch {}

// --- PWA Install button wiring ---
let deferredPrompt: unknown = null;
const installBtn = document.getElementById(
  "installBtn"
) as HTMLButtonElement | null;
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

// Replace Settings tab with a mute button for site music
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

// ---- BGM vs videos: pause BGM when any video plays, resume when none do ----
const playingVideos = new Set<HTMLVideoElement>();

function isVideo(t: EventTarget | null): t is HTMLVideoElement {
  return !!t && (t as any).tagName === "VIDEO";
}

document.addEventListener(
  "play",
  (e) => {
    if (!isVideo(e.target)) return;
    playingVideos.add(e.target);
    bgm.pause();
  },
  true
);

// Some browsers fire "playing" later rather than "play" in delegated listeners
document.addEventListener(
  "playing",
  (e) => {
    if (!isVideo(e.target)) return;
    playingVideos.add(e.target);
    bgm.pause();
  },
  true
);

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

// Re-check on route changes
function currentPath(): string {
  const hash = location.hash || "#/reels";
  return hash.replace(/^#/, "");
}
function updateTopNavActive(path: string): void {
  const links = document.querySelectorAll<HTMLAnchorElement>(
    ".topnav a[href^='#/']"
  );
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

// Router bootstrap
initRouter();

// Service Worker
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(console.error);
  });
}
