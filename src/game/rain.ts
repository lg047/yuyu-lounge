// src/game/rain.ts
import type { Core } from "./core/loop";

type Treat = { x: number; y: number; w: number; h: number; vy: number; kind: 0 | 1 };

function aabb(ax: number, ay: number, aw: number, ah: number, bx: number, by: number, bw: number, bh: number) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

/* Assets */
const BG_IMG_PATH    = "assets/game/bg/treat-rain-bg.png";
const FONT_PATH      = "assets/game/fonts/VT323.woff2";
const POM_IMG_PATH   = "assets/game/sprites/pom.png";
const BONE_IMG_PATH  = "assets/game/sprites/treat-bone.png";
const STAR_IMG_PATH  = "assets/game/sprites/treat-star.png";

/* Theme + layout */
const BG_COLOR     = "#0a0c1a";
const HUD_AQUA     = "#aeeaff";
const PINK         = "#ff4f98";
const ICE_STROKE   = "#c6d9ff";
const GROUND_H_CSS = 18;
const HUD_PAD_CSS  = 12;

/* Difficulty ramps */
const SPAWN_START_S = 0.9;
const SPAWN_END_S   = 0.35;   // by ~30 s
const FALL_START    = 260;    // px/s
const FALL_END      = 520;    // by ~45 s

/* Helpers */
function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }
function smooth01(t: number) { const x = clamp(t, 0, 1); return x * x * (3 - 2 * x); }
function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
function hudFont(px: number, dpr: number) { return `bold ${Math.round(px * dpr)}px "VT323", ui-monospace, Menlo, Consolas, monospace`; }

