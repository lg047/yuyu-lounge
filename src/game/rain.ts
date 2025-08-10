// src/game/rain.ts
import type { makeCore } from "./core/loop";

type Core = ReturnType<typeof makeCore>;

type Treat = {
  x: number;
  y: number;
  vy: number;
  w: number;
  h: number;
  kind: 0 | 1; // 0 bone, 1 star
};

type Images = {
  bg: HTMLImageElement | null;
  pom: HTMLImageElement;
  bone: HTMLImageElement;
  star: HTMLImageElement;
};

type State = {
  time: number;
  score: number;
  best: number;
  misses: number;
  streak: number;
  bonusLevel: number;
  over: boolean;
  spawnAcc: number;
  spawnIv: number;
  fallBase: number;
  treats: Treat[];
  pom: {
    x: number;
    y: number;
    vx: number;
    w: number;
    h: number;
    targetX: number | null;
  };
};

export const meta = {
  id: "rain",
  title: "Treat Rain",
  bestKey: "best.rain",
} as const;

let core: Core;
let ctx: CanvasRenderingContext2D;
let canvas: HTMLCanvasElement;
let dpr = 1;

let images: Images;
let fontLoaded = false;

let state: State;

let reduceMotion = false;

// layout
const GROUND_H = 36;
const HUD_PAD = 12;
const BG_COLOR = "#0a0c1a"; // deep navy

// scratch
const _rect = { x: 0, y: 0, w: 0, h: 0 };

function basePath(p: string) {
  const base = (import.meta as any).env.BASE_URL as string;
  return (base.endsWith("/") ? base : base + "/") + p.replace(/^\//, "");
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const im = new Image();
    (im as any).decoding = "async";
    im.onload = () => resolve(im);
    im.onerror = () => reject(new Error("image load failed: " + src));
    im.src = src;
  });
}

async function loadAssets(): Promise<Images> {
  let bg: HTMLImageElement | null = null;
  try {
    bg = await loadImage(basePath("assets/game/bg/stars.png"));
  } catch {
    bg = null;
  }
  const [pom, bone, star] = await Promise.all([
    loadImage(basePath("assets/game/sprites/pom-front.png")),
    loadImage(basePath("assets/game/sprites/treat-bone.png")),
    loadImage(basePath("assets/game/sprites/treat-star.png")),
  ]);
  return { bg, pom, bone, star };
}

