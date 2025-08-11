// src/main.ts
import "./styles.css";
import { initRouter } from "./router";
import TopNav from "./components/topnav";
import { makeBGM } from "./lib/bgm";
import { store } from "./game/core/storage";

// create once
const bgm = makeBGM({ src: "assets/audio/bgm.mp3", store, key: "bgm.muted", volume: 0.18 });

// optional: expose for debugging
;(window as any).__bgm = bgm;

// Mark <html> when running as an installed app (iOS uses navigator.standalone)
function markStandalone(): void {
  const isStandalone =
    window.matchMedia?.("(display-mode: standalone)")?.matches ||
    // @ts-ignore - iOS Safari property
    (typeof navigator !== "undefined" && (navigator as any).standalone === true);

  document.documentElement.classList.toggle("standalone", Boolean(isStandalone));
}
markStandalone();
// Some iOS versions change this at runtime
try {
  const mq = window.matchMedia?.("(display-mode: standalone)");
  mq?.addEventListener?.("change", markStandalone);
} catch { /* no-op */ }

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
  // try to start quietly if user has already interacted
  void bgm.playIfAllowed();
})();

// --- Active link + title ---
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
