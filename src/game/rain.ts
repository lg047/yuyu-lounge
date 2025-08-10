// src/game/rain.ts
import type { Core } from "./core/loop";

let core: Core;
let canvas: HTMLCanvasElement;
let ctx: CanvasRenderingContext2D;
let dpr = 1;

let player: { x: number; y: number; w: number; h: number };
let treats: { x: number; y: number; w: number; h: number; img: HTMLImageElement }[] = [];
let images: Record<string, HTMLImageElement> = {};

const BG_COLOR = "#0a0c1a";
let lastSpawn = 0;
const spawnInterval = 1.2; // seconds

function loadImage(path: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = path;
  });
}

async function loadAssets() {
  const base = (import.meta as any).env.BASE_URL || "/";
  const asset = (p: string) =>
    (base.endsWith("/") ? base : base + "/") + p.replace(/^\//, "");
  const [bg, pom, bone, star] = await Promise.all([
    loadImage(asset("assets/game/bg/treat-rain-bg.png")),
    loadImage(asset("assets/game/sprites/pom.png")),
    loadImage(asset("assets/game/sprites/treat-bone.png")),
    loadImage(asset("assets/game/sprites/treat-star.png")),
  ]);
  images = { bg, pom, bone, star };
}

function resetState() {
  const cw = canvas.width / dpr;
  const ch = canvas.height / dpr;
  player = { x: cw / 2 - 16, y: ch - 48, w: 32, h: 32 };
  treats = [];
  lastSpawn = 0;
}

function spawnTreat() {
  const cw = canvas.width / dpr;
  const img = Math.random() < 0.5 ? images.bone : images.star;
  const size = 20;
  treats.push({
    x: Math.random() * (cw - size),
    y: -size,
    w: size,
    h: size,
    img,
  });
}

function step(dt: number) {
  // spawn treats
  lastSpawn += dt;
  if (lastSpawn >= spawnInterval || treats.length === 0) {
    spawnTreat();
    lastSpawn = 0;
  }

  // move treats
  for (const t of treats) {
    t.y += 100 * dt;
  }

  // remove off-screen
  treats = treats.filter((t) => t.y < canvas.height / dpr + t.h);
}

function draw() {
  // background
  ctx.fillStyle = BG_COLOR;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (images.bg) {
    ctx.drawImage(images.bg, 0, 0, canvas.width, canvas.height);
  }

  // treats
  for (const t of treats) {
    ctx.drawImage(t.img, t.x * dpr, t.y * dpr, t.w * dpr, t.h * dpr);
  }

  // player
  if (images.pom) {
    ctx.drawImage(images.pom, player.x * dpr, player.y * dpr, player.w * dpr, player.h * dpr);
  }
}

function attachInput() {
  const move = (clientX: number) => {
    const rect = canvas.getBoundingClientRect();
    const x = (clientX - rect.left) / dpr;
    player.x = x - player.w / 2;
  };
  canvas.addEventListener("pointermove", (e) => move(e.clientX));
  canvas.addEventListener("pointerdown", (e) => move(e.clientX));
}

function detachInput() {
  canvas.replaceWith(canvas.cloneNode(true)); // removes all listeners
}

export async function init(c: HTMLCanvasElement, ccore: Core) {
  core = ccore;
  canvas = c;
  dpr = core.dpr || window.devicePixelRatio || 1;
  ctx = canvas.getContext("2d", { alpha: false }) as CanvasRenderingContext2D;
  canvas.style.background = BG_COLOR;
  canvas.style.imageRendering = "pixelated";

  await loadAssets();
  resetState();
  draw(); // immediate first frame with background + player + maybe first treat
  spawnTreat();

  core.resize(() => {
    dpr = core.dpr || window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    resetState();
    draw();
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
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

export function destroy() {
  detachInput();
}
