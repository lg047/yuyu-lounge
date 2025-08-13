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

/**
 * Wait for the TV video to be realistically playable.
 * - Accepts any of: readyState >= HAVE_FUTURE_DATA (3), 'loadeddata', 'canplay', or 'canplaythrough'
 * - Adds a 1500ms safety timeout so the loader can't hang forever on iOS/HLS.
 */
async function waitForTVVideo(container: HTMLElement): Promise<void> {
  const video = container.querySelector("video");
  if (!video) return;

  const HAVE_FUTURE_DATA = 3;

  // Already good enough?
  if (video.readyState >= HAVE_FUTURE_DATA) return;

  await new Promise<void>((resolve) => {
    const done = () => {
      cleanup();
      resolve();
    };

    const onLoadedData = () => done();
    const onCanPlay = () => done();
    const onCanPlayThrough = () => done();
    const onError = () => done(); // don't hang the loader on error

    const cleanup = () => {
      video.removeEventListener("loadeddata", onLoadedData);
      video.removeEventListener("canplay", onCanPlay);
      video.removeEventListener("canplaythrough", onCanPlayThrough);
      video.removeEventListener("error", onError);
      clearTimeout(timer);
    };

    video.addEventListener("loadeddata", onLoadedData, { once: true });
    video.addEventListener("canplay", onCanPlay, { once: true });
    video.addEventListener("canplaythrough", onCanPlayThrough, { once: true });
    video.addEventListener("error", onError, { once: true });

    const timer = setTimeout(() => {
      // Last-chance check before giving up
      if (video.readyState >= HAVE_FUTURE_DATA) return done();
      done();
    }, 1500);
  });
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
    // Pause background music immediately for TV page so video can play cleanly
    if ((window as any).__bgm) {
      try { (window as any).__bgm.pause(); } catch {}
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
