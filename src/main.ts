// src/main.ts
import "./styles.css";
import { initRouter } from "./router";
import TopNav from "./components/topnav";

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
