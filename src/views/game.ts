import { makeCore } from "../game/core/loop";

type GameModule = {
  meta: { id: string; title: string; bestKey: string };
  init: (canvas: HTMLCanvasElement, core: ReturnType<typeof makeCore>) => void;
  start: () => void;
  stop: () => void;
  destroy: () => void;
};

const loaders = {
  pom: () => import("../game/pom.ts"),
  rain: () => import("../game/rain.ts"),
  hop: () => import("../game/hop.ts"),
} as const;

export default function GameView(): HTMLElement {
  const root = document.createElement("div");
  root.id = "game-root";

  const canvas = document.createElement("canvas");
  canvas.id = "game-canvas";
  root.appendChild(canvas);

  const core = makeCore(canvas);

  const hudBtn = document.createElement("div");
  hudBtn.className = "hud btn";
  hudBtn.textContent = core.store.getBool("muted", true) ? "Unmute" : "Mute";
  hudBtn.onclick = () => {
    const was = core.store.getBool("muted", true);
    core.store.setBool("muted", !was);
    core.audio.setEnabled(was);
    hudBtn.textContent = !was ? "Unmute" : "Mute";
    if (core.audio.enabled) core.audio.beep(660, 60);
  };
  root.appendChild(hudBtn);

  const backBtn = document.createElement("div");
  backBtn.className = "back-btn";
  backBtn.textContent = "Back";
  backBtn.style.display = "none";
  backBtn.onclick = () => showMenu();
  root.appendChild(backBtn);

  let current: GameModule | null = null;

  function showMenu() {
    if (current) { current.stop(); current.destroy(); current = null; }
    backBtn.style.display = "none";
    const overlay = document.createElement("div");
    overlay.className = "arcade-menu";
    overlay.innerHTML = `
      <div class="grid">
        ${tile("pom", "Pom Dash", "/assets/game/icons/pom.svg")}
        ${tile("rain", "Treat Rain", "/assets/game/icons/rain.svg")}
        ${tile("hop", "Cloud Hop", "/assets/game/icons/hop.svg")}
      </div>
    `;
    overlay.onclick = async (e) => {
      const el = (e.target as HTMLElement).closest("[data-g]") as HTMLElement | null;
      if (!el) return;
      const id = el.dataset.g as keyof typeof loaders;
      await loadGame(id);
    };
    // Remove any previous menu
    root.querySelectorAll(".arcade-menu").forEach(n => n.remove());
    root.appendChild(overlay);
    location.hash = "#/game";
  }

  function tile(id: string, title: string, icon: string) {
    const best = getBestLabel(id);
    return `<div class="arcade-tile" data-g="${id}">
      <img alt="" src="${icon}">
      <div class="title">${title}</div>
      <div class="best">${best}</div>
    </div>`;
  }

  function getBestLabel(id: string) {
    const key = `best.${id}`;
    const n = core.store.getNumber(key, 0);
    return n > 0 ? `Best: ${n}` : "No score yet";
  }

  async function loadGame(id: keyof typeof loaders) {
    root.querySelectorAll(".arcade-menu").forEach(n => n.remove());
    backBtn.style.display = "block";
    const mod = (await loaders[id]()).default as GameModule;
    mod.init(canvas, core);
    mod.start();
    current = mod;
    // deep link
    location.hash = `#/game?g=${id}`;
  }

  // deep link support
  const hash = location.hash || "#/game";
  const params = new URLSearchParams(hash.split("?")[1] || "");
  const g = params.get("g") as keyof typeof loaders | null;
  if (g && g in loaders) loadGame(g);
  else showMenu();

  window.addEventListener("hashchange", () => {
    if (!location.hash.startsWith("#/game")) return;
    const params2 = new URLSearchParams(location.hash.split("?")[1] || "");
    const g2 = params2.get("g") as keyof typeof loaders | null;
    if (g2 && g2 in loaders) loadGame(g2);
  });

  // honor stored mute on first tap to unlock audio context
  canvas.addEventListener("pointerdown", () => {
    core.audio.unlock();
    core.audio.setEnabled(!core.store.getBool("muted", true));
  }, { once: true });

  return root;
}
