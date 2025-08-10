import type { Core } from "./core/loop";

type Ob = { x: number; y: number; w: number; h: number; type: 0; counted?: boolean };

function aabb(ax: number, ay: number, aw: number, ah: number, bx: number, by: number, bw: number, bh: number) {
  return ax < bx + bw && ax + aw > bx && ay + ah > by + 0;
}

/* Tunables */
const INITIAL_BUFFER = 0.6;
const BASE_SPEED     = 420;     // start speed (CSS px/s)
const K              = 0.045;   // exponential ramp rate
const GAP            = 300;     // vertical opening (CSS px)
const WALL_THICK     = 28;      // CSS px

const SPACING_START  = 330;     // CSS px between pairs at t=0
const SPACING_END    = 210;     // CSS px late game
const SPACING_DECAY  = 0.045;

const GROUND_H_CSS   = 14;      // ground stripe height (CSS px)
const GROUND_TILE    = 32;      // stripe repeat (CSS px)

/* Your star background */
const BG_IMG_PATH    = "assets/game/bg/stars.png";

/* Y2K font + glow */
function hudFont(px: number, dpr: number) {
  return `bold ${Math.round(px * dpr)}px "Trebuchet MS", Verdana, system-ui, -apple-system, sans-serif`;
}

const game = {
  meta: { id: "pom", title: "Pom Dash", bestKey: "best.pom" },

  _core: null as Core | null,
  _ob: [] as Ob[],
  _playerY: 0,
  _vy: 0,
  _running: false,
  _dead: false,
  _speed: BASE_SPEED,
  _time: 0,
  _spawnTimer: INITIAL_BUFFER,
  _score: 0,
  _best: 0,

  // visuals
  _bgImg: null as HTMLImageElement | null,
  _groundOff: 0,

  // input
  _kbdDown: false,
  _onKeyDown: null as ((e: KeyboardEvent) => void) | null,
  _onKeyUp: null as ((e: KeyboardEvent) => void) | null,

  init(canvas: HTMLCanvasElement, core: Core) {
    this._core = core;
    core.resize();
    this._best = core.store.getNumber(this.meta.bestKey, 0);

    this._ob = [];
    this._playerY = core.canvas.height * 0.5;
    this._vy = 0;
    this._running = false;
    this._dead = false;
    this._speed = BASE_SPEED;
    this._time = 0;
    this._spawnTimer = INITIAL_BUFFER;
    this._score = 0;
    this._groundOff = 0;
    this._kbdDown = false;

    // load background once
    if (!this._bgImg) {
      const img = new Image();
      const base = (import.meta as any).env.BASE_URL as string;
      img.src = (base.endsWith("/") ? base : base + "/") + BG_IMG_PATH;
      this._bgImg = img;
    }
  },

  start() {
    const core = this._core!;
    const ctx = core.ctx;

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

      // input and physics
      const hold = core.input.p.down || this._kbdDown;
      const upAccel = 1900 * dpr;
      const gravity = 1200 * dpr;
      if (hold) this._vy -= upAccel * dt; else this._vy += gravity * dt;

      const pupH = 60 * dpr;
      this._playerY += this._vy * dt;
      if (this._playerY < pupH * 0.5) { this._playerY = pupH * 0.5; this._vy = 0; }
      if (this._playerY > H - pupH * 0.5) { this._playerY = H - pupH * 0.5; this._vy = 0; }

      // ramp and spawn interval derived from spacing
      const targetSpeed = BASE_SPEED * Math.exp(K * this._time);
      this._speed += (targetSpeed - this._speed) * Math.min(1, dt * 4);

      const spacingPx = SPACING_END + (SPACING_START - SPACING_END) * Math.exp(-SPACING_DECAY * this._time);
      const spawnInterval = Math.max(0.32, spacingPx / this._speed);

      this._spawnTimer -= dt;
      if (this._spawnTimer <= 0) {
        this._spawnTimer += spawnInterval;
        const gap = GAP * dpr;
        const thickness = WALL_THICK * dpr;
        const cy = 140 * dpr + Math.random() * (H - 280 * dpr);
        const x = W + 2;
        const hTop = Math.max(0, cy - gap * 0.5);
        const hBotY = cy + gap * 0.5;
        const hBot = Math.max(0, H - hBotY);
        this._ob.push({ x, y: 0, w: thickness, h: hTop, type: 0, counted: false });
        this._ob.push({ x, y: hBotY, w: thickness, h: hBot, type: 0 });
      }

      // move world
      const vx = this._speed * dpr * dt;
      for (let i = 0; i < this._ob.length; i++) this._ob[i].x -= vx;
      this._ob = this._ob.filter(o => o.x + o.w > -40 * dpr);

      // score and collisions
      const px = 120 * dpr, py = this._playerY - pupH * 0.5, pw = 72 * dpr, ph = pupH;
      for (const o of this._ob) {
        if (o.y === 0 && !o.counted && o.x + o.w < px) { o.counted = true; this._score += 1; }
        if (aabb(px, py, pw, ph, o.x, o.y, o.w, o.h)) { this.gameOver(); return; }
      }

      // draw star background - pixelated cover
      if (this._bgImg && this._bgImg.complete) {
        drawCover(ctx, this._bgImg, W, H);
      } else {
        ctx.fillStyle = "#0a0c1a"; // fallback
        ctx.fillRect(0, 0, W, H);
      }

      // walls - pink that reads well on dark stars
      ctx.fillStyle = "#ffb6dd";
      for (const o of this._ob) ctx.fillRect(o.x, o.y, o.w, o.h);

      // player
      ctx.fillStyle = "white";
      ctx.fillRect(px, py, pw, ph);

      // moving ground strip
      const gh = Math.round(GROUND_H_CSS * dpr);
      const gy = H - gh;
      this._groundOff = (this._groundOff + vx) % Math.round(GROUND_TILE * dpr);
      ctx.fillStyle = "#ff79bc";
      ctx.fillRect(0, gy, W, gh);
      ctx.fillStyle = "#ff5eae";
      const tile = Math.round(GROUND_TILE * dpr);
      for (let x = -tile; x < W + tile; x += tile) {
        const rx = Math.round(x - this._groundOff);
        ctx.fillRect(rx, gy, Math.round(tile * 0.5), gh);
      }

      // HUD pills with neon glow - hot pink text on white pills
      const pad = 8 * dpr;
      ctx.font = hudFont(20, dpr);
      ctx.textBaseline = "top"; ctx.textAlign = "left";
      ctx.shadowColor = "rgba(255,79,152,0.7)";
      ctx.shadowBlur = 8 * dpr;

      const sText = `Score ${this._score}`;
      const bText = `Best ${this._best}`;
      const est = (t: string) => (12 * dpr) * t.length + pad * 2;
      const w1 = est(sText), w2 = est(bText);

      roundRect(ctx, 12 * dpr, 10 * dpr, w1, 28 * dpr, 10 * dpr, "rgba(255,255,255,0.96)");
      ctx.fillStyle = "#ff4f98"; ctx.fillText(sText, 12 * dpr + pad, 14 * dpr);

      roundRect(ctx, 12 * dpr, 46 * dpr, w2, 28 * dpr, 10 * dpr, "rgba(255,255,255,0.96)");
      ctx.fillStyle = "#ff4f98"; ctx.fillText(bText, 12 * dpr + pad, 50 * dpr);

      ctx.shadowBlur = 0; // reset
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
    const ctx = core.ctx;
    const W = core.canvas.width, H = core.canvas.height;
    const dpr = core.dpr;

    this._dead = true;
    this.stop();

    this._best = Math.max(this._best, this._score);
    core.store.setNumber(this.meta.bestKey, this._best);

    // backdrop (keeps stars visible)
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(0, 0, W, H);

    // card
    const cardW = Math.round(320 * dpr);
    const cardH = Math.round(200 * dpr);
    const cx = Math.round(W / 2 - cardW / 2);
    const cy = Math.round(H / 2 - cardH / 2);
    roundRect(ctx, cx, cy, cardW, cardH, 16 * dpr, "rgba(255,255,255,0.96)");

    ctx.fillStyle = "#ff4f98";
    ctx.font = hudFont(24, dpr);
    ctx.textAlign = "center"; ctx.textBaseline = "top";
    ctx.fillText("Game Over", cx + cardW / 2, cy + 14 * dpr);

    // scores
    ctx.font = hudFont(18, dpr);
    ctx.textAlign = "left";
    ctx.fillText(`Score: ${this._score}`, cx + 18 * dpr, cy + 58 * dpr);
    ctx.fillText(`Best:  ${this._best}`, cx + 18 * dpr, cy + 82 * dpr);

    // retry button
    const btnW = Math.round(180 * dpr), btnH = Math.round(40 * dpr);
    const bx = Math.round(cx + cardW / 2 - btnW / 2);
    const by = Math.round(cy + cardH - btnH - 16 * dpr);
    roundRect(ctx, bx, by, btnW, btnH, 12 * dpr, "#ff4f98");
    ctx.fillStyle = "white";
    ctx.font = hudFont(18, dpr);
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("Retry", bx + btnW / 2, by + btnH / 2);

    // click-to-retry once
    const onTap = (e: PointerEvent) => {
      const rect = core.canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) * dpr;
      const y = (e.clientY - rect.top) * dpr;
      if (x >= bx && x <= bx + btnW && y >= by && y <= by + btnH) {
        core.canvas.removeEventListener("pointerdown", onTap);
        this._dead = false;
        this.init(core.canvas, core);
        this.start();
      }
    };
    core.canvas.addEventListener("pointerdown", onTap, { passive: true });
  }
};

/* helpers */
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

function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, W: number, H: number) {
  // pixel-perfect "cover" draw without smoothing
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  if (!iw || !ih) return;
  const s = Math.max(W / iw, H / ih);
  const dw = Math.floor(iw * s);
  const dh = Math.floor(ih * s);
  const dx = Math.floor((W - dw) / 2);
  const dy = Math.floor((H - dh) / 2);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, 0, 0, iw, ih, dx, dy, dw, dh);
}

export default game;
