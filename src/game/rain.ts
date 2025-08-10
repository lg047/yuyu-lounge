import type { Core } from "./core/loop";

type Treat = { x: number; y: number; w: number; h: number; img: HTMLImageElement };

function aabb(ax: number, ay: number, aw: number, ah: number, bx: number, by: number, bw: number, bh: number) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

const BG_IMG_PATH     = "assets/game/bg/treat-rain-bg.png";
const FONT_PATH       = "assets/game/fonts/VT323.woff2";
const POM_IMG_PATH    = "assets/game/sprites/pom.png";
const BONE_IMG_PATH   = "assets/game/sprites/treat-bone.png";
const STAR_IMG_PATH   = "assets/game/sprites/treat-star.png";

const FALL_SPEED      = 180;
const TREAT_SIZE      = 48;

function hudFont(px: number, dpr: number) {
  return `bold ${Math.round(px * dpr)}px "VT323", ui-monospace, Menlo, Consolas, monospace`;
}

const game = {
  meta: { id: "rain", title: "Treat Rain", bestKey: "best.rain" },

  _core: null as Core | null,
  _playerX: 0,
  _playerY: 0,
  _running: false,
  _dead: false,
  _score: 0,
  _best: 0,

  _bgImg: null as HTMLImageElement | null,
  _pomImg: null as HTMLImageElement | null,
  _boneImg: null as HTMLImageElement | null,
  _starImg: null as HTMLImageElement | null,

  _treats: [] as Treat[],

  _onPointerMove: null as ((e: PointerEvent) => void) | null,
  _onPointerDown: null as ((e: PointerEvent) => void) | null,
  _onBlur: null as (() => void) | null,

  async init(canvas: HTMLCanvasElement, core: Core) {
    this._core = core;
    core.resize();
    this._best = core.store.getNumber(this.meta.bestKey, 0);

    this._score = 0;
    this._treats = [];
    this._running = false;
    this._dead = false;

    const H = core.canvas.height;
    const W = core.canvas.width;
    this._playerX = W / 2;
    this._playerY = H - 100 * core.dpr;

    // background
    if (!this._bgImg) {
      const img = new Image();
      const base = (import.meta as any).env.BASE_URL as string;
      img.src = (base.endsWith("/") ? base : base + "/") + BG_IMG_PATH;
      this._bgImg = img;
    }
    // pom
    if (!this._pomImg) {
      const img = new Image();
      const base = (import.meta as any).env.BASE_URL as string;
      img.src = (base.endsWith("/") ? base : base + "/") + POM_IMG_PATH;
      img.decoding = "async";
      this._pomImg = img;
    }
    // treats
    if (!this._boneImg) {
      const img = new Image();
      const base = (import.meta as any).env.BASE_URL as string;
      img.src = (base.endsWith("/") ? base : base + "/") + BONE_IMG_PATH;
      this._boneImg = img;
    }
    if (!this._starImg) {
      const img = new Image();
      const base = (import.meta as any).env.BASE_URL as string;
      img.src = (base.endsWith("/") ? base : base + "/") + STAR_IMG_PATH;
      this._starImg = img;
    }

    // font
    try {
      if (!document.fonts.check('12px "VT323"')) {
        const base = (import.meta as any).env.BASE_URL as string;
        const url = (base.endsWith("/") ? base : base + "/") + FONT_PATH;
        const ff = new FontFace("VT323", `url(${url}) format("woff2")`);
        const face = await ff.load();
        document.fonts.add(face);
      }
    } catch {}
  },

  start() {
    const core = this._core!;
    const ctx = core.ctx;

    // pointer movement
    this._onPointerMove = (e: PointerEvent) => {
      const rect = core.canvas.getBoundingClientRect();
      this._playerX = (e.clientX - rect.left) * core.dpr;
    };
    core.canvas.addEventListener("pointermove", this._onPointerMove);

    // pointer tap to start
    this._onPointerDown = () => { if (!this._running) this._running = true; };
    core.canvas.addEventListener("pointerdown", this._onPointerDown);

    this._onBlur = () => { this._running = false; };
    window.addEventListener("blur", this._onBlur);

    let spawnTimer = 0;

    const step = (dt: number) => {
      const W = core.canvas.width;
      const H = core.canvas.height;

      if (!this._running) return;

      // spawn
      spawnTimer -= dt;
      if (spawnTimer <= 0) {
        spawnTimer = 0.8;
        const isBone = Math.random() < 0.5;
        this._treats.push({
          x: Math.random() * (W - TREAT_SIZE * core.dpr),
          y: -TREAT_SIZE * core.dpr,
          w: TREAT_SIZE * core.dpr,
          h: TREAT_SIZE * core.dpr,
          img: isBone ? this._boneImg! : this._starImg!
        });
      }

      // move treats
      for (const t of this._treats) {
        t.y += FALL_SPEED * core.dpr * dt;
      }
      this._treats = this._treats.filter(t => t.y < H + t.h);

      // collisions
      const pw = 80 * core.dpr;
      const ph = 80 * core.dpr;
      const px = this._playerX - pw / 2;
      const py = this._playerY - ph / 2;

      for (const t of this._treats) {
        if (aabb(px, py, pw, ph, t.x, t.y, t.w, t.h)) {
          this._score += 1;
          if (core.audio.enabled) core.audio.beep(880, 30);
          t.y = H + 999; // remove
        }
      }

      // draw
      ctx.clearRect(0, 0, W, H);

      if (this._bgImg && this._bgImg.complete) drawCover(ctx, this._bgImg, W, H);
      else { ctx.fillStyle = "#0a0c1a"; ctx.fillRect(0, 0, W, H); }

      for (const t of this._treats) {
        if (t.img && t.img.complete) {
          ctx.drawImage(t.img, t.x, t.y, t.w, t.h);
        }
      }

      if (this._pomImg && this._pomImg.complete) {
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(this._pomImg, px, py, pw, ph);
        ctx.imageSmoothingEnabled = true;
      }

      ctx.font = hudFont(28, core.dpr);
      ctx.textBaseline = "top";
      ctx.textAlign = "left";
      ctx.fillStyle = "#ffffff";
      ctx.fillText(`Score ${this._score}`, 12 * core.dpr, 10 * core.dpr);
      ctx.fillStyle = "#d4b36f";
      ctx.fillText(`Best ${this._best}`, 12 * core.dpr, 44 * core.dpr);
    };

    const draw = () => {};
    core.run(step, draw);
  },

  stop() {
    if (!this._core) return;
    this._core.stop();
    this._running = false;

    if (this._onPointerMove) this._core.canvas.removeEventListener("pointermove", this._onPointerMove);
    if (this._onPointerDown) this._core.canvas.removeEventListener("pointerdown", this._onPointerDown);
    if (this._onBlur) window.removeEventListener("blur", this._onBlur);

    this._onPointerMove = null;
    this._onPointerDown = null;
    this._onBlur = null;
  },

  destroy() {}
};

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

export default game;
