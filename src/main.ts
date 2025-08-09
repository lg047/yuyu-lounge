import { initRouter } from "./router.ts";
import "./styles.css";

// PWA install prompt handler
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

// Router
initRouter();

// SW register
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/roo-lounge/sw.js").catch(console.error);
  });
}
