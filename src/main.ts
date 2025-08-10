import "./styles.css";
import { initRouter } from "./router";
import TopNav from "./components/topnav"; // must match filename exactly

// Install button wiring
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

// Mount Top Nav
const topnavHost = document.getElementById("topnav");
if (topnavHost) topnavHost.replaceChildren(TopNav());

// Highlight active link on route changes
function currentPath(): string {
  const hash = location.hash || "#/reels";
  return hash.replace(/^#/, "");
}
function updateTopNavActive(path: string): void {
  document.querySelectorAll<HTMLAnchorElement>(".topnav a[href^='#/']").forEach((a) => {
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

// Router bootstrap
initRouter();

// SW
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(console.error);
  });
}