async function loadFont() {
  try {
    const url = basePath("assets/game/fonts/VT323.woff2");
    const font = new FontFace("VT323", `url("${url}") format("woff2")`, {
      style: "normal",
      weight: "400",
      display: "swap",
    });
    await font.load();
    (document as any).fonts?.add(font);
    fontLoaded = true;
  } catch {
    fontLoaded = false;
  }
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

function aabb(ax: number, ay: number, aw: number, ah: number, bx: number, by: number, bw: number, bh: number) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function smooth01(t: number) {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
}

function bgCoverPixelated(im: HTMLImageElement) {
  const w = canvas.width;
  const h = canvas.height;
  const prev = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;

  const scale = Math.max(w / im.width, h / im.height);
  const intScale = Math.max(1, Math.ceil(scale));
  const dw = im.width * intScale;
  const dh = im.height * intScale;
  const dx = (w - dw) >> 1;
  const dy = (h - dh) >> 1;
  ctx.drawImage(im, dx, dy, dw, dh);

  ctx.imageSmoothingEnabled = prev;
}

function resetState() {
  const W = canvas.width;
  const H = canvas.height;

  const pomTargetHeight = Math.round(56 * dpr);
  const pomAspect = images.pom.width / images.pom.height || 1;
  const pomW = Math.round(pomTargetHeight * pomAspect);
  const pomH = pomTargetHeight;

  state = {
    time: 0,
    score: 0,
    best: core.store.get<number>(meta.bestKey) ?? 0,
    misses: 0,
    streak: 0,
    bonusLevel: 0,
    over: false,
    spawnAcc: 0,
    spawnIv: 0.9,
    fallBase: 260,
    treats: [],
    pom: {
      x: (W - pomW) * 0.5,
      y: H - GROUND_H - pomH,
      vx: 0,
      w: pomW,
      h: pomH,
      targetX: null,
    },
  };
}

function updateDifficulty(t: number) {
  const sI = smooth01(t / 30);
  const sV = smooth01(t / 45);
  state.spawnIv = lerp(0.9, 0.35, sI);
  state.fallBase = lerp(260, 520, sV);
}

function spawnTreat() {
  const kind: 0 | 1 = Math.random() < 0.5 ? 0 : 1;
  const im = kind === 0 ? images.bone : images.star;
  const baseH = 24 * dpr;
  const aspect = im.width / im.height || 1;
  const w = Math.round(baseH * aspect);
  const h = Math.round(baseH);
  const x = Math.round(Math.random() * (canvas.width - w));
  const vy = state.fallBase * (0.9 + Math.random() * 0.2);
  state.treats.push({ x, y: -h, vy, w, h, kind });
}

function step(dtRaw: number) {
  const dt = Math.max(0, Math.min(dtRaw, 0.035));
  if (state.over) return;

  state.time += dt;
  updateDifficulty(state.time);

  const accel = 2200 * dpr;
  let ax = 0;
  if (core.input?.keys?.has?.("ArrowLeft") || core.input?.keys?.get?.("ArrowLeft")) ax -= accel;
  if (core.input?.keys?.has?.("ArrowRight") || core.input?.keys?.get?.("ArrowRight")) ax += accel;

  const p = state.pom;
  if (p.targetX != null) {
    const k = 26;
    const dx = p.targetX - (p.x + p.w * 0.5);
    p.vx += k * dx * dt;
  }
  p.vx += ax * dt;
  const damp = Math.exp(-8 * dt);
  p.vx *= damp;
  p.x += p.vx * dt;
  p.x = clamp(p.x, 0, canvas.width - p.w);

  state.spawnAcc += dt;
  const iv = state.spawnIv;
  while (state.spawnAcc >= iv) {
    state.spawnAcc -= iv;
    spawnTreat();
  }

  const H = canvas.height;
  const groundY = H - GROUND_H;

  const px = p.x + p.w * 0.15;
  const py = p.y + p.h * 0.1;
  const pw = p.w * 0.7;
  const ph = p.h * 0.75;

  for (let i = state.treats.length - 1; i >= 0; i--) {
    const o = state.treats[i];
    o.y += o.vy * dt;

    if (aabb(px, py, pw, ph, o.x, o.y, o.w, o.h)) {
      state.streak += 1;
      state.bonusLevel = Math.floor(state.streak / 5);
      const gain = 1 + state.bonusLevel;
      state.score += gain;
      core.audio.beep(900, 40);
      state.treats.splice(i, 1);
      continue;
    }

    if (o.y > groundY) {
      state.treats.splice(i, 1);
      state.misses += 1;
      state.streak = 0;
      state.bonusLevel = 0;
      core.audio.beep(240, 80);
      if (state.misses >= 3) {
        state.over = true;
        if (state.score > state.best) {
          state.best = state.score;
          core.store.set(meta.bestKey, state.best);
        }
        core.audio.beep(180, 180);
        break;
      }
    }
  }
}

function draw() {
  const W = canvas.width;
  const H = canvas.height;

  // hard fill so the canvas is never transparent
  ctx.fillStyle = BG_COLOR;
  ctx.fillRect(0, 0, W, H);

  // background texture if available
  if (images.bg) {
    bgCoverPixelated(images.bg);
  }

  // ground
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, H - GROUND_H, W, GROUND_H);
  ctx.strokeStyle = "#e5e7eb";
  ctx.lineWidth = 1;
  ctx.beginPath();
  const tickH = 8 * dpr;
  for (let x = 0; x < W; x += 12 * dpr) {
    ctx.moveTo(x + 0.5, H - GROUND_H);
    ctx.lineTo(x + 0.5, H - GROUND_H + tickH);
  }
  ctx.stroke();

  // pom
  const p = state.pom;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(images.pom, p.x | 0, p.y | 0, p.w | 0, p.h | 0);

  // treats
  for (let i = 0; i < state.treats.length; i++) {
    const o = state.treats[i];
    const im = o.kind === 0 ? images.bone : images.star;
    ctx.drawImage(im, o.x | 0, o.y | 0, o.w | 0, o.h | 0);
  }

  // HUD
  ctx.textBaseline = "top";
  ctx.font = `${Math.round(24 * dpr)}px VT323, monospace`;

  ctx.fillStyle = "#ffffff";
  ctx.fillText(`Score ${state.score}`, HUD_PAD, HUD_PAD);

  ctx.fillStyle = "#aeeaff";
  ctx.fillText(`Best ${state.best}`, HUD_PAD, HUD_PAD + 26 * dpr);

  // lives
  const r = 8 * dpr;
  const gap = 8 * dpr;
  let x = W - HUD_PAD - 3 * r * 2 - 2 * gap + r;
  const y = HUD_PAD + r;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = i < 3 - state.misses ? "#ffffff" : "rgba(255,255,255,0)";
    ctx.fill();
    ctx.lineWidth = Math.max(1, Math.round(2 * dpr));
    ctx.strokeStyle = "#ff4f98";
    ctx.stroke();
    x += r * 2 + gap;
  }

  if (state.over) drawGameOverCard();
}

