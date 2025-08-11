// src/router.ts

type ViewFactory = () => Promise<HTMLElement> | HTMLElement;

const routes: Record<string, ViewFactory> = {
  "/reels": async () => (await import("./views/clips.ts")).default(), // points to clips.ts
  "/chat": async () => (await import("./views/chat.ts")).default(),
  // In your routes table or addRoute calls, add this entry:
  "#/happystocks": async (root: HTMLElement) => (await import("./views/happystocks")).default(root),
  "/game": async () => (await import("./views/game.ts")).default(),
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
  let path = hash.replace(/^#/, "");

  // Legacy alias
  if (path === "/clips") {
    location.replace("#/reels");
    return;
  }

  // NEW: normalize /chat/xxx -> /chat
  if (path.startsWith("/chat/")) {
    path = "/chat";
  }

  await render(path);
}

export function initRouter(): void {
  window.addEventListener("hashchange", navigate);
  navigate().catch(console.error);
}
