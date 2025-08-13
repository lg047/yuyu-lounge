// src/router.ts
import { showLoader, hideLoader, messageForPath } from "./main";

type ViewFactory = () => Promise<HTMLElement> | HTMLElement;

const routes: Record<string, ViewFactory> = {
  "/reels": async () => (await import("./views/clips.ts")).default(),
  "/chat": async () => (await import("./views/chat.ts")).default(),
  "/tv": async () => {
    const { default: mountTV } = await import("./views/tv.ts");
    const wrap = document.createElement("div");
    mountTV(wrap);
    return wrap;
  },
  "/game": async () => (await import("./views/game.ts")).default(),
};

function normalizeHash(h: string): string {
  let p = (h || "#/reels").replace(/^#/, "");
  p = p.split("?")[0].split("&")[0];
  p = p.replace(/\/+$/, "");
  p = p.trim();
  if (p === "") p = "/reels";
  p = p.replace(/\/{2,}/g, "/");
  p = p.toLowerCase();
  if (p.startsWith("/chat/")) p = "/chat";
  if (p === "/clips") p = "/reels";
  return p;
}

async function loadAllImages(container: HTMLElement): Promise<void> {
  const imgs = Array.from(container.querySelectorAll("img"));
  await Promise.all(
    imgs.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete) return resolve();
          img.addEventListener("load", () => resolve(), { once: true });
          img.addEventListener("error", () => resolve(), { once: true });
        })
    )
  );
}

// CHANGED: add timeout + accept first usable readiness signal
async function waitForTVVideo(container: HTMLElement, timeoutMs = 4000): Promise<void> {
  const video = container.querySelector("video");
  if (!video) return;

  await Promise.race([
    new Promise<void>((resolve) => {
      // If the browser already buffered enough, don't wait.
      // 3 = HAVE_FUTURE_DATA, 4 = HAVE_ENOUGH_DATA
      if (video.readyState >= 3) return resolve();

      const onReady = () => cleanup(resolve);
      const onErr = () => cleanup(resolve);

      const cleanup = (done: () => void) => {
        video.removeEventListener("canplaythrough", onReady);
        video.removeEventListener("loadeddata", onReady);
        video.removeEventListener("error", onErr);
        done();
      };

      video.addEventListener("canplaythrough", onReady, { once: true });
      video.addEventListener("loadeddata", onReady, { once: true });
      video.addEventListener("error", onErr, { once: true });
    }),
    new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
  ]);
}

async function render(path: string): Promise<void> {
  // Show loader with a friendly page-specific message
  showLoader(messageForPath(path));

  const factory = routes[path] || routes["/reels"];
  const view = document.getElementById("view");
  if (!view) {
    await new Promise<void>((r) => requestAnimationFrame(() => r()));
    const v2 = document.getElementById("view");
    if (!v2) throw new Error("#view not found");
    return render(path);
  }

  view.innerHTML = "";
  const node = await factory();
  view.appendChild(node);

  // Wait for assets (per page) before hiding loader
  if (path === "/tv") {
    // Pause/mute background music immediately for TV page
    if ((window as any).__bgm) {
      (window as any).__bgm.pause(); // use .mute() instead if preferred
    }
    await waitForTVVideo(view);
  } else if (path === "/chat" || path === "/game") {
    await loadAllImages(view);
  }
  // reels intentionally skipped

  hideLoader();
  window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
}

export async function navigate(): Promise<void> {
  const path = normalizeHash(location.hash);
  await render(path);
}

export function initRouter(): void {
  const start = () => navigate().catch(console.error);
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
  window.addEventListener("hashchange", () => navigate().catch(console.error));
}
