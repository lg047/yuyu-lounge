// src/router.ts

type ViewFactory = () => Promise<HTMLElement> | HTMLElement;

const routes: Record<string, ViewFactory> = {
  "/reels": async () => (await import("./views/clips.ts")).default(),
  "/chat": async () => (await import("./views/chat.ts")).default(),
  "/happystocks": async () => {
    const mod = await import("./views/happystocks.ts");
    const wrap = document.createElement("div");
    // happystocks default export mounts into a provided root
    mod.default(wrap);
    return wrap;
  },
  "/game": async () => (await import("./views/game.ts")).default(),
};

async function render(path: string): Promise<void> {
  const factory = routes[path] || routes["/reels"];
  const view = document.getElementById("view")!;
  view.innerHTML = "";
  view.appendChild(await factory());
  window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
}

export async function navigate(): Promise<void> {
  const hash = location.hash || "#/reels";
  // normalize: "#/happystocks" -> "/happystocks", also trim trailing slash
  let path = hash.replace(/^#/, "").replace(/\/+$/, "");
  if (path === "") path = "/reels";

  // Legacy alias
  if (path === "/clips") {
    location.replace("#/reels");
    return;
  }

  // normalize /chat/anything -> /chat
  if (path.startsWith("/chat/")) {
    path = "/chat";
  }

  await render(path);
}

export function initRouter(): void {
  window.addEventListener("hashchange", () => navigate().catch(console.error));
  navigate().catch(console.error);
}
