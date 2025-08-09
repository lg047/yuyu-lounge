// src/router.ts

type ViewFactory = () => Promise<HTMLElement> | HTMLElement;

const routes: Record<string, ViewFactory> = {
  "/reels": async () => (await import("./views/clips.ts")).default(), // points to clips.ts
  "/chat": async () => (await import("./views/chat.ts")).default(),
  "/stocks": async () => (await import("./views/stocks.ts")).default(),
  "/game": async () => (await import("./views/game.ts")).default(),
  "/settings": async () => (await import("./views/settings.ts")).default(),
};

async function render(path: string): Promise<void> {
  const factory = routes[path] || routes["/reels"];
  const view = document.getElementById("view")!;
  view.innerHTML = "";
  view.appendChild(await factory());
  // reset scroll
  window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
}

export async function navigate(): Promise<void> {
  const hash = location.hash || "#/reels";
  const path = hash.replace(/^#/, "");

  // Legacy alias
  if (path === "/clips") {
    location.replace("#/reels");
    return;
  }

  await render(path);
}

export function initRouter(): void {
  window.addEventListener("hashchange", navigate);
  navigate().catch(console.error);
}
