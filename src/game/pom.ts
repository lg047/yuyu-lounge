import type { Core } from "./core/loop";

type Ob = { x: number; y: number; w: number; h: number; type: 0; counted?: boolean }; // walls only

function aabb(ax: number, ay: number, aw: number, ah: number, bx: number, by: number, bw: number, bh: number) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

// Tunables in CSS px
const INITIAL_BUFFER = 0.9;   // seconds to first spawn
const BASE_SPEED = 120;       // CSS px/s
const MAX_SPEED = 280;        // CSS px/s cap
const GAP = 300;              // vertical opening (smaller than before)
const WALL_THICK = 28;        // CSS px
const SPAWN_MAX = 2.2;        // initial spawn interval (s)
const SPAWN_MIN = 1.6;        // fastest spawn interval (s)

const game = {
  meta: { id: "pom", title: "Pom Dash", bestKey: "best.pom" },

  _core: null as Core | null,
  _ob: [] as Ob[],
  _playerY: 0,
  _vy: 0,             // CSS px/s scaled by dpr in integration
  _running: false,
  _dead: false,
  _speed: BASE_SPEED, // CSS px/s
  _time: 0,           // seconds since start for ramp
  _spawnTimer: INITIAL_BUFFER,
  _spawnInterval: SPAWN_MAX,
  _score: 0,
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
    this._time = 0;
    this._spawnTimer = INITIAL_BUFFER;
    this._spawnInterval = SPAWN_MAX;
    this._score = 0;
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
      if (this._dead) return;
      if (!this._running) return;

      const H = core.canvas.height;
      const W = core.canvas.width;
      const dpr = core.dpr;

      this._time += dt;

      // input
      const p = core.input.p;
      const hold = p.down || this._kbdDown;

      // accelerations scaled into device px/s^2
      const upAccel = 1600 * dpr;
      const gravity = 1100 * dpr;

      if (hold) this._vy -= upAccel * dt;
      else this._vy += gravity * dt;

      // integrate and clamp
      const pupH = 60 * dpr;
      this._playerY += this._vy * dt;
      if (this._playerY < pupH * 0.5) { this._playerY = pupH * 0.5; this._vy = 0; }
      if (this._playerY > H - pupH * 0.5) { this._playerY = H - pupH * 0.5; this._vy = 0; }

      // spawn at right edge, consistent buffer
      this._spawnTimer -= dt;
      if (this._spawnTimer <= 0) {
        this._spawnTimer = this._spawnInterval;
        // interval eases down with score, never below SPAWN_MIN
        this._spawnInterval = Math.max(SPAWN_MIN, SPAWN_MAX - this._score * 0.05);

        const gap = GAP * dpr;
        const thickness = WALL_THICK * dpr;
        const cy = 140 * dpr + Math.random() * (H - 280 * dpr);
        const x = W + 2; // just off-screen
        const hTop = Math.max(0, cy - gap * 0.5);
        const hBotY = cy + gap * 0.5;
        const hBot = Math.max(0, H - hBotY);
        this._ob.push({ x, y: 0, w: thickness, h: hTop, type: 0, counted: false });
        this._ob.push({ x, y: hBotY, w: thickness, h: hBot, type: 0 });
      }

      // move walls with CSS speed converted to device px/s
      const vx = this._speed * dpr * dt;
      for (let i = 0; i < this._ob.length; i++) this._ob[i].x -= vx;
      this._ob = this._ob.filter(o => o.x + o.w > -40 * dpr);

      // collisions and scoring
      const px = 120 * dpr, py = this._playerY - pupH * 0.5, pw = 72 * dpr, ph = pupH;

      for (const o of this._ob) {
        // score once when the top wall pair passes player x
        if (o.y === 0 && o.type === 0 && !o.counted && o.x + o.w < px) {
          o.counted = true;
          this._score += 1;
        }
        if (aabb(px, py, pw, ph, o.x, o.y, o.w, o.h)) {
          this.gameOver();
          return;
        }
      }

      // non linear ramp that starts early
      // target speed = BASE + 16*t + 3*t^2, clamped
      const target = Math.min(MAX_SPEED, BASE_SPEED + 16 * this._time + 3 * this._time * this._time);
      // small smoothing to avoid jumps on slow frames
      this._speed += (target - this._speed) * Math.min(1, dt * 4);

      // draw
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = "#ffe6f3"; ctx.fillRect(0, 0, W, H);

      ctx.fillStyle = "#ffc3e4";
      for (const o of this._ob) ctx.fillRect(o.x, o.y, o.w, o.h);

      // player
      ctx.fillStyle = "white"; ctx.fillRect(px, py, pw, ph);

      // HUD
      const pad = 8 * dpr;
      ctx.font = `${20 * dpr}px system-ui, -apple-system, Segoe UI, Roboto, sans-serif`;
      ctx.textBaseline = "top"; ctx.textAlign = "left";

      const sText = `Score ${this._score}`;
      const bText = `Best ${this._best}`;
      const est = (t: string) => (12 * dpr) * t.length + pad * 2;
      const w1 = est(sText);
      const w2 = est(bText);

      roundRect(ctx, 12 * dpr, 10 * dpr, w1, 28 * dpr, 10 * dpr, "rgba(255,255,255,0.9)");
      ctx.fillStyle = "#ff4f98"; ctx.fillText(sText, 12 * dpr + pad, 14 * dpr);

      roundRect(ctx, 12 * dpr, 46 * dpr, w2, 28 * dpr, 10 * dpr, "rgba(255,255,255,0.9)");
      ctx.fillStyle = "#ff4f98"; ctx.fillText(bText, 12 * dpr + pad, 50 * dpr);
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

    // update best
    this._best = Math.max(this._best, this._score);
    core.store.setNumber(this.meta.bestKey, this._best);

    // persistent overlay
    const ctx = core.ctx;
    const W = core.canvas.width, H = core.canvas.height;
    ctx.fillStyle = "rgba(0,0,0,0.40)";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "white";
    ctx.font = `bold ${32 * core.dpr}px system-ui, -apple-system, Segoe UI, Roboto, sans-serif`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("Game Over", W / 2, H / 2 - 18 * core.dpr);
    ctx.font = `bold ${18 * core.dpr}px system-ui, -apple-system, Segoe UI, Roboto, sans-serif`;
    ctx.fillText("Press Retry or Back", W / 2, H / 2 + 18 * core.dpr);
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
