import type { Core } from "./core/loop";

type Ob = { x: number; y: number; w: number; h: number; type: 0 }; // only walls

function aabb(ax: number, ay: number, aw: number, ah: number, bx: number, by: number, bw: number, bh: number) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

const game = {
  meta: { id: "pom", title: "Pom Dash", bestKey: "best.pom" },

  _core: null as Core | null,
  _ob: [] as Ob[],
  _playerY: 0,
  _vy: 0,
  _charge: 0,
  _running: false,
  _score: 0,
  _best: 0,
  _speed: 90,        // slower base scroll
  _spawnT: 0,
  _time: 0,

  // keyboard helpers
  _kbdDown: false,
  _kbdJust: false,
  _onKeyDown: null as ((e: KeyboardEvent) => void) | null,
  _onKeyUp: null as ((e: KeyboardEvent) => void) | null,

  init(_canvas: HTMLCanvasElement, core: Core) {
    this._core = core;
    core.resize();
    this._best = core.store.getNumber(this.meta.bestKey, 0);

    // reset
    this._playerY = core.canvas.height * 0.5;
    this._vy = 0;
    this._charge = 0;
    this._score = 0;
    this._speed = 90;
    this._spawnT = 2.2;   // first obstacle ~2.2 s after start
    this._time = 0;
    this._ob = [];

    this._kbdDown = false;
    this._kbdJust = false;
  },

  start() {
    const core = this._core!;
    const ctx = core.ctx;

    // keyboard support
    this._onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "ArrowUp") {
        if (!this._kbdDown) this._kbdJust = true;
        this._kbdDown = true;
        e.preventDefault();
      }
    };
    this._onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "ArrowUp") {
        this._kbdDown = false;
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", this._onKeyDown);
    window.addEventListener("keyup", this._onKeyUp);

    const step = (dt: number) => {
      const H = core.canvas.height;
      const W = core.canvas.width;
      this._time += dt;

      // inputs
      const p = core.input.p;
      const hold = p.down || this._kbdDown;
      const tap = p.justPressed || this._kbdJust;
      this._kbdJust = false;

      // easier vertical control
      const upAccel = 1700;  // stronger lift
      const gravity = 1200;  // gentler fall

      if (hold) {
        this._vy -= upAccel * dt;
        this._charge = Math.min(1, this._charge + dt);
      } else {
        this._vy += gravity * dt;
        this._charge = Math.max(0, this._charge - dt * 0.5);
      }

      if (tap && this._charge >= 0.6) {
        this._vy -= 480;     // modest dash
        this._charge = 0;
        if (core.audio.enabled) core.audio.beep(1100, 60);
      }

      // integrate and clamp
      const pupH = 60;
      this._playerY += this._vy * dt;
      if (this._playerY < pupH * 0.5) { this._playerY = pupH * 0.5; this._vy = 0; }
      if (this._playerY > H - pupH * 0.5) { this._playerY = H - pupH * 0.5; this._vy = 0; }

      // spawn walls only, much wider gaps, more spacing, start far to the right
      this._spawnT -= dt;
      const spawnEvery = Math.max(1.6, 2.4 - (this._score / 4000)); // slower spawn, gentle ramp
      if (this._time > 1.6 && this._spawnT <= 0) {
        this._spawnT = spawnEvery;
        const gap = 300; // wider gap
        const cy = 140 + Math.random() * (H - 280);
        const thickness = 28;
        const spawnX = W + 260; // bigger lead-in
        // top and bottom walls
        this._ob.push({ x: spawnX, y: 0, w: thickness, h: Math.max(0, cy - gap * 0.5), type: 0 });
        this._ob.push({ x: spawnX, y: cy + gap * 0.5, w: thickness, h: Math.max(0, H - (cy + gap * 0.5)), type: 0 });
      }

      // move and prune
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

      // score and speed
      this._score += Math.floor(this._speed * dt * 0.1);
      this._speed = Math.min(220, this._speed + 2 * dt); // slow ramp, lower cap

      // draw
      ctx.clearRect(0, 0, core.canvas.width, core.canvas.height);
      ctx.fillStyle = "#ffe6f3"; ctx.fillRect(0, 0, W, H);

      // walls
      ctx.fillStyle = "#ffc3e4";
      for (const o of this._ob) ctx.fillRect(o.x, o.y, o.w, o.h);

      // player rectangle, no face dots
      ctx.fillStyle = "white"; ctx.fillRect(px, py, pw, ph);

      // HUD
      ctx.fillStyle = "#ff4f98";
      ctx.font = "bold 22px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
      ctx.textBaseline = "top";
      ctx.textAlign = "left";
      ctx.fillText(`Score ${this._score}`, 12, 10);
      ctx.fillText(`Best ${this._best}`, 12, 34);
      ctx.fillStyle = "#ffd1ec"; ctx.fillRect(12, 58, 120, 8);
      ctx.fillStyle = "#ff6fa5"; ctx.fillRect(12, 58, 120 * this._charge, 8);
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
    this._kbdJust = false;
  },

  destroy() {},

  gameOver() {
    const core = this._core!;
    this.stop();
    if (core.audio.enabled) core.audio.beep(220, 140);
    this._best = Math.max(this._best, this._score);
    core.store.setNumber(this.meta.bestKey, this._best);

    // Draw overlay and do NOT auto-retry
    const ctx = core.ctx;
    ctx.fillStyle = "rgba(0,0,0,0.40)";
    ctx.fillRect(0, 0, core.canvas.width, core.canvas.height);
    ctx.fillStyle = "white";
    ctx.font = "bold 30px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Game Over", core.canvas.width / 2, core.canvas.height / 2 - 16);
    ctx.font = "bold 18px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
    ctx.fillText("Press Retry or Back", core.canvas.width / 2, core.canvas.height / 2 + 16);
  }
};

export default game;
