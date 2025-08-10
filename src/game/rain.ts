import { Core } from "./core/loop";

let core: Core;
let canvas: HTMLCanvasElement;
let ctx: CanvasRenderingContext2D;
let dpr = 1;

let pomX = 0;
let pomY = 0;
let pomImg: HTMLImageElement;
let boneImg: HTMLImageElement;
let starImg: HTMLImageElement;
let bgImg: HTMLImageElement;
let groundY = 0;

let treats: { x: number; y: number; type: "bone" | "star"; speed: number }[] = [];
let spawnTimer = 0;
let score = 0;
let misses = 0;
let over = false;
let running = false;

export const meta = {
  id: "rain",
  title: "Treat Rain",
  bestKey: "rain-best"
};

export async function init(c: HTMLCanvasElement, ccore: Core) {
  core = ccore;
  canvas = c;
  ctx = canvas.getContext("2d", { alpha: false }) as CanvasRenderingContext2D;
  dpr = core.dpr;

  // Load assets
  [pomImg, boneImg, starImg, bgImg] = await Promise.all([
    loadImage("assets/game/sprites/pom.png"),
    loadImage("assets/game/sprites/treat-bone.png"),
    loadImage("assets/game/sprites/treat-star.png"),
    loadImage("assets/game/bg/treat-rain-bg.png")
  ]);

  reset();
  attachInput();
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve) => {
    const img = new Image();
    img.src = src;
    img.onload = () => resolve(img);
  });
}

function reset() {
  pomX = canvas.width / 2 - pomImg.width / 2;
  pomY = canvas.height - pomImg.height - 20;
  groundY = canvas.height - 20;
  treats = [];
  spawnTimer = 0;
  score = 0;
  misses = 0;
  over = false;
}

function attachInput() {
  canvas.addEventListener("pointermove", (e) => {
    const rect = canvas.getBoundingClientRect();
    pomX = (e.clientX - rect.left) * (canvas.width / rect.width) - pomImg.width / 2;
  });

  canvas.addEventListener("pointerdown", () => {
    if (over) reset();
  });
}

export function start() {
  running = true;
  core.run(step, draw);
}

export function stop() {
  running = false;
  core.stop();
}

export function destroy() {
  running = false;
}

function step(dt: number) {
  if (!running) return;

  // Only update gameplay if not game over
  if (!over) {
    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      spawnTimer = 0.8 + Math.random() * 0.5;
      const type = Math.random() < 0.5 ? "bone" : "star";
      treats.push({
        x: Math.random() * (canvas.width - 24),
        y: -24,
        type,
        speed: 80 + Math.random() * 40
      });
    }

    for (const t of treats) {
      t.y += t.speed * dt;
    }

    // Collision check
    treats = treats.filter((t) => {
      if (
        t.y + 24 >= pomY &&
        t.x + 24 >= pomX &&
        t.x <= pomX + pomImg.width
      ) {
        score++;
        core.audio.beep(880, 50);
        return false;
      }
      if (t.y > groundY) {
        misses++;
        if (misses >= 3) over = true;
        return false;
      }
      return true;
    });
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Background
  ctx.drawImage(bgImg, 0, 0, canvas.width, canvas.height);

  // Pom
  ctx.drawImage(pomImg, pomX, pomY);

  // Treats
  for (const t of treats) {
    ctx.drawImage(t.type === "bone" ? boneImg : starImg, t.x, t.y);
  }

  // HUD
  ctx.fillStyle = "white";
  ctx.font = `${16 * dpr}px sans-serif`;
  ctx.fillText(`Score: ${score}`, 10, 20);
  ctx.fillText(`Misses: ${misses}`, 10, 40);

  if (over) {
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "white";
    ctx.font = `${24 * dpr}px sans-serif`;
    ctx.fillText("Game Over", canvas.width / 2 - 60, canvas.height / 2);
    ctx.font = `${14 * dpr}px sans-serif`;
    ctx.fillText("Tap to Restart", canvas.width / 2 - 55, canvas.height / 2 + 30);
  }
}