const game = {
  meta: { id: "rain", title: "Treat Rain", bestKey: "best.rain" },

  _core: null as Core | null,
  _running: false,
  _warmup: 0,
  _lastNow: 0,

  _time: 0,
  _score: 0,
  _best: 0,
  _misses: 0,
  _streak: 0,
  _bonus: 0,
  _over: false,

  _spawnAcc: 0,
  _spawnIv: SPAWN_START_S,
  _fallBase: FALL_START,

  _px: 0, _py: 0, _pw: 0, _ph: 0, _vx: 0,
  _targetX: null as number | null,

  _treats: [] as Treat[],

  _bgImg: null as HTMLImageElement | null,
  _pomImg: null as HTMLImageElement | null,
  _boneImg: null as HTMLImageElement | null,
  _starImg: null as HTMLImageElement | null,

  _onPD: null as ((e: PointerEvent)=>void) | null,
  _onPM: null as ((e: PointerEvent)=>void) | null,
  _onPU: null as ((e: PointerEvent)=>void) | null,
  _onClick: null as ((e: MouseEvent)=>void) | null,

  _rbx: 0, _rby: 0, _rbw: 0, _rbh: 0,

  async init(canvas: HTMLCanvasElement, core: Core) {
    this._core = core;
    core.resize();
    this._best = core.store.getNumber(this.meta.bestKey, 0);

    this._running = false;
    this._over = false;
    this._score = 0;
    this._misses = 0;
    this._streak = 0;
    this._bonus = 0;
    this._time = 0;
    this._spawnAcc = 0;
    this._spawnIv = SPAWN_START_S;
    this._fallBase = FALL_START;
    this._treats.length = 0;

    this._warmup = 2;
    this._lastNow = performance.now();

    core.canvas.style.touchAction = "none";
    core.canvas.style.background = BG_COLOR;
    core.canvas.style.imageRendering = "pixelated";

    const base = (import.meta as any).env.BASE_URL as string;
    const url = (p: string) => (base.endsWith("/") ? base : base + "/") + p;

    const loadImg = (p: string) =>
      new Promise<HTMLImageElement>((res) => {
        const im = new Image();
        im.decoding = "async";
        im.onload = () => res(im);
        im.onerror = () => {
          console.warn("[TreatRain] image failed to load:", url(p));
          res(im);
        };
        im.src = url(p);
      });

    if (!this._bgImg)   this._bgImg   = await loadImg(BG_IMG_PATH);
    if (!this._pomImg)  this._pomImg  = await loadImg(POM_IMG_PATH);
    if (!this._boneImg) this._boneImg = await loadImg(BONE_IMG_PATH);
    if (!this._starImg) this._starImg = await loadImg(STAR_IMG_PATH);

    try {
      if (!document.fonts.check('12px "VT323"')) {
        const ff = new FontFace("VT323", `url(${url(FONT_PATH)}) format("woff2")`);
        const face = await ff.load();
        document.fonts.add(face);
      }
    } catch {}

    const dpr = core.dpr;
    const H = core.canvas.height;
    const W = core.canvas.width;
    const targetH = Math.round(96 * dpr);
    const aspect = (this._pomImg!.naturalWidth || this._pomImg!.width) /
                   (this._pomImg!.naturalHeight || this._pomImg!.height) || 1;
    this._pw = Math.round(targetH * aspect);
    this._ph = targetH;
    this._px = Math.round((W - this._pw) * 0.5);
    this._py = Math.round(H - Math.round(GROUND_H_CSS * dpr) - this._ph);
    this._vx = 0;
    this._targetX = null;

    const ctx = core.ctx;
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, W, H);
    drawCover(ctx, this._bgImg, W, H);
  },

  start() {
    const core = this._core!;
    const ctx = core.ctx;
    const canvas = core.canvas;

    this._onPD = (e: PointerEvent) => {
      canvas.setPointerCapture?.(e.pointerId);
      this._setTargetFromEvent(e);
    };
    this._onPM = (e: PointerEvent) => {
      if (e.pressure === 0 && e.pointerType !== "mouse") return;
      this._setTargetFromEvent(e);
    };
    this._onPU = () => { this._targetX = null; };
    this._onClick = (e: MouseEvent) => {
      if (!this._over) return;
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) * (core.canvas.width / rect.width);
      const y = (e.clientY - rect.top) * (core.canvas.height / rect.height);
      if (x >= this._rbx && x <= this._rbx + this._rbw && y >= this._rby && y <= this._rby + this._rbh) {
        e.preventDefault();
        e.stopPropagation();
        if (core.audio.enabled) core.audio.beep(520, 80);
        canvas.removeEventListener("click", this._onClick!);
        this.stop();
        this.init(core.canvas, core).then(() => this.start());
      }
    };

    canvas.addEventListener("pointerdown", this._onPD!, { passive: true });
    canvas.addEventListener("pointermove", this._onPM!, { passive: true });
    canvas.addEventListener("pointerup", this._onPU!,   { passive: true });
    canvas.addEventListener("click", this._onClick!);

    this._running = true;

    const step = (_dtFromCore: number) => {
      const now = performance.now();
      let dt = (now - this._lastNow) / 1000;
      this._lastNow = now;

      // do not skip drawing on warmup or resumes
      if (this._warmup > 0 || dt > 0.2) {
        if (this._warmup > 0) this._warmup--;
        dt = 0;
      }

      dt = Math.max(0, Math.min(dt, 0.035));

      if (this._running && !this._over) {
        const dpr = core.dpr;
        const W = core.canvas.width;
        const H = core.canvas.height;

        this._time += dt;
        this._spawnIv  = lerp(SPAWN_START_S, SPAWN_END_S, smooth01(this._time / 30));
        this._fallBase = lerp(FALL_START,    FALL_END,    smooth01(this._time / 45));

        if (this._targetX != null) {
          const k = 26;
          const dx = this._targetX - (this._px + this._pw * 0.5);
          this._vx += k * dx * dt;
        }
        this._vx *= Math.exp(-8 * dt);
        this._px += this._vx * dt;
        this._px = clamp(this._px, 0, W - this._pw);

        this._spawnAcc += dt;
        if (this._treats.length === 0 || this._spawnAcc >= this._spawnIv) {
          this._spawnAcc = 0;
          this._spawnOne();
        }

        const groundY = H - Math.round(GROUND_H_CSS * dpr);
        const hx = this._px + this._pw * 0.15;
        const hy = this._py + this._ph * 0.10;
        const hw = this._pw * 0.70;
        const hh = this._ph * 0.75;

        for (let i = this._treats.length - 1; i >= 0; i--) {
          const o = this._treats[i];
          o.y += o.vy * dt;

          if (aabb(hx, hy, hw, hh, o.x, o.y, o.w, o.h)) {
            this._streak += 1;
            this._bonus = Math.floor(this._streak / 5);
            this._score += 1 + this._bonus;
            this._treats.splice(i, 1);
            if (core.audio.enabled) core.audio.beep(900, 40);
            continue;
          }
          if (o.y > groundY) {
            this._treats.splice(i, 1);
            this._misses += 1;
            this._streak = 0;
            this._bonus = 0;
            if (core.audio.enabled) core.audio.beep(240, 80);
            if (this._misses >= 3) {
              this._over = true;
              this._best = Math.max(this._best, this._score);
              core.store.setNumber(this.meta.bestKey, this._best);
              if (core.audio.enabled) core.audio.beep(180, 180);
              break;
            }
          }
        }
      }

      // draw
      const dpr = core.dpr;
      const W = core.canvas.width;
      const H = core.canvas.height;

      const ctx = core.ctx;
      ctx.fillStyle = BG_COLOR;
      ctx.fillRect(0, 0, W, H);
      drawCover(ctx, this._bgImg, W, H);

      const gh = Math.round(GROUND_H_CSS * dpr);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, H - gh, W, gh);
      ctx.strokeStyle = "#e5e7eb";
      ctx.lineWidth = 1;
      ctx.beginPath();
      const tickH = Math.round(8 * dpr);
      for (let x = 0; x < W; x += Math.round(12 * dpr)) {
        ctx.moveTo(x + 0.5, H - gh);
        ctx.lineTo(x + 0.5, H - gh + tickH);
      }
      ctx.stroke();

      // treats
      for (let i = 0; i < this._treats.length; i++) {
        const o = this._treats[i];
        const im = o.kind === 0 ? this._boneImg! : this._starImg!;
        if (im && im.naturalWidth > 0) {
          const prev = ctx.imageSmoothingEnabled;
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(im, o.x | 0, o.y | 0, o.w | 0, o.h | 0);
          ctx.imageSmoothingEnabled = prev;
        } else {
          ctx.fillStyle = o.kind === 0 ? "#ffd39b" : "#e6e6ff";
          ctx.fillRect(o.x | 0, o.y | 0, o.w | 0, o.h | 0);
        }
      }

      // player
      if (this._pomImg && this._pomImg.naturalWidth > 0) {
        const prev = ctx.imageSmoothingEnabled;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(this._pomImg, this._px | 0, this._py | 0, this._pw | 0, this._ph | 0);
        ctx.imageSmoothingEnabled = prev;
      } else {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(this._px | 0, this._py | 0, this._pw | 0, this._ph | 0);
      }

      // HUD
      ctx.textBaseline = "top";
      ctx.textAlign = "left";
      ctx.font = hudFont(24, dpr);
      ctx.fillStyle = "#ffffff";
      ctx.fillText(`Score ${this._score}`, Math.round(HUD_PAD_CSS * dpr), Math.round(HUD_PAD_CSS * dpr));
      ctx.fillStyle = HUD_AQUA;
      ctx.fillText(`Best ${this._best}`, Math.round(HUD_PAD_CSS * dpr), Math.round((HUD_PAD_CSS + 26) * dpr));

      const r = Math.round(8 * dpr);
      const gap = Math.round(8 * dpr);
      let cx = W - Math.round(HUD_PAD_CSS * dpr) - 3 * r * 2 - 2 * gap + r;
      const cy = Math.round(HUD_PAD_CSS * dpr) + r;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fillStyle = i < 3 - this._misses ? "#ffffff" : "rgba(255,255,255,0)";
        ctx.fill();
        ctx.lineWidth = Math.max(1, Math.round(2 * dpr));
        ctx.strokeStyle = PINK;
        ctx.stroke();
        cx += r * 2 + gap;
      }

      if (this._over) this._drawGameOver();
    };

    core.run(step, () => {});
  },

  stop() {
    if (!this._core) return;
    this._core.stop();
    this._running = false;

    const canvas = this._core.canvas;
    if (this._onPD) canvas.removeEventListener("pointerdown", this._onPD);
    if (this._onPM) canvas.removeEventListener("pointermove", this._onPM);
    if (this._onPU) canvas.removeEventListener("pointerup", this._onPU);
    if (this._onClick) canvas.removeEventListener("click", this._onClick);
    this._onPD = this._onPM = this._onPU = this._onClick = null;
  },

  destroy() {},

  _spawnOne() {
    const core = this._core!;
    const dpr = core.dpr;
    const kind: 0 | 1 = 0;
    const baseH = 44 * dpr;
    const im = kind === 0 ? this._boneImg! : this._starImg!;
    const aspect = (im.naturalWidth || im.width) / (im.naturalHeight || im.height) || 1;
    const w = Math.round(baseH * aspect);
    const h = Math.round(baseH);
    const x = Math.round(Math.random() * Math.max(1, core.canvas.width - w));
    const vy = this._fallBase * (0.9 + Math.random() * 0.2);
    this._treats.push({ x, y: -h, w, h, vy, kind });
  },

  _drawGameOver() {
    const core = this._core!;
    const ctx = core.ctx;
    const W = core.canvas.width, H = core.canvas.height, dpr = core.dpr;

    const cardW = Math.round(Math.min(W * 0.8, 360 * dpr));
    const cardH = Math.round(220 * dpr);
    const x = Math.round(W / 2 - cardW / 2) + 0.5;
    const y = Math.round(H / 2 - cardH / 2) + 0.5;
    const r = Math.round(12 * dpr);

    ctx.fillStyle = "#ffffff";
    roundRect(ctx, x, y, cardW, cardH, r);
    ctx.lineWidth = Math.max(1, Math.round(2 * dpr));
    ctx.strokeStyle = ICE_STROKE;
    ctx.stroke();

    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#0a0c1a";
    ctx.font = hudFont(28, dpr);
    ctx.fillText("Game Over", x + cardW / 2, y + Math.round(40 * dpr));
    ctx.font = hudFont(22, dpr);
    ctx.fillText(`Score ${this._score}`, x + cardW / 2, y + Math.round(80 * dpr));
    ctx.fillStyle = "#4b5563";
    ctx.fillText(`Best ${this._best}`, x + cardW / 2, y + Math.round(108 * dpr));

    const bw = Math.round(120 * dpr);
    const bh = Math.round(36 * dpr);
    const bx = Math.round(x + (cardW - bw) / 2);
    const by = Math.round(y + cardH - bh - Math.round(24 * dpr));

    ctx.fillStyle = PINK;
    roundRect(ctx, bx, by, bw, bh, Math.round(8 * dpr));
    ctx.fillStyle = "#ffffff";
    ctx.font = hudFont(20, dpr);
    ctx.textBaseline = "middle";
    ctx.fillText("Play Again", bx + bw / 2, by + bh / 2 + 1);

    this._rbx = bx; this._rby = by; this._rbw = bw; this._rbh = bh;
  },

  _setTargetFromEvent(e: PointerEvent) {
    const core = this._core!;
    const rect = core.canvas.getBoundingClientRect();
    this._targetX = (e.clientX - rect.left) * (core.canvas.width / rect.width);
  },
};

function drawCover(ctx: CanvasRenderingContext2D, im: HTMLImageElement | null, W: number, H: number) {
  if (!im || im.naturalWidth <= 0 || im.naturalHeight <= 0) return;
  const aspect = im.naturalWidth / im.naturalHeight;
  const targetH = W / aspect;
  if (targetH >= H) {
    ctx.drawImage(im, 0, (H - targetH) / 2, W, targetH);
  } else {
    const targetW = H * aspect;
    ctx.drawImage(im, (W - targetW) / 2, 0, targetW, H);
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
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
  ctx.closePath();
  ctx.fill();
}

export default game;
