// src/game/rain.ts
import type { Core } from "./core/loop";

/* assets */
const BG_IMG_PATH   = "assets/game/bg/stars.png";
const FONT_PATH     = "assets/game/fonts/VT323.woff2";
const POM_IMG_PATH  = "assets/game/sprites/pom-front.png";
const BONE_IMG_PATH = "assets/game/sprites/treat-bone.png";
const STAR_IMG_PATH = "assets/game/sprites/treat-star.png";

/* theme + layout */
const BG_COLOR   = "#0a0c1a";
const HUD_AQUA   = "#aeeaff";
const PINK       = "#ff4f98";
const ICE_STROKE = "#c6d9ff";
const GROUND_H_CSS = 18;  // css px height of ground strip
const HUD_PAD_CSS  = 12;

/* difficulty targets */
const SPAWN_START_S = 0.9;
const SPAWN_END_S   = 0.35;   // by 30 s
const FALL_START    = 260;    // px/s
const FALL_END      = 520;    // by 45 s

/* helpers */
function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }
function aabb(ax:number,ay:number,aw:number,ah:number,bx:number,by:number,bw:number,bh:number){
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}
function smooth01(t: number) { const x = clamp(t, 0, 1); return x * x * (3 - 2 * x); }
function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }

type Treat = {
  x: number; y: number; vy: number; w: number; h: number; kind: 0|1; // 0 bone, 1 star
};

