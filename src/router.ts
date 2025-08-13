// src/router.ts
import { showLoader, hideLoader, messageForPath } from "./lib/loader";

type ViewFactory = () => Promise<HTMLElement> | HTMLElement;

const routes: Record<string, ViewFactory> = {
  "/reels": async () => (await import("./views/clips.ts")).default(),
  "/chat":  async () => (await import("./views/chat.ts")).default(),
  "/tv":    async () => {
    const { default: mountTV } = await import("./views/tv.ts");
    const wrap = document.createElement("div");
    mountTV(wrap);
    return wrap;
  },
  "/game":  async () => (await import("./views/game.ts")).default(),
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

async function render(path: string): Promise<void> {
  const factory = routes[path] || routes["/reels"];
  const view = document.getElementById("view");
  if (!view) {
    await new Promise<void>(r => requestAnimationFrame(() => r()));
    const v2 = document.getElementById("view");
    if (!v2) throw new Error("#view not found");
    return render(path);
  }

  view.innerHTML = "";
  const node = await factory();
  view.appendChild(node);

  // Make sure we are at the top on navigation
  window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
}

export async function navigate(): Promise<void> {
  const path = normalizeHash(location.hash || "#/reels");
  showLoader(messageForPath(path), { hideApp: false });
  try {
    await render(path);
  } finally {
    // hide after next paint so the new view is in place
    requestAnimationFrame(() => requestAnimationFrame(hideLoader));
  }
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
