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

const base = (import.meta as any).env.BASE_URL as string;
const asset = (p: string) =>
  (base.endsWith("/") ? base : base + "/") + p.replace(/^\//, "");

export default function GameView(): HTMLElement {
  const root = document.createElement("div");
  root.id = "game-root";

  const viewport = document.createElement("div");
  viewport.className = "game-viewport";
  viewport.style.display = "none";
  root.appendChild(viewport);

  const canvas = document.createElement("canvas");
  canvas.id = "game-canvas";
  viewport.appendChild(canvas);

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

  function fitRootHeight() {
    const top = root.getBoundingClientRect().top;
    const h = Math.max(320, Math.round(window.innerHeight - top));
    root.style.height = h + "px";
    core.resize();
  }
  requestAnimationFrame(fitRootHeight);
  window.addEventListener("resize", fitRootHeight);

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

  function cleanupCurrent() {
    if (current) {
      try { current.stop(); } catch {}
      try { current.destroy(); } catch {}
      // hard clear canvas to avoid ghost frames
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      current = null;
    }
  }

  function showMenu() {
    cleanupCurrent();
    viewport.style.display = "none";
    controls.style.display = "none";

    root.querySelectorAll(".arcade-menu").forEach((n) => n.remove());

    const overlay = document.createElement("div");
    overlay.className = "arcade-menu";

    function tile(id: string, label: string, imgRel: string) {
      const imgUrl = asset(imgRel);
      return `<button class="game-icon" data-g="${id}" aria-label="${label}">
                <img src="${imgUrl}" alt="" decoding="async">
              </button>`;
    }

    overlay.innerHTML = `
      <div class="icons-row">
        ${tile("pom", "Pom Dash", "assets/game/icons/roos-hundred-acre-hop.png")}
        ${tile("rain", "Treat Rain", "assets/game/icons/NEWtreat-rain-tile.png")}
        ${tile("hop", "Cloud Hop", "assets/game/icons/cloud-hop-tile.png")}
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

    root.appendChild(overlay);

    if (location.hash !== "#/game") {
      history.replaceState(null, "", location.pathname + location.search + "#/game");
    }
  }

  async function loadGame(id: keyof typeof loaders) {
    cleanupCurrent(); // stop the old game before loading new
    root.querySelectorAll(".arcade-menu").forEach((n) => n.remove());
    viewport.style.display = "block";
    controls.style.display = "flex";
    const mod = (await loaders[id]()).default as GameModule;
    mod.init(canvas, core); // init draws first frame
    mod.start(); // start game loop
    current = mod;
    fitRootHeight();
  }

  backBtn.onclick = () => showMenu();

  window.addEventListener("hashchange", () => {
    const path = location.hash.split("?")[0];
    if (path === "#/game") {
      showMenu();
    }
  });

  document.addEventListener(
    "click",
    (e) => {
      const a = (e.target as HTMLElement).closest('a[href="#/game"]') as HTMLAnchorElement | null;
      if (!a) return;
      const path = location.hash.split("?")[0];
      if (path === "#/game") {
        e.preventDefault();
        showMenu();
      }
    },
    { capture: false, passive: false }
  );

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

  canvas.addEventListener(
    "pointerdown",
    () => {
      core.audio.unlock();
      core.audio.setEnabled(!core.store.getBool("muted", true));
    },
    { once: true, passive: true }
  );

  return root;
}