function drawGameOverCard() {
  const W = canvas.width;
  const H = canvas.height;

  const cardW = Math.round(Math.min(W * 0.8, 360 * dpr));
  const cardH = Math.round(220 * dpr);
  const x = ((W - cardW) >> 1) + 0.5;
  const y = ((H - cardH) >> 1) + 0.5;
  const r = Math.round(12 * dpr);

  ctx.fillStyle = "#ffffff";
  roundRect(x, y, cardW, cardH, r, true, false);
  ctx.lineWidth = Math.max(1, Math.round(2 * dpr));
  ctx.strokeStyle = "#c6d9ff";
  roundRect(x, y, cardW, cardH, r, false, true);

  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "center";

  ctx.fillStyle = "#0a0c1a";
  ctx.font = `${Math.round(28 * dpr)}px VT323, monospace`;
  ctx.fillText("Game Over", x + cardW / 2, y + 40 * dpr);

  ctx.font = `${Math.round(22 * dpr)}px VT323, monospace`;
  ctx.fillText(`Score ${state.score}`, x + cardW / 2, y + 80 * dpr);
  ctx.fillStyle = "#4b5563";
  ctx.fillText(`Best ${state.best}`, x + cardW / 2, y + 108 * dpr);

  const bw = Math.round(120 * dpr);
  const bh = Math.round(36 * dpr);
  const bx = Math.round(x + (cardW - bw) / 2);
  const by = Math.round(y + cardH - bh - 24 * dpr);

  ctx.fillStyle = "#ff4f98";
  roundRect(bx, by, bw, bh, Math.round(8 * dpr), true, false);
  ctx.fillStyle = "#ffffff";
  ctx.font = `${Math.round(22 * dpr)}px VT323, monospace`;
  ctx.fillText("Retry", bx + bw / 2, by + bh / 2 + 8 * dpr - Math.round(8 * dpr));

  _rect.x = bx;
  _rect.y = by;
  _rect.w = bw;
  _rect.h = bh;

  ctx.textAlign = "start";
  ctx.textBaseline = "top";
}

function roundRect(x: number, y: number, w: number, h: number, r: number, fill: boolean, stroke: boolean) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  if (fill) ctx.fill();
  if (stroke) ctx.stroke();
}

// input
let onPointerDown: (e: PointerEvent) => void;
let onPointerMove: (e: PointerEvent) => void;
let onPointerUp: (e: PointerEvent) => void;
let onKeyDown: (e: KeyboardEvent) => void;
let onKeyUp: (e: KeyboardEvent) => void;
let onClick: (e: MouseEvent) => void;

function attachInput() {
  onPointerDown = (e: PointerEvent) => {
    canvas.setPointerCapture?.(e.pointerId);
    setTargetFromEvent(e);
  };
  onPointerMove = (e: PointerEvent) => {
    if (e.pressure === 0 && e.pointerType !== "mouse") return;
    setTargetFromEvent(e);
  };
  onPointerUp = () => {
    state.pom.targetX = null;
  };
  onClick = (e: MouseEvent) => {
    if (!state.over) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);
    if (x >= _rect.x && x <= _rect.x + _rect.w && y >= _rect.y && y <= _rect.y + _rect.h) {
      restart();
    }
  };
  onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") e.preventDefault();
  };
  onKeyUp = onKeyDown;

  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("click", onClick);
  window.addEventListener("keydown", onKeyDown, { passive: false });
  window.addEventListener("keyup", onKeyUp, { passive: false });
}

function detachInput() {
  canvas.removeEventListener("pointerdown", onPointerDown);
  canvas.removeEventListener("pointermove", onPointerMove);
  canvas.removeEventListener("pointerup", onPointerUp);
  canvas.removeEventListener("click", onClick);
  window.removeEventListener("keydown", onKeyDown);
  window.removeEventListener("keyup", onKeyUp);
}

function setTargetFromEvent(e: PointerEvent) {
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) * (canvas.width / rect.width);
  state.pom.targetX = clamp(x, 0, canvas.width);
}

function restart() {
  resetState();
}

function onResize() {
  const p = state.pom;
  p.y = canvas.height - GROUND_H - p.h;
  p.x = clamp(p.x, 0, canvas.width - p.w);
}

export async function init(c: HTMLCanvasElement, ccore: Core) {
  core = ccore;
  canvas = c;
  // request opaque canvas so it never composites with page background
  ctx = canvas.getContext("2d", { alpha: false }) as CanvasRenderingContext2D;

  dpr = core.dpr;
  reduceMotion = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  // CSS fallback color in case first frame is delayed
  canvas.style.background = BG_COLOR;
  canvas.style.imageRendering = "pixelated";

  const [assets] = await Promise.all([loadAssets(), loadFont()]);
  images = assets;

  resetState();

  core.resize(() => {
    dpr = core.dpr;
    onResize();
  });

  attachInput();
}

export function start() {
  core.run(
    (dt) => {
      const clamped = Math.max(0, Math.min(dt, 0.035));
      step(clamped);
    },
    () => {
      draw();
    }
  );
}

export function stop() {
  core.stop();
}

export function destroy() {
  detachInput();
}

export default function boot(coreCanvas: HTMLCanvasElement, ccore: Core) {
  init(coreCanvas, ccore).then(() => start());
}
