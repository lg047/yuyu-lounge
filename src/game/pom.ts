import type { Core } from "./core/loop";

type Ob = { x: number; y: number; w: number; h: number; type: 0 | 1 };

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
  _speed: 180,
  _spawnT: 0,

  // keyboard helpers
  _kbdDown: false,
  _kbdJust: false,
  _onKeyDown: null as ((e: KeyboardEvent) => void) | null,
  _onKeyUp: null as ((e: KeyboardEvent) => void) | null,

  init(_canvas: HTMLCanvasElement, core: Core) {
    this._core = core;
    core.resize();
    this._best = core.store.getNumber(this.meta.bestKey, 0);

    // reset state
    this._playerY = core.canvas.height * 0.5;
    this._vy = 0;
    this._charge = 0;
    this._score = 0;
    this._speed = 180;
    this._spawnT = 0;
    this._ob = [];

    // clear any leftover keyboard flags
    this._kbdDown = false;
    this._kbdJust = false;
  },

  start() {
    const core = this._core!;
    const ctx = core.ctx;

    // keyboard support on desktop
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

      // inputs
      const p = core.input.p;
      const hold = p.down || this._kbdDown;
      const tap = p.justPressed || this._kbdJust;
      this._kbdJust = false;

      const upAccel = 1100;
      const gravity = 1400;

      if (hold) {
        this._vy -= upAccel * dt;
        this._charge = Math.min(1, this._charge + dt);
      } else {
        this._vy += gravity * dt;
        this._charge = Math.max(0, this._charge - dt * 0.5);
      }

      if (tap && this._charge >= 0.6) {
        this._vy -= 600;
        this._charge = 0;
        if (core.audio.enabled) core.audio.beep(1100, 60);
      }

      // integrate and clamp
      const pupH = 60;
      this._playerY += this._vy * dt;
      if (this._playerY < pupH * 0.5) { this._playerY = pupH * 0.5; this._vy = 0; }
      if (this._playerY > H - pupH * 0.5) { this._playerY = H - pupH * 0.5; this._vy = 0; }

      // spawn
      this._spawnT -= dt;
      const spawnEvery = Math.max(0.45, 1.2 - (this._score / 2000));
      if (this._spawnT <= 0) {
        this._spawnT = spawnEvery;
        const gap = 180;
        const cy = 100 + Math.random() * (H - 200);
        const thickness = 36;
        if (Math.random() < 0.7) {
          this._ob.push({ x: W + 60, y: 0, w: thickness, h: cy - gap * 0.5, type: 0 });
          this._ob.push({ x: W + 60, y: cy + gap * 0.5, w: thickness, h: H - (cy + gap * 0.5), type: 0 });
        } else {
          const by = 80 + Math.random() * (H - 160);
          this._ob.push({ x: W + 60, y: by - 28, w: 56, h: 56, type: 1 });
        }
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
      this._speed = Math.min(480, this._speed + 8 * dt);

      // draw
      ctx.clearRect(0, 0, core.canvas.width, core.canvas.height);
      ctx.fillStyle = "#ffe6f3"; ctx.fillRect(0, 0, W, H);

      for (const o of this._ob) {
        if (o.type === 0) { ctx.fillStyle = "#ffc3e4"; ctx.fillRect(o.x, o.y, o.w, o.h); }
        else { ctx.fillStyle = "#ff6fa5"; ctx.beginPath(); ctx.arc(o.x + o.w*0.5, o.y + o.h*0.5, o.w*0.5, 0, Math.PI*2); ctx.fill(); }
      }

      // player
      ctx.fillStyle = "white"; ctx.fillRect(px, py, pw, ph);
      ctx.fillStyle = "#333"; ctx.fillRect(px + 20, py + 20, 6, 6); ctx.fillRect(px + 46, py + 20, 6, 6);

      // HUD
      ctx.fillStyle = "#ff4f98";
      ctx.font = "bold 28px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
      ctx.textBaseline = "top";
      ctx.textAlign = "left";
      ctx.fillText(`Score ${this._score}`, 20, 18);
      ctx.fillText(`Best ${this._best}`, 20, 50);
      ctx.fillStyle = "#ffd1ec"; ctx.fillRect(20, 84, 120, 10);
      ctx.fillStyle = "#ff6fa5"; ctx.fillRect(20, 84, 120 * this._charge, 10);
    };

    const draw = () => {};
    core.run(step, draw);
    this._running = true;
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

  destroy() {
    // nothing persistent to free yet
  },

  gameOver() {
    const core = this._core!;
    this.stop();
    if (core.audio.enabled) core.audio.beep(220, 140);
    this._best = Math.max(this._best, this._score);
    core.store.setNumber(this.meta.bestKey, this._best);

    const ctx = core.ctx;
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.fillRect(0, 0, core.canvas.width, core.canvas.height);
    ctx.fillStyle = "white";
    ctx.font = "bold 36px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Game Over", core.canvas.width / 2, core.canvas.height / 2 - 24);
    ctx.fillText("Tap Back to Menu", core.canvas.width / 2, core.canvas.height / 2 + 24);
  }
};

export default game;
