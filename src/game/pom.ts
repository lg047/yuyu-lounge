import type { Core } from "./core/loop";

type Ob = { x: number; y: number; w: number; h: number; type: 0; counted?: boolean };

function aabb(ax: number, ay: number, aw: number, ah: number, bx: number, by: number, bw: number, bh: number) {
  // proper AABB check
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

/* Tunables */
const INITIAL_BUFFER = 0.6;
const BASE_SPEED     = 420;     // start speed (CSS px/s)
const K              = 0.045;   // exponential ramp
const GAP            = 300;     // opening (CSS px)
const WALL_THICK     = 28;

const SPACING_START  = 330;     // CSS px between pairs at t=0
const SPACING_END    = 210;     // late game
const SPACING_DECAY  = 0.045;

const GROUND_H_CSS   = 14;      // ground strip height (CSS px)
const GROUND_TILE    = 32;      // stripe repeat (CSS px)

const BG_IMG_PATH    = "assets/game/bg/stars.png";
const FONT_PATH      = "assets/game/fonts/VT323.woff2";

const WALL_COL      = "#dbe7ff";   // soft ice blue
const GROUND_MAIN   = "#eef3ff";   // ground band
const GROUND_BAR    = "#cfdcff";   // moving bars


const PILLAR_MAIN = "#dbe7ff";
const PILLAR_EDGE = "#c1d2ff";
const PILLAR_SHADOW = "#aabfff";
const PILLAR_HIGHLIGHT = "#ffffff";

const POM_IMG_PATH = "assets/game/sprites/pom.png";


/* VT323-like font helper */
function hudFont(px: number, dpr: number) {
  return `bold ${Math.round(px * dpr)}px "VT323", ui-monospace, Menlo, Consolas, monospace`;
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

  _pomImg: null as HTMLImageElement | null,

  // input
  _kbdDown: false,
  _onKeyDown: null as ((e: KeyboardEvent) => void) | null,
  _onKeyUp: null as ((e: KeyboardEvent) => void) | null,

  async init(canvas: HTMLCanvasElement, core: Core) {
    this._core = core;
    core.resize();
    this._best = core.store.getNumber(this.meta.bestKey, 0);

    // reset
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

    // load star background once
    if (!this._bgImg) {
      const img = new Image();
      const base = (import.meta as any).env.BASE_URL as string;
      img.src = (base.endsWith("/") ? base : base + "/") + BG_IMG_PATH;
      this._bgImg = img;
    }

    if (!this._pomImg) {
      const img = new Image();
      const base = (import.meta as any).env.BASE_URL as string;
      img.decoding = "async";
      img.src = (base.endsWith("/") ? base : base + "/") + POM_IMG_PATH;
      this._pomImg = img;
    }


    // load VT323 locally so canvas can use it offline
    try {
      if (!document.fonts.check('12px "VT323"')) {
        const base = (import.meta as any).env.BASE_URL as string;
        const url = (base.endsWith("/") ? base : base + "/") + FONT_PATH;
        const ff = new FontFace("VT323", `url(${url}) format("woff2")`);
        const face = await ff.load();
        document.fonts.add(face);
      }
    } catch { /* ignore */ }
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

      // ramp and spacing
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

      // move
      const vx = this._speed * dpr * dt;
      for (let i = 0; i < this._ob.length; i++) this._ob[i].x -= vx;
      this._ob = this._ob.filter(o => o.x + o.w > -40 * dpr);

      // score and collisions
      const px = 120 * dpr, py = this._playerY - pupH * 0.5, pw = 72 * dpr, ph = pupH;
      for (const o of this._ob) {
        if (o.y === 0 && !o.counted && o.x + o.w < px) { o.counted = true; this._score += 1; }
        if (aabb(px, py, pw, ph, o.x, o.y, o.w, o.h)) { this.gameOver(); return; }
      }
      // draw

      // background
      if (this._bgImg && this._bgImg.complete) drawCover(ctx, this._bgImg, W, H);
      else { ctx.fillStyle = "#0a0c1a"; ctx.fillRect(0, 0, W, H); }
      
      // pillars
      for (const o of this._ob) drawPillar(ctx, o.x, o.y, o.w, o.h, dpr, o.y === 0); // pillars
      // then player, ground, HUD...
      
      // moving ground
      const gh = Math.round(GROUND_H_CSS * dpr);
      const gy = H - gh;
      this._groundOff = (this._groundOff + vx) % Math.round(GROUND_TILE * dpr);
      ctx.fillStyle = GROUND_MAIN;
      ctx.fillRect(0, gy, W, gh);
      ctx.fillStyle = GROUND_BAR;
      const tile = Math.round(GROUND_TILE * dpr);
      for (let x = -tile; x < W + tile; x += tile) {
        const rx = Math.round(x - this._groundOff);
        ctx.fillRect(rx, gy, Math.round(tile * 0.5), gh);


     
      // 4) player sprite (above world)
      if (this._pomImg && this._pomImg.complete && this._pomImg.naturalWidth) {
        const prev = ctx.imageSmoothingEnabled;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(this._pomImg, Math.round(px), Math.round(py), Math.round(pw), Math.round(ph));
        ctx.imageSmoothingEnabled = prev;
      } else {
        ctx.fillStyle = "#fff";
        ctx.fillRect(px, py, pw, ph);
      }



      // HUD - no haze, no pills
      ctx.font = hudFont(28, dpr);
      ctx.textBaseline = "top"; ctx.textAlign = "left";
      ctx.fillStyle = "#ffffff";
      ctx.fillText(`Score ${this._score}`, 12 * dpr, 10 * dpr);
      ctx.fillStyle = "#aeeaff";
      ctx.fillText(`Best ${this._best}`, 12 * dpr, 44 * dpr);
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

// backdrop
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(0, 0, W, H);
    
    // card geometry
    const cardW = Math.round(320 * dpr);
    const cardH = Math.round(200 * dpr);
    const cx = Math.round(W / 2 - cardW / 2);
    const cy = Math.round(H / 2 - cardH / 2);
    const r  = 16 * dpr;
    
    // rounded fill + rounded stroke in one path
    roundedFillStroke(ctx, cx, cy, cardW, cardH, r, "#ffffff", "#c6d9ff", 2 * dpr);
    
    // title
    ctx.fillStyle = "#c6d9ff";
    ctx.font = hudFont(34, dpr);              // bigger title
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText("Game Over", cx + cardW / 2, cy + 14 * dpr);
    
    // scores - centered
    ctx.fillStyle = "#c6d9ff";                // VT323 style aqua
    ctx.font = hudFont(22, dpr);
    ctx.fillText(`Score: ${this._score}`, cx + cardW / 2, cy + 64 * dpr);
    ctx.fillText(`Best:  ${this._best}`,  cx + cardW / 2, cy + 92 * dpr);
    
    // retry button
    const btnW = Math.round(180 * dpr), btnH = Math.round(40 * dpr);
    const bx = Math.round(cx + cardW / 2 - btnW / 2);
    const by = Math.round(cy + cardH - btnH - 16 * dpr);
    roundedFillStroke(ctx, bx, by, btnW, btnH, 10 * dpr, "#c6d9ff", "#c6d9ff", 1); // filled pill
    ctx.fillStyle = "#ffffff";
    ctx.font = hudFont(22, dpr);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Retry", bx + btnW / 2, by + btnH / 2);
    
    // click to retry
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

function roundedFillStroke(
  ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number,
  r: number, fill: string, stroke: string, sw: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = sw;
  ctx.stroke();
}

function drawPillar(
  ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, dpr: number, isTop: boolean
) {
  const r = 6 * dpr;                 // corner radius
  const capH = Math.min(18 * dpr, h * 0.18);

  // body
  ctx.fillStyle = PILLAR_MAIN;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fill();

  // inner cap (rounded band at the gap side)
  const cy = isTop ? y + h - capH : y;
  ctx.fillStyle = PILLAR_EDGE;
  ctx.beginPath();
  ctx.moveTo(x + r, cy);
  ctx.arcTo(x + w, cy, x + w, cy + capH, r);
  ctx.arcTo(x + w, cy + capH, x, cy + capH, r);
  ctx.arcTo(x, cy + capH, x, cy, r);
  ctx.arcTo(x, cy, x + w, cy, r);
  ctx.closePath();
  ctx.fill();

  // side shading
  ctx.fillStyle = PILLAR_SHADOW;               // left shadow
  ctx.fillRect(x, y, Math.max(2 * dpr, w * 0.12), h);
  ctx.fillStyle = PILLAR_HIGHLIGHT;            // right highlight
  ctx.globalAlpha = 0.35;
  ctx.fillRect(x + w - Math.max(2 * dpr, w * 0.08), y + 2 * dpr, Math.max(2 * dpr, w * 0.08), h - 4 * dpr);
  ctx.globalAlpha = 1;
}



export default game;
