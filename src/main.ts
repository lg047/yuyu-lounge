// src/main.ts
import "./styles.css";
import { initRouter } from "./router";
import TopNav from "./components/topnav";
import { makeBGM } from "./lib/bgm";
import { store } from "./game/core/storage";

// create once
const bgm = makeBGM({ src: "assets/audio/bgm.mp3", store, key: "bgm.muted", volume: 0.18 });
;(window as any).__bgm = bgm;

// Mark <html> when running as an installed app
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

// --- PWA Install button wiring ---
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
  for (const sel of selectors) { target = scope.querySelector(sel); if (target) break; }
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

document.addEventListener("play", (e) => {
  if (!isVideo(e.target)) return;
  playingVideos.add(e.target);
  bgm.el.pause(); // do not touch the video's mute or volume
}, true);

// --- Ensure clicked or actively playing videos are audible (no UI added) ---
function unmuteIfPlaying(v: HTMLVideoElement) {
  if (!v.paused && v.muted) {
    v.muted = false;
    v.defaultMuted = false;
    v.removeAttribute("muted");
    if (v.volume === 0) v.volume = 1;
    v.setAttribute("playsinline", "true");
  }
}

// 1) On any user gesture, unmute videos that are currently playing in view
const userGestures = ["pointerdown", "click", "touchstart", "keydown"];
userGestures.forEach(t => {
  document.addEventListener(t, () => {
    // defer so play() from component runs first
    setTimeout(() => {
      document.querySelectorAll<HTMLVideoElement>("video").forEach(unmuteIfPlaying);
    }, 0);
  }, { capture: true, passive: true });
});

// 2) Also cover direct play on the <video> element
document.addEventListener("play", (e) => {
  const v = (e.target as HTMLVideoElement | null);
  if (!v || v.tagName !== "VIDEO") return;
  // if this play came from a user click, this will make it audible
  setTimeout(() => unmuteIfPlaying(v), 0);
}, true);


function onStop(e: Event) {
  if (!isVideo(e.target)) return;
  playingVideos.delete(e.target);
  if (playingVideos.size === 0 && !bgm.muted) void bgm.playIfAllowed();
}
document.addEventListener("pause", onStop, true);
document.addEventListener("ended", onStop, true);
document.addEventListener("emptied", onStop, true);

// Unmute a video when the user explicitly clicks the video element
document.addEventListener("click", (e) => {
  const el = e.target as HTMLElement | null;
  const v = el?.closest?.("video") as HTMLVideoElement | null;
  if (!v) return;

  // user intent: enable audio
  v.muted = false;
  v.defaultMuted = false;
  if (v.volume === 0) v.volume = 1;
  v.setAttribute("playsinline", "true"); // iOS
  // optional: ensure it plays if they tapped a paused poster
  if (v.paused) void v.play().catch(() => {});
}, { capture: true });


// Re-check on route changes
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

  // If no videos are currently playing, resume bgm if user has not muted it
  if (playingVideos.size === 0 && !bgm.muted) void bgm.playIfAllowed();
}
function onRouteChange(): void { updateTopNavActive(currentPath()); }
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