const game = {
  meta: { id: "rain", title: "Treat Rain", bestKey: "best.rain" },

  _core: null as Core | null,
  _running: false,

  // assets
  _bgImg: null as HTMLImageElement | null,
  _pomImg: null as HTMLImageElement | null,
  _boneImg: null as HTMLImageElement | null,
  _starImg: null as HTMLImageElement | null,

  // state
  _time: 0,
  _score: 0,
  _best: 0,
  _misses: 0,
  _streak: 0,
  _bonusLevel: 0,
  _over: false,
  _spawnAcc: 0,
  _spawnIv: SPAWN_START_S,
  _fallBase: FALL_START,
  _treats: [] as Treat[],

  // pom
  _px: 0,
  _py: 0,
  _pw: 0,
  _ph: 0,
  _vx: 0,
  _targetX: null as number | null,

  // input handlers
  _onPD: null as ((e: PointerEvent)=>void) | null,
  _onPM: null as ((e: PointerEvent)=>void) | null,
  _onPU: null as ((e: PointerEvent)=>void) | null,
  _onClick: null as ((e: MouseEvent)=>void) | null,
  _onKD: null as ((e: KeyboardEvent)=>void) | null,
  _onKU: null as ((e: KeyboardEvent)=>void) | null,

  // retry button hitbox (device px)
  _rbx: 0, _rby: 0, _rbw: 0, _rbh: 0,

  async init(_canvas: HTMLCanvasElement, core: Core) {
    this._core = core;
    core.resize(); // let core own sizing
    this._running = false;

    this._best = core.store.getNumber(this.meta.bestKey, 0);

    // styles
    core.canvas.style.background = BG_COLOR;
    core.canvas.style.imageRendering = "pixelated";
    core.canvas.style.touchAction = "none";

    // lazy-load images once
    const base = (import.meta as any).env.BASE_URL as string;
    const url = (p: string) => (base.endsWith("/") ? base : base + "/") + p;

    const loadImg = (p: string) =>
      new Promise<HTMLImageElement>((res, rej) => { const im = new Image(); im.decoding = "async"; im.onload=()=>res(im); im.onerror=()=>rej(new Error(p)); im.src = url(p); });

    if (!this._bgImg)   this._bgImg   = await loadImg(BG_IMG_PATH).catch(()=>null);
    if (!this._pomImg)  this._pomImg  = await loadImg(POM_IMG_PATH);
    if (!this._boneImg) this._boneImg = await loadImg(BONE_IMG_PATH);
    if (!this._starImg) this._starImg = await loadImg(STAR_IMG_PATH);

    // ensure VT323 once
    try {
      if (!document.fonts.check('12px "VT323"')) {
        const ff = new FontFace("VT323", `url(${url(FONT_PATH)}) format("woff2")`);
        const face = await ff.load();
        document.fonts.add(face);
      }
    } catch { /* ignore */ }

    // reset
    this._time = 0;
    this._score = 0;
    this._misses = 0;
    this._streak = 0;
    this._bonusLevel = 0;
    this._over = false;
    this._spawnAcc = 0;
    this._spawnIv = SPAWN_START_S;
    this._fallBase = FALL_START;
    this._treats.length = 0;

    // place pom using device pixels
    const dpr = core.dpr;
    const H = core.canvas.height;
    const targetH = Math.round(56 * dpr);
    const aspect = (this._pomImg!.naturalWidth || this._pomImg!.width) / (this._pomImg!.naturalHeight || this._pomImg!.height) || 1;
    this._pw = Math.round(targetH * aspect);
    this._ph = targetH;
    this._px = Math.round((core.canvas.width - this._pw) * 0.5);
    this._py = Math.round(H - Math.round(GROUND_H_CSS * dpr) - this._ph);
    this._vx = 0;
    this._targetX = null;

    // immediate paint so the screen is not blank
    this._draw();

    // keep layout coherent on resize, but do not set canvas size here
    core.resize(() => {
      const dpr2 = core.dpr;
      const H2 = core.canvas.height;
      const targetH2 = Math.round(56 * dpr2);
      const aspect2 = (this._pomImg!.naturalWidth || this._pomImg!.width) / (this._pomImg!.naturalHeight || this._pomImg!.height) || 1;
      const oldPW = this._pw;

      this._pw = Math.round(targetH2 * aspect2);
      this._ph = targetH2;
      this._py = Math.round(H2 - Math.round(GROUND_H_CSS * dpr2) - this._ph);
      // keep center proportionally
      const cx = this._px + oldPW * 0.5;
      this._px = clamp(Math.round(cx - this._pw * 0.5), 0, core.canvas.width - this._pw);
      this._draw();
    });

    // input
    this._attachInput();
  },

  start() {
    const core = this._core!;
    this._running = true;

    core.run(
      (dtRaw: number) => {
        // clamp dt
        const dt = Math.max(0, Math.min(dtRaw, 0.035));
        if (!this._running || this._over) return;

        const dpr = core.dpr;
        const W = core.canvas.width;
        const H = core.canvas.height;

        this._time += dt;

        // difficulty ramps
        this._spawnIv  = lerp(SPAWN_START_S, SPAWN_END_S, smooth01(this._time / 30));
        this._fallBase = lerp(FALL_START,    FALL_END,   smooth01(this._time / 45));

        // keyboard accel
        const accel = 2200 * dpr;
        let ax = 0;
        if (core.input.keys.get("ArrowLeft"))  ax -= accel;
        if (core.input.keys.get("ArrowRight")) ax += accel;

        // pointer target spring
        if (this._targetX != null) {
          const k = 26;
          const dx = this._targetX - (this._px + this._pw * 0.5);
          this._vx += k * dx * dt;
        }
        this._vx += ax * dt;

        // damping
        this._vx *= Math.exp(-8 * dt);

        // integrate
        this._px += this._vx * dt;
        this._px = clamp(this._px, 0, W - this._pw);

        // spawn
        this._spawnAcc += dt;
        while (this._spawnAcc >= this._spawnIv) {
          this._spawnAcc -= this._spawnIv;
          this._spawnOne();
        }

        // update treats and collisions
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
            this._bonusLevel = Math.floor(this._streak / 5);
            const gain = 1 + this._bonusLevel;
            this._score += gain;
            this._treats.splice(i, 1);
            this._core!.audio.beep(900, 40);
            continue;
          }

          if (o.y > groundY) {
            this._treats.splice(i, 1);
            this._misses += 1;
            this._streak = 0;
            this._bonusLevel = 0;
            this._core!.audio.beep(240, 80);
            if (this._misses >= 3) {
              this._over = true;
              if (this._score > this._best) {
                this._best = this._score;
                this._core!.store.setNumber(this.meta.bestKey, this._best);
              }
              this._core!.audio.beep(180, 180);
              break;
            }
          }
        }
      },
      () => this._draw()
    );
  },

  stop() {
    if (!this._core) return;
    this._core.stop();
    this._running = false;
    this._detachInput();
  },

  destroy() {
    this._detachInput();
  },

  /* spawn one treat */
  _spawnOne() {
    const core = this._core!;
    const dpr = core.dpr;
    const kind: 0|1 = Math.random() < 0.5 ? 0 : 1;
    const im = kind === 0 ? this._boneImg! : this._starImg!;
    const baseH = 24 * dpr;
    const aspect = (im.naturalWidth || im.width) / (im.naturalHeight || im.height) || 1;
    const w = Math.round(baseH * aspect);
    const h = Math.round(baseH);
    const x = Math.round(Math.random() * Math.max(1, core.canvas.width - w));
    const vy = this._fallBase * (0.9 + Math.random() * 0.2);
    this._treats.push({ x, y: -h, vy, w, h, kind });
  },

  /* drawing */
  _draw() {
    const core = this._core!;
    const ctx = core.ctx;
    const W = core.canvas.width;
    const H = core.canvas.height;
    const dpr = core.dpr;

    // hard fill
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, W, H);

    // bg texture cover
    if (this._bgImg && this._bgImg.complete) {
      const im = this._bgImg;
      const iw = im.naturalWidth || im.width;
      const ih = im.naturalHeight || im.height;
      if (iw && ih) {
        const s = Math.max(W / iw, H / ih);
        const dw = Math.ceil(iw * Math.ceil(s));
        const dh = Math.ceil(ih * Math.ceil(s));
        const dx = Math.floor((W - dw) / 2);
        const dy = Math.floor((H - dh) / 2);
        const prev = ctx.imageSmoothingEnabled;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(im, 0, 0, iw, ih, dx, dy, dw, dh);
        ctx.imageSmoothingEnabled = prev;
      }
    }

    // ground
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

    // pom
    if (this._pomImg && this._pomImg.complete) {
      const prev = ctx.imageSmoothingEnabled;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(this._pomImg, this._px | 0, this._py | 0, this._pw | 0, this._ph | 0);
      ctx.imageSmoothingEnabled = prev;
    }

    // treats
    for (let i = 0; i < this._treats.length; i++) {
      const o = this._treats[i];
      const im = o.kind === 0 ? this._boneImg! : this._starImg!;
      ctx.drawImage(im, o.x | 0, o.y | 0, o.w | 0, o.h | 0);
    }

    // HUD
    ctx.textBaseline = "top";
    ctx.textAlign = "left";
    ctx.font = `${Math.round(24 * dpr)}px VT323, monospace`;
    ctx.fillStyle = "#ffffff";
    ctx.fillText(`Score ${this._score}`, Math.round(HUD_PAD_CSS * dpr), Math.round(HUD_PAD_CSS * dpr));
    ctx.fillStyle = HUD_AQUA;
    ctx.fillText(`Best ${this._best}`, Math.round(HUD_PAD_CSS * dpr), Math.round((HUD_PAD_CSS + 26) * dpr));

    // lives circles top-right
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
  },

  _drawGameOver() {
    const core = this._core!;
    const ctx = core.ctx;
    const W = core.canvas.width;
    const H = core.canvas.height;
    const dpr = core.dpr;

    const cardW = Math.round(Math.min(W * 0.8, 360 * dpr));
    const cardH = Math.round(220 * dpr);
    const x = Math.round((W - cardW) / 2) + 0.5;
    const y = Math.round((H - cardH) / 2) + 0.5;
    const r = Math.round(12 * dpr);

    // card
    ctx.fillStyle = "#ffffff";
    roundRect(ctx, x, y, cardW, cardH, r);
    ctx.lineWidth = Math.max(1, Math.round(2 * dpr));
    ctx.strokeStyle = ICE_STROKE;
    ctx.stroke();

    // text
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#0a0c1a";
    ctx.font = `${Math.round(28 * dpr)}px VT323, monospace`;
    ctx.fillText("Game Over", x + cardW / 2, y + Math.round(40 * dpr));
    ctx.font = `${Math.round(22 * dpr)}px VT323, monospace`;
    ctx.fillText(`Score ${this._score}`, x + cardW / 2, y + Math.round(80 * dpr));
    ctx.fillStyle = "#4b5563";
    ctx.fillText(`Best ${this._best}`, x + cardW / 2, y + Math.round(108 * dpr));

    // retry button
    const bw = Math.round(120 * dpr);
    const bh = Math.round(36 * dpr);
    const bx = Math.round(x + (cardW - bw) / 2);
    const by = Math.round(y + cardH - bh - Math.round(24 * dpr));

    ctx.fillStyle = PINK;
    roundRect(ctx, bx, by, bw, bh, Math.round(8 * dpr));
    ctx.fillStyle = "#ffffff";
    ctx.font = `${Math.round(22 * dpr)}px VT323, monospace`;
    ctx.textBaseline = "middle";
    ctx.fillText("Retry", bx + bw / 2, by + Math.floor(bh / 2) + 1);

    this._rbx = bx; this._rby = by; this._rbw = bw; this._rbh = bh;
  },

  _attachInput() {
    const core = this._core!;
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
        if (core.audio.enabled) core.audio.beep(520, 80);
        this._over = false;
        // restart
        this.init(core.canvas, core).then(() => this.start());
      }
    };
    this._onKD = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") e.preventDefault();
    };
    this._onKU = this._onKD;

    canvas.addEventListener("pointerdown", this._onPD, { passive: true });
    canvas.addEventListener("pointermove", this._onPM, { passive: true });
    canvas.addEventListener("pointerup", this._onPU, { passive: true });
    canvas.addEventListener("click", this._onClick);
    window.addEventListener("keydown", this._onKD, { passive: false });
    window.addEventListener("keyup", this._onKU, { passive: false });
  },

  _detachInput() {
    const core = this._core;
    if (!core) return;
    const canvas = core.canvas;
    if (this._onPD) canvas.removeEventListener("pointerdown", this._onPD);
    if (this._onPM) canvas.removeEventListener("pointermove", this._onPM);
    if (this._onPU) canvas.removeEventListener("pointerup", this._onPU);
    if (this._onClick) canvas.removeEventListener("click", this._onClick);
    if (this._onKD) window.removeEventListener("keydown", this._onKD);
    if (this._onKU) window.removeEventListener("keyup", this._onKU);
    this._onPD = this._onPM = this._onPU = this._onClick = this._onKD = this._onKU = null;
  },

  _setTargetFromEvent(e: PointerEvent) {
    const core = this._core!;
    const rect = core.canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (core.canvas.width / rect.width);
    this._targetX = clamp(x, 0, core.canvas.width);
  },
};

/* simple rounded rect fill+stroke */
function roundRect(ctx: CanvasRenderingContext2D, x:number,y:number,w:number,h:number,r:number){
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
