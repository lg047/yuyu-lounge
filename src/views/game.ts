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
const asset = (p: string) => (base.endsWith("/") ? base : base + "/") + p.replace(/^\//, "");

export default function GameView(): HTMLElement {
  const root = document.createElement("div");
  root.id = "game-root";

  // Small viewport box for the canvas
  const viewport = document.createElement("div");
  viewport.className = "game-viewport";
  viewport.style.display = "none"; // hidden while in menu
  root.appendChild(viewport);

  const canvas = document.createElement("canvas");
  canvas.id = "game-canvas";
  viewport.appendChild(canvas);

  // Controls row under the canvas
  const controls = document.createElement("div");
  controls.className = "game-controls";
  controls.style.display = "none";
  const backBtn = document.createElement("div");
  backBtn.className = "game-btn";
  backBtn.textContent = "Back";
  const muteBtn = document.createElement("div");
  muteBtn.className = "game-btn";
  controls.appendChild(backBtn);
  controls.appendChild(muteBtn);
  root.appendChild(controls);

  const core = makeCore(canvas);

  // Fit the root to the visible viewport below your header
  function fitRootHeight() {
    const top = root.getBoundingClientRect().top;
    const h = Math.max(360, Math.round(window.innerHeight - top));
    root.style.height = h + "px";
    core.resize();
  }
  requestAnimationFrame(fitRootHeight);
  window.addEventListener("resize", fitRootHeight);

  // Mute toggle
  const updateMuteLabel = () => {
    const muted = core.store.getBool("muted", true);
    muteBtn.textContent = muted ? "Unmute" : "Mute";
  };
  updateMuteLabel();
  muteBtn.onclick = () => {
    const was = core.store.getBool("muted", true);
    core.store.setBool("muted", !was);
    core.audio.setEnabled(was);
    updateMuteLabel();
    if (core.audio.enabled) core.audio.beep(660, 60);
  };

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
    viewport.style.display = "none";
    controls.style.display = "none";

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
      e.stopPropagation();
      const id = el.dataset.g as keyof typeof loaders;
      await loadGame(id);
    };
    root.querySelectorAll(".arcade-menu").forEach(n => n.remove());
    root.appendChild(overlay);
    if (location.hash !== "#/game") {
      history.replaceState(null, "", location.pathname + location.search + "#/game");
    }
  }

  async function loadGame(id: keyof typeof loaders) {
    root.querySelectorAll(".arcade-menu").forEach(n => n.remove());
    viewport.style.display = "block";
    controls.style.display = "flex";
    const mod = (await loaders[id]()).default as GameModule;
    mod.init(canvas, core);
    mod.start();
    current = mod;
    fitRootHeight();
  }

  backBtn.onclick = () => showMenu();

  // deep link once then normalize
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
  canvas.addEventListener("pointerdown", () => {
    core.audio.unlock();
    core.audio.setEnabled(!core.store.getBool("muted", true));
  }, { once: true, passive: true });

  return root;
}
