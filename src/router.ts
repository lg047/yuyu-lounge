// src/router.ts

type ViewFactory = () => Promise<HTMLElement> | HTMLElement;

const routes: Record<string, ViewFactory> = {
  "/reels": async () => (await import("./views/clips.ts")).default(),
  "/chat": async () => (await import("./views/chat.ts")).default(),
  const routes = {
  // existing routes...
  tv: async (root: HTMLElement) => {
    const { default: mountTV } = await import("./views/tv");
    mountTV(root);
  },
  "/game": async () => (await import("./views/game.ts")).default(),
};

function normalizeHash(h: string): string {
  let p = (h || "#/reels").replace(/^#/, "");
  p = p.split("?")[0].split("&")[0];
  p = p.replace(/\/+$/, ""); // trim trailing slash
  p = p.trim();
  if (p === "") p = "/reels";
  // collapse double slashes
  p = p.replace(/\/{2,}/g, "/");
  // only lowercase the route segment, not query
  p = p.toLowerCase();
  // special normalize
  if (p.startsWith("/chat/")) p = "/chat";
  if (p === "/clips") p = "/reels";
  return p;
}

async function render(path: string): Promise<void> {
  const factory = routes[path] || routes["/reels"];
  const view = document.getElementById("view");
  if (!view) {
    // DOM not ready yet
    await new Promise<void>(r => requestAnimationFrame(() => r()));
    const v2 = document.getElementById("view");
    if (!v2) throw new Error("#view not found");
    return render(path);
  }
  view.innerHTML = "";
  const node = await factory();
  view.appendChild(node);
  window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
}

export async function navigate(): Promise<void> {
  const path = normalizeHash(location.hash);
  // tiny debug to confirm
  // console.log("route", path, Object.keys(routes));
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
