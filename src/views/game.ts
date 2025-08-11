import "../styles/game.css";
import { makeCore } from "../game/core/loop";

type GameModule = {
  meta: { id: string; title: string; bestKey: string };
  init: (canvas: HTMLCanvasElement, core: ReturnType<typeof makeCore>) => void | Promise<void>;
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

/* Fallback beep that uses its own AudioContext.
   It will not mute or duck other media elements. */
let fallbackCtx: AudioContext | null = null;
function fallbackBeep(freq = 660, ms = 60) {
  try {
    const AC: any = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    if (!fallbackCtx) fallbackCtx = new AC();
    // resume if suspended due to autoplay policy
    if (fallbackCtx.state === "suspended") fallbackCtx.resume();
    const t0 = fallbackCtx.currentTime;
    const osc = fallbackCtx.createOscillator();
    const gain = fallbackCtx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    // small envelope to avoid clicks and keep volume gentle
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(0.08, t0 + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + ms / 1000);
    osc.connect(gain).connect(fallbackCtx.destination);
    osc.start();
    osc.stop(t0 + ms / 1000 + 0.02);
  } catch {
    // ignore
  }
}

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

  // loader overlay
  const loader = document.createElement("div");
  loader.style.cssText = [
    "position:fixed",
    "inset:0",
    "display:none",
    "align-items:center",
    "justify-content:center",
    "background:linear-gradient(#0008,#000c)",
    "font-family:'VT323',ui-monospace,Menlo,Consolas,monospace",
    "color:#dff1ff",
    "letter-spacing:1px",
    "z-index:9999",
    "transition:opacity 140ms ease-out",
  ].join(";");
  const loadBox = document.createElement("div");
  loadBox.style.cssText = [
    "width:min(420px,80vw)",
    "text-align:center",
    "padding:16px",
    "background:#0a1330",
    "border:2px solid #7ac6ff",
    "border-radius:10px",
    "box-shadow:0 0 20px #7ac6ff66",
  ].join(";");
  const loadTitle = document.createElement("div");
  loadTitle.textContent = "LOADING";
  loadTitle.style.cssText = "font-size:28px;margin-bottom:10px;color:#aeeaff;text-shadow:0 0 6px #7ac6ff";
  const barWrap = document.createElement("div");
  barWrap.style.cssText = "height:18px;background:#081024;border:2px solid #7ac6ff;border-radius:9px;overflow:hidden";
  const bar = document.createElement("div");
  bar.style.cssText = "height:100%;width:0%;background:linear-gradient(90deg,#79ffe1,#7ac6ff)";
  barWrap.appendChild(bar);
  const pct = document.createElement("div");
  pct.style.cssText = "margin-top:8px;font-size:18px;color:#9bd3ff";
  pct.textContent = "0%";
  loadBox.appendChild(loadTitle);
  loadBox.appendChild(barWrap);
  loadBox.appendChild(pct);
  loader.appendChild(loadBox);
  root.appendChild(loader);

  const core = makeCore(canvas);
  ;(window as any).__core = core; // TEMP diagnostics
  
  function fitRootHeight() {
    const top = root.getBoundingClientRect().top;
    const h = Math.max(320, Math.round(window.innerHeight - top));
    root.style.height = h + "px";
    core.resize();
  }
  requestAnimationFrame(fitRootHeight);
  window.addEventListener("resize", fitRootHeight);

  const updateMuteLabel = () => {
    const muted = core.store.getBool("muted", false);
    muteBtn.textContent = muted ? "Unmute" : "Mute";
  };
  updateMuteLabel();
  muteBtn.onclick = () => {
    // make sure WebAudio context is running
    core.audio.unlock();
    const was = core.store.getBool("muted", false);
    core.store.setBool("muted", !was);
    core.audio.setEnabled(was); // enable when unmuting
    updateMuteLabel();
    if (core.audio.enabled) {
      try { core.audio.beep(660, 60); } catch {}
      // also ping fallback in case the game's audio engine is blocked on this device
      fallbackBeep(660, 40);
    }
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

  // asset manifests per game for a simple progress bar
  const manifests: Record<keyof typeof loaders, string[]> = {
    pom: [
      "assets/game/bg/roo-bg.png",
      "assets/game/sprites/roo_hop.png",
      "assets/game/fonts/VT323.woff2",
    ],
    rain: [
      "assets/game/bg/NEWtreat-rain-bg.png",
      "assets/game/sprites/NEWpom.png",
      "assets/game/sprites/treat-bone.png",
      "assets/game/fonts/VT323.woff2",
    ],
    hop: [
      "assets/game/fonts/VT323.woff2",
    ],
  };

  async function preload(id: keyof typeof loaders) {
    const items = manifests[id] || [];
    if (items.length === 0) return;
    loader.style.display = "flex";
    loader.style.opacity = "1";
    bar.style.width = "0%";
    pct.textContent = "0%";

    let done = 0;
    const bump = () => {
      done++;
      const q = Math.max(0, Math.min(100, Math.round((done / items.length) * 100)));
      bar.style.width = q + "%";
      pct.textContent = q + "%";
    };

    const tasks = items.map((rel) => {
      const url = asset(rel);
      if (rel.endsWith(".woff2")) {
        if (document.fonts.check('12px "VT323"')) { bump(); return Promise.resolve(); }
        const ff = new FontFace("VT323", `url(${url}) format("woff2")`);
        return ff.load().then(face => { document.fonts.add(face); bump(); }).catch(() => { bump(); });
      } else {
        return new Promise<void>((res) => {
          const im = new Image();
          im.onload = () => { bump(); res(); };
          im.onerror = () => { bump(); res(); };
          im.decoding = "async";
          im.src = url;
        });
      }
    });

    await Promise.all(tasks);
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
        ${tile("rain", "Treat Rain", "assets/game/icons/NEW1treat-rain-tile.png")}
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

    await preload(id);

    const mod = (await loaders[id]()).default as GameModule;

    await mod.init(canvas, core);
    mod.start();
    current = mod;
    fitRootHeight();

    requestAnimationFrame(() => {
      loader.style.opacity = "0";
      setTimeout(() => { loader.style.display = "none"; }, 160);
    });
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

  // unlock audio on the first user interaction anywhere, and ping a quiet fallback beep if unmuted
  const unlockOnce = () => {
    try { core.audio.unlock(); } catch {}
    const muted = core.store.getBool("muted", false);
    core.audio.setEnabled(!muted);
    if (!muted) fallbackBeep(440, 40);
  };
  document.addEventListener("pointerdown", unlockOnce, { once: true, passive: true });
  document.addEventListener("keydown", unlockOnce, { once: true });
  document.addEventListener("touchstart", unlockOnce, { once: true, passive: true });

  return root;
}
