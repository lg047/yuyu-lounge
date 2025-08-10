import type { Core } from "./core/loop";

type Ob = { x: number; y: number; w: number; h: number; type: 0 }; // walls only

function aabb(ax: number, ay: number, aw: number, ah: number, bx: number, by: number, bw: number, bh: number) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

// Tunables
const INITIAL_BUFFER = 2.0;         // seconds before the first wall, same on every start
const BASE_SPEED = 80;              // px/s
const MAX_SPEED = 220;              // px/s cap
const RAMP_PER_SEC = 8;             // px/s^2 (gentle)
const GAP = 320;                    // vertical opening
const WALL_THICK = 28;              // px
const SPAWN_MIN = 2.2;              // slowest spawn
const SPAWN_MAX = 2.8;              // initial spawn
const LEAD_IN_X = 280;              // walls spawn this far off-screen to the right

const game = {
  meta: { id: "pom", title: "Pom Dash", bestKey: "best.pom" },

  _core: null as Core | null,
  _ob: [] as Ob[],
  _playerY: 0,
  _vy: 0,
  _running: false,
  _dead: false,
  _speed: BASE_SPEED,
  _spawnTimer: INITIAL_BUFFER,
  _spawnInterval: SPAWN_MAX,
  _dist: 0,             // distance in px for scoring
  _best: 0,
  // input
  _kbdDown: false,
  _onKeyDown: null as ((e: KeyboardEvent) => void) | null,
  _onKeyUp: null as ((e: KeyboardEvent) => void) | null,

  init(_canvas: HTMLCanvasElement, core: Core) {
    this._core = core;
    core.resize();
    this._best = core.store.getNumber(this.meta.bestKey, 0);

    // reset state
    this._ob = [];
    this._playerY = core.canvas.height * 0.5;
    this._vy = 0;
    this._running = false;
    this._dead = false;
    this._speed = BASE_SPEED;
    this._spawnTimer = INITIAL_BUFFER;
    this._spawnInterval = SPAWN_MAX;
    this._dist = 0;
    this._kbdDown = false;
  },

  start() {
    const core = this._core!;
    const ctx = core.ctx;

    // keyboard hold = Space or ArrowUp
    this._onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "ArrowUp") { this._kbdDown = true; e.preventDefault(); }
    };
    this._onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "ArrowUp") { this._kbdDown = false; e.preventDefault(); }
    };
    window.addEventListener("keydown", this._onKeyDown);
    window.addEventListener("keyup", this._onKeyUp);

    const step = (dt: number) => {
      const H = core.canvas.height;
      const W = core.canvas.width;

      // early out if we ever stop without cleaning rAF (safety)
      if (!this._running) return;

      // hold to rise, release to fall (no dash, no charge)
      const p = core.input.p;
      const hold = p.down || this._kbdDown;
      const upAccel = 1700;   // strong lift
      const gravity = 1200;   // gentle fall

      if (hold) this._vy -= upAccel * dt;
      else this._vy += gravity * dt;

      // integrate and clamp
      const pupH = 60;
      this._playerY += this._vy * dt;
      if (this._playerY < pupH * 0.5) { this._playerY = pupH * 0.5; this._vy = 0; }
      if (this._playerY > H - pupH * 0.5) { this._playerY = H - pupH * 0.5; this._vy = 0; }

      // spawn scheduling (consistent first wall and spacing)
      this._spawnTimer -= dt;
      if (this._spawnTimer <= 0) {
        this._spawnTimer = this._spawnInterval;
        // interval eases down slightly with score but never below SPAWN_MIN
        this._spawnInterval = Math.max(SPAWN_MIN, SPAWN_MAX - (this.scoreInt() / 150)); // very gentle
        // pick a safe center for the gap
        const cy = 140 + Math.random() * (H - 280);
        // spawn top and bottom walls well off-screen
        const x = W + LEAD_IN_X;
        const hTop = Math.max(0, cy - GAP * 0.5);
        const hBotY = cy + GAP * 0.5;
        const hBot = Math.max(0, H - hBotY);
        this._ob.push({ x, y: 0, w: WALL_THICK, h: hTop, type: 0 });
        this._ob.push({ x, y: hBotY, w: WALL_THICK, h: hBot, type: 0 });
      }

      // move walls and prune
      const vx = this._speed * dt;
      for (let i = 0; i < this._ob.length; i++) this._ob[i].x -= vx;
      this._ob = this._ob.filter(o => o.x + o.w > -40);

      // collisions
      const px = 120, py = this._playerY - pupH * 0.5, pw = 72, ph = pupH;
      for (const o of this._ob) {
        if (aabb(px, py, pw, ph, o.x, o.y, o.w, o.h)) {
          this.gameOver();
          return;
        }
      }

      // distance and speed ramp
      this._dist += this._speed * dt;                   // accumulate exact
      this._speed = Math.min(MAX_SPEED, this._speed + RAMP_PER_SEC * dt);

      // draw
      ctx.clearRect(0, 0, core.canvas.width, core.canvas.height);
      ctx.fillStyle = "#ffe6f3"; ctx.fillRect(0, 0, W, H);

      ctx.fillStyle = "#ffc3e4";
      for (const o of this._ob) ctx.fillRect(o.x, o.y, o.w, o.h);

      // player
      ctx.fillStyle = "white"; ctx.fillRect(px, py, pw, ph);

      // HUD boxes
      const score = this.scoreInt();
      const pad = 8;
      // score pill
      const sText = `Score ${score}`;
      const bText = `Best ${this._best}`;
      ctx.font = "bold 20px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
      ctx.textBaseline = "top"; ctx.textAlign = "left";
      // crude width estimate without measureText to stay cheap
      const w1 = 12 * sText.length + pad * 2;
      const w2 = 12 * bText.length + pad * 2;

      // score pill
      roundRect(ctx, 12, 10, w1, 28, 10, "rgba(255,255,255,0.9)");
      ctx.fillStyle = "#ff4f98"; ctx.fillText(sText, 12 + pad, 14);

      // best pill with extra spacing below
      roundRect(ctx, 12, 44, w2, 28, 10, "rgba(255,255,255,0.9)");
      ctx.fillStyle = "#ff4f98"; ctx.fillText(bText, 12 + pad, 48);
    };

    const draw = () => {};
    this._running = true;
    core.run(step, draw);
  },

  stop() {
    if (!this._core || !this._running) return;
    this._core.stop();
    this._running = false;
    if (this._onKeyDown) window.removeEventListener("keydown", this._onKeyDown);
    if (this._onKeyUp) window.removeEventListener("keyup", this._onKeyUp);
    this._onKeyDown = null;
    this._onKeyUp = null;
    this._kbdDown = false;
  },

  destroy() {},

  gameOver() {
    if (this._dead) return;
    const core = this._core!;
    this._dead = true;
    this.stop();

    // save best using integer score
    const s = this.scoreInt();
    this._best = Math.max(this._best, s);
    core.store.setNumber(this.meta.bestKey, this._best);

    // persistent overlay, no auto-retry
    const ctx = core.ctx;
    ctx.fillStyle = "rgba(0,0,0,0.40)";
    ctx.fillRect(0, 0, core.canvas.width, core.canvas.height);
    ctx.fillStyle = "white";
    ctx.font = "bold 32px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("Game Over", core.canvas.width / 2, core.canvas.height / 2 - 18);
    ctx.font = "bold 18px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
    ctx.fillText("Press Retry or Back", core.canvas.width / 2, core.canvas.height / 2 + 18);
  },

  scoreInt() {
    // map px → points; bigger divisor = slower scoring
    return Math.floor(this._dist / 6);
  }
};

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fill: string) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fill();
}

export default game;
