// src/main.ts
import "./styles.css";
import { initRouter } from "./router";
import TopNav from "./components/topnav";

// --- PWA Install button wiring ---
let deferredPrompt: unknown = null;

const installBtn = document.getElementById("installBtn") as HTMLButtonElement | null;
window.addEventListener("beforeinstallprompt", (e: Event) => {
  // @ts-ignore - BeforeInstallPromptEvent is not in TS lib
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
if (topnavHost) {
  topnavHost.replaceChildren(TopNav());
}

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
}

function onRouteChange(): void {
  const path = currentPath();
  updateTopNavActive(path);
  document.title = `Yuyu Lounge • ${path.replace("/", "")}`;
}

// Initial paint
onRouteChange();
window.addEventListener("hashchange", onRouteChange);


// --- Router bootstrap (keeps existing view/overlay behaviour) ---
initRouter();

// --- Service Worker for PWA/offline ---
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(console.error);
  });
}
