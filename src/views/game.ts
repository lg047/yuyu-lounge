import "../styles/game.css";
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

// GitHub Pages safe asset helper
const base = (import.meta as any).env.BASE_URL as string;
function asset(p: string) {
  const b = base.endsWith("/") ? base : base + "/";
  return b + p.replace(/^\//, "");
}

export default function GameView(): HTMLElement {
  const root = document.createElement("div");
  root.id = "game-root";

  // Stop clicks from bubbling to any global handlers that switch tabs
  root.addEventListener("click", e => e.stopPropagation(), { capture: true });

  const canvas = document.createElement("canvas");
  canvas.id = "game-canvas";
  root.appendChild(canvas);

  const core = makeCore(canvas);

  // Mute toggle
  const hudBtn = document.createElement("div");
  hudBtn.className = "hud btn";
  const muted = core.store.getBool("muted", true);
  hudBtn.textContent = muted ? "Unmute" : "Mute";
  hudBtn.onclick = () => {
    const was = core.store.getBool("muted", true);
    core.store.setBool("muted", !was);
    core.audio.setEnabled(was);
    hudBtn.textContent = !was ? "Unmute" : "Mute";
    if (core.audio.enabled) core.audio.beep(660, 60);
  };
  root.appendChild(hudBtn);

  // Back button
  const backBtn = document.createElement("div");
  backBtn.className = "back-btn";
  backBtn.textContent = "Back";
  backBtn.style.display = "none";
  backBtn.onclick = () => showMenu();
  root.appendChild(backBtn);

  let current: GameModule | null = null;

  function tile(id: string, title: string, iconRel: string) {
    const best = getBestLabel(id);
    const iconUrl = asset(iconRel);
    return `<div class="arcade-tile" data-g="${id}">
      <img alt="" src="${iconUrl}">
      <div class="title">${title}</div>
      <div class="best">${best}</div>
    </div>`;
  }

  function getBestLabel(id: string) {
    const key = `best.${id}`;
    const n = core.store.getNumber(key, 0);
    return n > 0 ? `Best: ${n}` : "No score yet";
  }

  function showMenu() {
    if (current) { current.stop(); current.destroy(); current = null; }
    backBtn.style.display = "none";
    const overlay = document.createElement("div");
    overlay.className = "arcade-menu";
    overlay.innerHTML = `
      <div class="grid">
        ${tile("pom", "Pom Dash", "assets/game/icons/pom.svg")}
        ${tile("rain", "Treat Rain", "assets/game/icons/rain.svg")}
        ${tile("hop", "Cloud Hop", "assets/game/icons/hop.svg")}
      </div>
    `;
    overlay.onclick = async (e) => {
      const el = (e.target as HTMLElement).closest("[data-g]") as HTMLElement | null;
      if (!el) return;
      e.preventDefault();
      e.stopPropagation(); // do not let global nav handlers run
      const id = el.dataset.g as keyof typeof loaders;
      await loadGame(id);
    };
    root.querySelectorAll(".arcade-menu").forEach(n => n.remove());
    root.appendChild(overlay);
    // Keep hash exactly "#/game". Do not append "?g=" or the router will switch view.
    // history.replaceState avoids triggering hashchange if someone deep-linked earlier.
    if (location.hash !== "#/game") {
      history.replaceState(null, "", location.pathname + location.search + "#/game");
    }
  }

  async function loadGame(id: keyof typeof loaders) {
    root.querySelectorAll(".arcade-menu").forEach(n => n.remove());
    backBtn.style.display = "block";
    const mod = (await loaders[id]()).default as GameModule;
    mod.init(canvas, core);
    mod.start();
    current = mod;
    // Keep hash as "#/game" to satisfy your router
  }

  // deep link support once, without changing router key
  (() => {
    const [path, query] = location.hash.split("?");
    if (path === "#/game" && query) {
      const g = new URLSearchParams(query).get("g") as keyof typeof loaders | null;
      if (g && g in loaders) {
        loadGame(g);
        history.replaceState(null, "", location.pathname + location.search + "#/game");
        return;
      }
    }
    showMenu();
  })();

  // audio unlock on first touch
  canvas.addEventListener("pointerdown", (e) => {
    e.stopPropagation();
    core.audio.unlock();
    core.audio.setEnabled(!core.store.getBool("muted", true));
  }, { once: true, passive: true });

  return root;
}
