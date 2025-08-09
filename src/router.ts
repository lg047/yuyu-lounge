type ViewFactory = () => Promise<HTMLElement> | HTMLElement;

const routes: Record<string, ViewFactory> = {
  "/chat": async () => (await import("./views/chat.ts")).default(),
  "/clips": async () => (await import("./views/clips.ts")).default(),
  "/stocks": async () => (await import("./views/stocks.ts")).default(),
  "/game": async () => (await import("./views/game.ts")).default(),
  "/settings": async () => (await import("./views/settings.ts")).default(),
};

function setActiveTab(hashPath: string) {
  document.querySelectorAll<HTMLAnchorElement>(".tabs a").forEach(a => {
    a.classList.toggle("active", a.getAttribute("href") === `#${hashPath}`);
  });
}

export async function navigate() {
  const hash = location.hash || "#/chat";
  const path = hash.replace(/^#/, "");
  const factory = routes[path] || routes["/chat"];
  setActiveTab(path);
  const view = document.getElementById("view")!;
  view.innerHTML = "";
  view.appendChild(await factory());
}

export function initRouter() {
  window.addEventListener("hashchange", navigate);
  navigate();
}
