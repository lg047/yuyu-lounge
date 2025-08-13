// src/router.ts
import { showLoader, hideLoader } from "./main";

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

async function waitForTVVideo(container: HTMLElement): Promise<void> {
  const video = container.querySelector("video");
  if (!video) return;
  await new Promise<void>((resolve) => {
    if (video.readyState >= 4) return resolve(); // HAVE_ENOUGH_DATA
    video.addEventListener("canplaythrough", () => resolve(), { once: true });
    video.addEventListener("error", () => resolve(), { once: true });
  });
}

async function render(path: string): Promise<void> {
  showLoader(path);

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

  if (path === "/tv") {
    await waitForTVVideo(view);
  } else if (path === "/chat" || path === "/game") {
    await loadAllImages(view);
  }

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
