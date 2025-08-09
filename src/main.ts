import { initRouter } from "./router";
import "./styles.css";

let deferredPrompt: any = null;
const installBtn = document.getElementById("installBtn") as HTMLButtonElement;

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;
  installBtn.hidden = false;
});

installBtn?.addEventListener("click", async () => {
  if (!deferredPrompt) return;
  installBtn.hidden = true;
  await deferredPrompt.prompt();
  deferredPrompt = null;
});

initRouter();

// Register SW with correct base path for GitHub Pages
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    const swUrl = `${import.meta.env.BASE_URL}sw.js?cache-bust=${Date.now()}`;
    navigator.serviceWorker
      .register(swUrl, {
        scope: import.meta.env.BASE_URL,
        updateViaCache: "none",
      })
      .catch(console.error);
  });
}
