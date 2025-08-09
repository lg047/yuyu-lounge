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

// Use import.meta.env.BASE_URL so it works on localhost and Pages
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    const url = import.meta.env.BASE_URL + "sw.js";
    navigator.serviceWorker.register(url).catch(console.error);
  });
}
